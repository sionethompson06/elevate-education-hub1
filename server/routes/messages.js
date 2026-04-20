import { Router } from 'express';
import { eq, desc, and, or, isNull, ilike, inArray } from 'drizzle-orm';
import db from '../db-postgres.js';
import {
  messages, users, guardianStudents, coachAssignments, sectionStudents, sections, students,
} from '../schema.js';
import { requireAuth } from '../middleware/auth.js';
import { logAudit } from '../services/audit.service.js';
import { createNotification } from '../services/notification.service.js';

const router = Router();

// ── Permission check ────────────────────────────────────────────────────────
// Uses coachAssignments (the active assignment system written by the admin UI).
async function canMessageUser(sender, recipientId) {
  if (sender.role === 'admin') return true;

  const [recipient] = await db.select({ id: users.id, role: users.role })
    .from(users).where(eq(users.id, recipientId));
  if (!recipient) return false;
  if (recipient.role === 'admin') return true;

  if (sender.role === 'parent') {
    if (recipient.role !== 'academic_coach' && recipient.role !== 'performance_coach') return false;
    const guardianLinks = await db.select({ studentId: guardianStudents.studentId })
      .from(guardianStudents).where(eq(guardianStudents.guardianUserId, sender.id));
    const studentIds = guardianLinks.map(l => l.studentId);
    if (studentIds.length === 0) return false;
    const [hit] = await db.select({ id: coachAssignments.id })
      .from(coachAssignments)
      .where(and(
        eq(coachAssignments.coachUserId, recipientId),
        eq(coachAssignments.isActive, true),
        inArray(coachAssignments.studentId, studentIds)
      ));
    return !!hit;
  }

  if (sender.role === 'academic_coach' || sender.role === 'performance_coach') {
    if (recipient.role === 'parent') {
      const myAssignments = await db.select({ studentId: coachAssignments.studentId })
        .from(coachAssignments)
        .where(and(eq(coachAssignments.coachUserId, sender.id), eq(coachAssignments.isActive, true)));
      const myStudentIds = myAssignments.map(a => a.studentId);
      if (myStudentIds.length === 0) return false;
      const [hit] = await db.select({ id: guardianStudents.id })
        .from(guardianStudents)
        .where(and(
          eq(guardianStudents.guardianUserId, recipientId),
          inArray(guardianStudents.studentId, myStudentIds)
        ));
      return !!hit;
    }
    if (recipient.role === 'student') {
      const [studentRec] = await db.select({ id: students.id })
        .from(students).where(eq(students.userId, recipientId));
      if (!studentRec) return false;
      const [hit] = await db.select({ id: coachAssignments.id })
        .from(coachAssignments)
        .where(and(
          eq(coachAssignments.coachUserId, sender.id),
          eq(coachAssignments.studentId, studentRec.id),
          eq(coachAssignments.isActive, true)
        ));
      return !!hit;
    }
    if (recipient.role === 'academic_coach' || recipient.role === 'performance_coach') return true;
    return false;
  }

  if (sender.role === 'student') {
    if (recipient.role === 'academic_coach' || recipient.role === 'performance_coach') {
      const [studentRec] = await db.select({ id: students.id })
        .from(students).where(eq(students.userId, sender.id));
      if (!studentRec) return false;
      const [hit] = await db.select({ id: coachAssignments.id })
        .from(coachAssignments)
        .where(and(
          eq(coachAssignments.coachUserId, recipientId),
          eq(coachAssignments.studentId, studentRec.id),
          eq(coachAssignments.isActive, true)
        ));
      return !!hit;
    }
    return false;
  }

  return false;
}

