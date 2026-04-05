import { Router } from 'express';
import { eq, desc, and } from 'drizzle-orm';
import db from '../db-postgres.js';
import { coachNotes, users } from '../schema.js';
import { requireAuth } from '../middleware/auth.js';
import { canAccessStudent } from '../middleware/scope.js';
import { logAudit } from '../services/audit.service.js';

const router = Router();

router.get('/student/:studentId', requireAuth, async (req, res) => {
  try {
    const studentId = parseInt(req.params.studentId);

    if (!await canAccessStudent(req.user, studentId)) {
      return res.status(403).json({ success: false, error: 'Not authorized to view this student' });
    }

    let notes = await db.select({
      id: coachNotes.id,
      coachUserId: coachNotes.coachUserId,
      studentId: coachNotes.studentId,
      sectionId: coachNotes.sectionId,
      content: coachNotes.content,
      visibility: coachNotes.visibility,
      createdAt: coachNotes.createdAt,
      coachFirstName: users.firstName,
      coachLastName: users.lastName,
    }).from(coachNotes)
      .leftJoin(users, eq(coachNotes.coachUserId, users.id))
      .where(eq(coachNotes.studentId, studentId))
      .orderBy(desc(coachNotes.createdAt));

    if (req.user.role === 'parent') {
      notes = notes.filter(n => n.visibility === 'parent_visible');
    } else if (req.user.role === 'student') {
      notes = notes.filter(n => n.visibility === 'student_visible');
    }

    res.json({ success: true, notes });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const allowedRoles = ['admin', 'academic_coach', 'performance_coach'];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Only coaches and admins can create notes' });
    }

    const { studentId, sectionId, content, visibility } = req.body;
    if (!studentId || !content) {
      return res.status(400).json({ success: false, error: 'Student and content are required' });
    }

    if (!await canAccessStudent(req.user, parseInt(studentId))) {
      return res.status(403).json({ success: false, error: 'Not assigned to this student' });
    }

    const validVisibilities = ['staff_only', 'parent_visible', 'student_visible'];
    if (visibility && !validVisibilities.includes(visibility)) {
      return res.status(400).json({ success: false, error: 'Visibility must be staff_only, parent_visible, or student_visible' });
    }

    const [note] = await db.insert(coachNotes).values({
      coachUserId: req.user.id,
      studentId: parseInt(studentId),
      sectionId: sectionId ? parseInt(sectionId) : null,
      content: content.trim(),
      visibility: visibility || 'staff_only',
    }).returning();

    await logAudit({
      userId: req.user.id,
      action: 'create',
      entityType: 'coach_note',
      entityId: note.id,
      details: { studentId, visibility: note.visibility },
      ipAddress: req.ip,
    });

    res.json({ success: true, note });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [existing] = await db.select().from(coachNotes).where(eq(coachNotes.id, id));
    if (!existing) return res.status(404).json({ success: false, error: 'Note not found' });

    if (req.user.role !== 'admin' && existing.coachUserId !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Can only edit your own notes' });
    }

    const { content, visibility } = req.body;
    const updateData = {};
    if (content !== undefined) updateData.content = content.trim();
    if (visibility !== undefined) updateData.visibility = visibility;

    const [updated] = await db.update(coachNotes).set(updateData).where(eq(coachNotes.id, id)).returning();

    await logAudit({
      userId: req.user.id,
      action: 'update',
      entityType: 'coach_note',
      entityId: id,
      details: updateData,
      ipAddress: req.ip,
    });

    res.json({ success: true, note: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [existing] = await db.select().from(coachNotes).where(eq(coachNotes.id, id));
    if (!existing) return res.status(404).json({ success: false, error: 'Note not found' });

    if (req.user.role !== 'admin' && existing.coachUserId !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Can only delete your own notes' });
    }

    await db.delete(coachNotes).where(eq(coachNotes.id, id));

    await logAudit({
      userId: req.user.id,
      action: 'delete',
      entityType: 'coach_note',
      entityId: id,
      ipAddress: req.ip,
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
