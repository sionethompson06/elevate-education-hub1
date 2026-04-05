import { Router } from 'express';
import { eq, desc, or, and } from 'drizzle-orm';
import db from '../db-postgres.js';
import { messages, users, guardianStudents, staffAssignments, sectionStudents, sections, students } from '../schema.js';
import { requireAuth } from '../middleware/auth.js';
import { logAudit } from '../services/audit.service.js';
import { createNotification } from '../services/notification.service.js';

const router = Router();

async function canMessageUser(sender, recipientId) {
  if (sender.role === 'admin') return true;

  const [recipient] = await db.select().from(users).where(eq(users.id, recipientId));
  if (!recipient) return false;

  if (recipient.role === 'admin') return true;

  if (sender.role === 'parent') {
    if (recipient.role === 'academic_coach' || recipient.role === 'performance_coach') {
      const guardianLinks = await db.select().from(guardianStudents)
        .where(eq(guardianStudents.guardianUserId, sender.id));
      const studentIds = guardianLinks.map(l => l.studentId);
      if (studentIds.length === 0) return false;

      const coachAssignments = await db.select().from(staffAssignments)
        .where(eq(staffAssignments.staffUserId, recipientId));

      for (const ca of coachAssignments) {
        if (ca.assignmentType === 'student' && studentIds.includes(ca.assignmentId)) return true;
        if (ca.assignmentType === 'section') {
          const roster = await db.select().from(sectionStudents)
            .where(eq(sectionStudents.sectionId, ca.assignmentId));
          if (roster.some(r => studentIds.includes(r.studentId))) return true;
        }
        if (ca.assignmentType === 'program') {
          const progSections = await db.select().from(sections).where(eq(sections.programId, ca.assignmentId));
          for (const sec of progSections) {
            const roster = await db.select().from(sectionStudents)
              .where(eq(sectionStudents.sectionId, sec.id));
            if (roster.some(r => studentIds.includes(r.studentId))) return true;
          }
        }
      }
      return false;
    }
    return false;
  }

  if (sender.role === 'academic_coach' || sender.role === 'performance_coach') {
    if (recipient.role === 'parent') {
      const guardianLinks = await db.select().from(guardianStudents)
        .where(eq(guardianStudents.guardianUserId, recipientId));
      const recipientStudentIds = guardianLinks.map(l => l.studentId);
      if (recipientStudentIds.length === 0) return false;

      const coachAssignments = await db.select().from(staffAssignments)
        .where(eq(staffAssignments.staffUserId, sender.id));

      for (const ca of coachAssignments) {
        if (ca.assignmentType === 'student' && recipientStudentIds.includes(ca.assignmentId)) return true;
        if (ca.assignmentType === 'section') {
          const roster = await db.select().from(sectionStudents)
            .where(eq(sectionStudents.sectionId, ca.assignmentId));
          if (roster.some(r => recipientStudentIds.includes(r.studentId))) return true;
        }
        if (ca.assignmentType === 'program') {
          const progSections = await db.select().from(sections).where(eq(sections.programId, ca.assignmentId));
          for (const sec of progSections) {
            const roster = await db.select().from(sectionStudents)
              .where(eq(sectionStudents.sectionId, sec.id));
            if (roster.some(r => recipientStudentIds.includes(r.studentId))) return true;
          }
        }
      }
      return false;
    }
    if (recipient.role === 'student') {
      const [studentRec] = await db.select().from(students).where(eq(students.userId, recipientId));
      if (!studentRec) return false;
      const coachAssignments = await db.select().from(staffAssignments)
        .where(eq(staffAssignments.staffUserId, sender.id));
      for (const ca of coachAssignments) {
        if (ca.assignmentType === 'student' && ca.assignmentId === studentRec.id) return true;
        if (ca.assignmentType === 'section') {
          const roster = await db.select().from(sectionStudents)
            .where(eq(sectionStudents.sectionId, ca.assignmentId));
          if (roster.some(r => r.studentId === studentRec.id)) return true;
        }
        if (ca.assignmentType === 'program') {
          const progSections = await db.select().from(sections).where(eq(sections.programId, ca.assignmentId));
          for (const sec of progSections) {
            const roster = await db.select().from(sectionStudents)
              .where(eq(sectionStudents.sectionId, sec.id));
            if (roster.some(r => r.studentId === studentRec.id)) return true;
          }
        }
      }
      return false;
    }
    if (recipient.role === 'academic_coach' || recipient.role === 'performance_coach') return true;
    return false;
  }

  if (sender.role === 'student') {
    if (recipient.role === 'academic_coach' || recipient.role === 'performance_coach') {
      const [studentRec] = await db.select().from(students).where(eq(students.userId, sender.id));
      if (!studentRec) return false;
      const coachAssignments = await db.select().from(staffAssignments)
        .where(eq(staffAssignments.staffUserId, recipientId));
      for (const ca of coachAssignments) {
        if (ca.assignmentType === 'student' && ca.assignmentId === studentRec.id) return true;
        if (ca.assignmentType === 'section') {
          const roster = await db.select().from(sectionStudents)
            .where(eq(sectionStudents.sectionId, ca.assignmentId));
          if (roster.some(r => r.studentId === studentRec.id)) return true;
        }
        if (ca.assignmentType === 'program') {
          const progSections = await db.select().from(sections).where(eq(sections.programId, ca.assignmentId));
          for (const sec of progSections) {
            const roster = await db.select().from(sectionStudents)
              .where(eq(sectionStudents.sectionId, sec.id));
            if (roster.some(r => r.studentId === studentRec.id)) return true;
          }
        }
      }
    }
    return false;
  }

  return false;
}