// ── Inbox ────────────────────────────────────────────────────────────────────
router.get('/inbox', requireAuth, async (req, res) => {
  try {
    const inbox = await db.select({
      id: messages.id,
      fromUserId: messages.fromUserId,
      subject: messages.subject,
      body: messages.body,
      isRead: messages.isRead,
      parentMessageId: messages.parentMessageId,
      createdAt: messages.createdAt,
      senderFirstName: users.firstName,
      senderLastName: users.lastName,
      senderRole: users.role,
    }).from(messages)
      .leftJoin(users, eq(messages.fromUserId, users.id))
      .where(and(
        eq(messages.toUserId, req.user.id),
        isNull(messages.deletedAt),
        isNull(messages.parentMessageId)
      ))
      .orderBy(desc(messages.createdAt));
    res.json({ success: true, messages: inbox });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Sent ─────────────────────────────────────────────────────────────────────
router.get('/sent', requireAuth, async (req, res) => {
  try {
    const sent = await db.select({
      id: messages.id,
      toUserId: messages.toUserId,
      subject: messages.subject,
      body: messages.body,
      isRead: messages.isRead,
      parentMessageId: messages.parentMessageId,
      createdAt: messages.createdAt,
      recipientFirstName: users.firstName,
      recipientLastName: users.lastName,
      recipientRole: users.role,
    }).from(messages)
      .leftJoin(users, eq(messages.toUserId, users.id))
      .where(and(
        eq(messages.fromUserId, req.user.id),
        isNull(messages.deletedAt),
        isNull(messages.parentMessageId)
      ))
      .orderBy(desc(messages.createdAt));
    res.json({ success: true, messages: sent });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Contacts (grouped by relationship) ───────────────────────────────────────
router.get('/contacts', requireAuth, async (req, res) => {
  try {
    const groups = [];
    const seen = new Set();

    const pickUser = u => ({ id: u.id, firstName: u.firstName, lastName: u.lastName, role: u.role });

    const addGroup = (label, rows) => {
      const contacts = rows
        .filter(u => u.id !== req.user.id && !seen.has(u.id))
        .map(u => { seen.add(u.id); return pickUser(u); });
      if (contacts.length) groups.push({ label, contacts });
    };

    const admins = await db.select().from(users)
      .where(and(eq(users.role, 'admin'), eq(users.status, 'active')));

    if (req.user.role === 'admin') {
      const allActive = await db.select().from(users).where(eq(users.status, 'active'));
      const byRole = {};
      for (const u of allActive) {
        if (u.id === req.user.id) continue;
        const lbl = { parent: 'Parents', student: 'Students', academic_coach: 'Academic Coaches', performance_coach: 'Performance Coaches', admin: 'Admins' }[u.role] || 'Other';
        (byRole[lbl] = byRole[lbl] || []).push(u);
      }
      for (const [label, rows] of Object.entries(byRole)) addGroup(label, rows);

    } else if (req.user.role === 'parent') {
      const guardianLinks = await db.select({ studentId: guardianStudents.studentId })
        .from(guardianStudents).where(eq(guardianStudents.guardianUserId, req.user.id));
      const studentIds = guardianLinks.map(l => l.studentId);

      if (studentIds.length > 0) {
        const activeAssignments = await db.select({
          coachUserId: coachAssignments.coachUserId,
          studentId: coachAssignments.studentId,
        }).from(coachAssignments)
          .where(and(eq(coachAssignments.isActive, true), inArray(coachAssignments.studentId, studentIds)));

        if (activeAssignments.length > 0) {
          const coachUserIds = [...new Set(activeAssignments.map(a => a.coachUserId))];
          const coachUsers = await db.select().from(users).where(inArray(users.id, coachUserIds));
          const studentRecords = await db.select({ id: students.id, firstName: students.firstName })
            .from(students).where(inArray(students.id, studentIds));
          const studentMap = Object.fromEntries(studentRecords.map(s => [s.id, s]));
          const coachMap = Object.fromEntries(coachUsers.map(c => [c.id, c]));

          // Group coaches under their student
          const byStudent = {};
          for (const a of activeAssignments) {
            const sname = studentMap[a.studentId]?.firstName || 'Student';
            (byStudent[sname] = byStudent[sname] || new Set()).add(a.coachUserId);
          }
          for (const [sname, ids] of Object.entries(byStudent)) {
            addGroup(`${sname}'s Coaches`, [...ids].map(id => coachMap[id]).filter(Boolean));
          }
        }
      }
      addGroup('Administration', admins);

    } else if (req.user.role === 'academic_coach' || req.user.role === 'performance_coach') {
      const myAssignments = await db.select({ studentId: coachAssignments.studentId })
        .from(coachAssignments)
        .where(and(eq(coachAssignments.coachUserId, req.user.id), eq(coachAssignments.isActive, true)));
      const myStudentIds = [...new Set(myAssignments.map(a => a.studentId))];

      if (myStudentIds.length > 0) {
        const studentRecords = await db.select({ id: students.id, firstName: students.firstName, lastName: students.lastName, userId: students.userId })
          .from(students).where(inArray(students.id, myStudentIds));

        // Parents of my students
        const guardianLinks = await db.select({ guardianUserId: guardianStudents.guardianUserId, studentId: guardianStudents.studentId })
          .from(guardianStudents).where(inArray(guardianStudents.studentId, myStudentIds));
        const parentUserIds = [...new Set(guardianLinks.map(l => l.guardianUserId))];
        if (parentUserIds.length > 0) {
          const parentUsers = await db.select().from(users).where(inArray(users.id, parentUserIds));
          const studentMap = Object.fromEntries(studentRecords.map(s => [s.id, s]));
          const parentMap = Object.fromEntries(parentUsers.map(p => [p.id, p]));
          const byStudent = {};
          for (const link of guardianLinks) {
            const s = studentMap[link.studentId];
            const label = s ? `${s.firstName} ${s.lastName}'s Family` : 'Family';
            (byStudent[label] = byStudent[label] || new Set()).add(link.guardianUserId);
          }
          for (const [label, ids] of Object.entries(byStudent)) {
            addGroup(label, [...ids].map(id => parentMap[id]).filter(Boolean));
          }
        }

        // Student accounts
        const studentUserIds = studentRecords.filter(s => s.userId).map(s => s.userId);
        if (studentUserIds.length > 0) {
          const studentUsers = await db.select().from(users).where(inArray(users.id, studentUserIds));
          addGroup('My Students', studentUsers);
        }
      }

      // Other coaches
      const otherCoaches = await db.select().from(users)
        .where(and(
          or(eq(users.role, 'academic_coach'), eq(users.role, 'performance_coach')),
          eq(users.status, 'active')
        ));
      addGroup('Coaches', otherCoaches);
      addGroup('Administration', admins);

    } else if (req.user.role === 'student') {
      const [studentRec] = await db.select({ id: students.id })
        .from(students).where(eq(students.userId, req.user.id));
      if (studentRec) {
        const myAssignments = await db.select({ coachUserId: coachAssignments.coachUserId })
          .from(coachAssignments)
          .where(and(eq(coachAssignments.studentId, studentRec.id), eq(coachAssignments.isActive, true)));
        if (myAssignments.length > 0) {
          const coachUsers = await db.select().from(users)
            .where(inArray(users.id, myAssignments.map(a => a.coachUserId)));
          addGroup('My Coaches', coachUsers);
        }
      }
      addGroup('Administration', admins);
    }

    const contacts = groups.flatMap(g => g.contacts);
    res.json({ success: true, contacts, groups });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Send ──────────────────────────────────────────────────────────────────────
router.post('/', requireAuth, async (req, res) => {
  try {
    const { toUserId, subject, body } = req.body;
    if (!toUserId || !subject || !body) {
      return res.status(400).json({ success: false, error: 'Recipient, subject, and body are required' });
    }

    if (!await canMessageUser(req.user, parseInt(toUserId))) {
      return res.status(403).json({ success: false, error: 'Not authorized to message this user' });
    }

    const [msg] = await db.insert(messages).values({
      fromUserId: req.user.id,
      toUserId: parseInt(toUserId),
      subject: subject.trim(),
      body: body.trim(),
    }).returning();

    await createNotification({
      userId: parseInt(toUserId),
      type: 'message',
      title: 'New message',
      body: `From ${req.user.firstName || 'User'}: ${subject}`,
      link: '/hub/messages',
    });

    await logAudit({
      userId: req.user.id,
      action: 'create',
      entityType: 'message',
      entityId: msg.id,
      details: { toUserId, subject },
      ipAddress: req.ip,
    });

    res.json({ success: true, message: msg });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Mark read ─────────────────────────────────────────────────────────────────
router.patch('/:id/read', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [msg] = await db.select().from(messages).where(eq(messages.id, id));
    if (!msg) return res.status(404).json({ success: false, error: 'Message not found' });
    if (msg.toUserId !== req.user.id) return res.status(403).json({ success: false, error: 'Not your message' });
    const [updated] = await db.update(messages).set({ isRead: true }).where(eq(messages.id, id)).returning();
    res.json({ success: true, message: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Reply ─────────────────────────────────────────────────────────────────────
router.post('/:id/reply', requireAuth, async (req, res) => {
  try {
    const parentId = parseInt(req.params.id);
    const [parent] = await db.select().from(messages).where(eq(messages.id, parentId));
    if (!parent) return res.status(404).json({ success: false, error: 'Message not found' });
    if (parent.toUserId !== req.user.id && parent.fromUserId !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Not your message' });
    }
    const { body } = req.body;
    if (!body?.trim()) return res.status(400).json({ success: false, error: 'Body is required' });

    const recipientId = parent.fromUserId === req.user.id ? parent.toUserId : parent.fromUserId;
    const subject = parent.subject.startsWith('Re: ') ? parent.subject : `Re: ${parent.subject}`;

    const [reply] = await db.insert(messages).values({
      fromUserId: req.user.id,
      toUserId: recipientId,
      subject,
      body: body.trim(),
      parentMessageId: parentId,
    }).returning();

    await createNotification({
      userId: recipientId,
      type: 'message',
      title: `Reply from ${req.user.firstName || 'User'}`,
      body: subject,
      link: '/hub/messages',
    });

    res.json({ success: true, message: reply });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Thread ────────────────────────────────────────────────────────────────────
router.get('/:id/thread', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [original] = await db.select({
      id: messages.id, fromUserId: messages.fromUserId, toUserId: messages.toUserId,
      subject: messages.subject, body: messages.body, isRead: messages.isRead,
      parentMessageId: messages.parentMessageId, createdAt: messages.createdAt,
      senderFirstName: users.firstName, senderLastName: users.lastName, senderRole: users.role,
    }).from(messages).leftJoin(users, eq(messages.fromUserId, users.id)).where(eq(messages.id, id));

    if (!original) return res.status(404).json({ success: false, error: 'Message not found' });
    if (original.fromUserId !== req.user.id && original.toUserId !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Not your message' });
    }

    const replies = await db.select({
      id: messages.id, fromUserId: messages.fromUserId, toUserId: messages.toUserId,
      subject: messages.subject, body: messages.body, isRead: messages.isRead,
      parentMessageId: messages.parentMessageId, createdAt: messages.createdAt,
      senderFirstName: users.firstName, senderLastName: users.lastName, senderRole: users.role,
    }).from(messages).leftJoin(users, eq(messages.fromUserId, users.id))
      .where(and(eq(messages.parentMessageId, id), isNull(messages.deletedAt)))
      .orderBy(messages.createdAt);

    res.json({ success: true, thread: [original, ...replies] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Soft delete ───────────────────────────────────────────────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [msg] = await db.select().from(messages).where(eq(messages.id, id));
    if (!msg) return res.status(404).json({ success: false, error: 'Message not found' });
    if (msg.fromUserId !== req.user.id && msg.toUserId !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Not your message' });
    }
    await db.update(messages).set({ deletedAt: new Date() }).where(eq(messages.id, id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Search ────────────────────────────────────────────────────────────────────
router.get('/search', requireAuth, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ success: true, messages: [] });
    const results = await db.select({
      id: messages.id, fromUserId: messages.fromUserId, toUserId: messages.toUserId,
      subject: messages.subject, body: messages.body, isRead: messages.isRead,
      parentMessageId: messages.parentMessageId, createdAt: messages.createdAt,
      senderFirstName: users.firstName, senderLastName: users.lastName, senderRole: users.role,
    }).from(messages).leftJoin(users, eq(messages.fromUserId, users.id))
      .where(and(
        or(eq(messages.toUserId, req.user.id), eq(messages.fromUserId, req.user.id)),
        isNull(messages.deletedAt),
        or(ilike(messages.subject, `%${q}%`), ilike(messages.body, `%${q}%`))
      ))
      .orderBy(desc(messages.createdAt))
      .limit(50);
    res.json({ success: true, messages: results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
