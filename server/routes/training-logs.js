import { Router } from 'express';
import { eq, desc, and } from 'drizzle-orm';
import db from '../db-postgres.js';
import { trainingLogs, students } from '../schema.js';
import { requireAuth } from '../middleware/auth.js';
import { canAccessStudent, getCoachStudentIds } from '../middleware/scope.js';
import { logAudit } from '../services/audit.service.js';

const router = Router();

router.get('/my-students', requireAuth, async (req, res) => {
  try {
    const studentIds = await getCoachStudentIds(req.user.id);
    if (studentIds.length === 0) return res.json({ success: true, students: [] });

    const myStudents = [];
    for (const sid of studentIds) {
      const [s] = await db.select().from(students).where(eq(students.id, sid));
      if (s) myStudents.push(s);
    }
    res.json({ success: true, students: myStudents });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/student/:studentId', requireAuth, async (req, res) => {
  try {
    const studentId = parseInt(req.params.studentId);
    if (!await canAccessStudent(req.user, studentId)) {
      return res.status(403).json({ success: false, error: 'Not assigned to this student' });
    }

    const logs = await db.select().from(trainingLogs)
      .where(eq(trainingLogs.studentId, studentId))
      .orderBy(desc(trainingLogs.date));
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { studentId, date, type, durationMinutes, notes } = req.body;
    if (!studentId || !date) {
      return res.status(400).json({ success: false, error: 'Student and date are required' });
    }

    const allowedRoles = ['admin', 'academic_coach', 'performance_coach'];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Only coaches and admins can create training logs' });
    }

    if (!await canAccessStudent(req.user, parseInt(studentId))) {
      return res.status(403).json({ success: false, error: 'Not assigned to this student' });
    }

    const [log] = await db.insert(trainingLogs).values({
      studentId: parseInt(studentId),
      coachUserId: req.user.id,
      date,
      type: type || 'general',
      durationMinutes: durationMinutes ? parseInt(durationMinutes) : null,
      notes: notes || null,
    }).returning();

    await logAudit({
      userId: req.user.id,
      action: 'create',
      entityType: 'training_log',
      entityId: log.id,
      details: { studentId, date, type },
      ipAddress: req.ip,
    });

    res.json({ success: true, log });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [existing] = await db.select().from(trainingLogs).where(eq(trainingLogs.id, id));
    if (!existing) return res.status(404).json({ success: false, error: 'Training log not found' });

    if (req.user.role !== 'admin' && existing.coachUserId !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Can only edit your own training logs' });
    }

    const { date, type, durationMinutes, notes } = req.body;
    const updateData = {};
    if (date !== undefined) updateData.date = date;
    if (type !== undefined) updateData.type = type;
    if (durationMinutes !== undefined) updateData.durationMinutes = parseInt(durationMinutes);
    if (notes !== undefined) updateData.notes = notes;

    const [updated] = await db.update(trainingLogs).set(updateData).where(eq(trainingLogs.id, id)).returning();

    await logAudit({
      userId: req.user.id,
      action: 'update',
      entityType: 'training_log',
      entityId: id,
      details: updateData,
      ipAddress: req.ip,
    });

    res.json({ success: true, log: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [existing] = await db.select().from(trainingLogs).where(eq(trainingLogs.id, id));
    if (!existing) return res.status(404).json({ success: false, error: 'Training log not found' });

    if (req.user.role !== 'admin' && existing.coachUserId !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Can only delete your own training logs' });
    }

    await db.delete(trainingLogs).where(eq(trainingLogs.id, id));

    await logAudit({
      userId: req.user.id,
      action: 'delete',
      entityType: 'training_log',
      entityId: id,
      ipAddress: req.ip,
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