router.get('/inbox', requireAuth, async (req, res) => {
  try {
    const inbox = await db.select({
      id: messages.id,
      fromUserId: messages.fromUserId,
      subject: messages.subject,
      body: messages.body,
      isRead: messages.isRead,
      createdAt: messages.createdAt,
      senderFirstName: users.firstName,
      senderLastName: users.lastName,
      senderRole: users.role,
    }).from(messages)
      .leftJoin(users, eq(messages.fromUserId, users.id))
      .where(eq(messages.toUserId, req.user.id))
      .orderBy(desc(messages.createdAt));
    res.json({ success: true, messages: inbox });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/sent', requireAuth, async (req, res) => {
  try {
    const sent = await db.select({
      id: messages.id,
      toUserId: messages.toUserId,
      subject: messages.subject,
      body: messages.body,
      isRead: messages.isRead,
      createdAt: messages.createdAt,
      recipientFirstName: users.firstName,
      recipientLastName: users.lastName,
      recipientRole: users.role,
    }).from(messages)
      .leftJoin(users, eq(messages.toUserId, users.id))
      .where(eq(messages.fromUserId, req.user.id))
      .orderBy(desc(messages.createdAt));
    res.json({ success: true, messages: sent });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/contacts', requireAuth, async (req, res) => {
  try {
    let contactList = [];
    if (req.user.role === 'admin') {
      contactList = await db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName, role: users.role })
        .from(users).where(eq(users.status, 'active'));
      contactList = contactList.filter(u => u.id !== req.user.id);
    } else {
      const allUsers = await db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName, role: users.role })
        .from(users).where(eq(users.status, 'active'));
      for (const u of allUsers) {
        if (u.id === req.user.id) continue;
        if (await canMessageUser(req.user, u.id)) {
          contactList.push(u);
        }
      }
    }
    res.json({ success: true, contacts: contactList });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

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

router.patch('/:id/read', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [msg] = await db.select().from(messages).where(eq(messages.id, id));
    if (!msg) return res.status(404).json({ success: false, error: 'Message not found' });
    if (msg.toUserId !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Not your message' });
    }
    const [updated] = await db.update(messages).set({ isRead: true }).where(eq(messages.id, id)).returning();
    res.json({ success: true, message: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
