import { Router } from 'express';
import { eq, and } from 'drizzle-orm';
import db from '../db-postgres.js';
import { coachAssignments, students, users } from '../schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { logAudit } from '../services/audit.service.js';

const router = Router();

// GET /api/coach-assignments?coachUserId=X&isActive=true
router.get('/', requireAuth, async (req, res) => {
  try {
    // Non-admins are always scoped to their own assignments regardless of query param
    const requestedCoachUserId = parseInt(req.query.coachUserId || req.query.coach_user_id);
    const effectiveCoachUserId = req.user.role === 'admin' ? requestedCoachUserId : req.user.id;

    const studentId   = parseInt(req.query.studentId   || req.query.student_id);
    const isActiveRaw = req.query.isActive ?? req.query.is_active;

    const conditions = [];
    if (effectiveCoachUserId && !isNaN(effectiveCoachUserId)) conditions.push(eq(coachAssignments.coachUserId, effectiveCoachUserId));
    if (studentId   && !isNaN(studentId))   conditions.push(eq(coachAssignments.studentId, studentId));
    if (isActiveRaw !== undefined)           conditions.push(eq(coachAssignments.isActive, isActiveRaw === 'true'));

    const rows = conditions.length
      ? await db.select().from(coachAssignments).where(and(...conditions))
      : await db.select().from(coachAssignments);

    res.json({ success: true, assignments: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/coach-assignments
router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { coachUserId, coachType, studentId, startDate } = req.body;
    if (!coachUserId || !studentId) {
      return res.status(400).json({ success: false, error: 'coachUserId and studentId are required' });
    }

    // Prevent duplicates
    const [existing] = await db.select().from(coachAssignments).where(
      and(
        eq(coachAssignments.coachUserId, parseInt(coachUserId)),
        eq(coachAssignments.studentId, parseInt(studentId)),
        eq(coachAssignments.isActive, true)
      )
    );
    if (existing) {
      return res.json({ success: true, assignment: existing, duplicate: true });
    }

    const [assignment] = await db.insert(coachAssignments).values({
      coachUserId: parseInt(coachUserId),
      coachType: coachType || 'academic_coach',
      studentId: parseInt(studentId),
      isActive: true,
      startDate: startDate || new Date().toISOString().split('T')[0],
    }).returning();

    await logAudit({
      userId: req.user.id,
      action: 'create',
      entityType: 'coach_assignment',
      entityId: assignment.id,
      details: { coachUserId, studentId, coachType },
      ipAddress: req.ip,
    });

    res.json({ success: true, assignment });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/coach-assignments/:id
router.patch('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { isActive, endDate } = req.body;
    const update = {};
    if (isActive !== undefined) update.isActive = isActive;
    if (endDate  !== undefined) update.endDate = endDate;

    const [updated] = await db.update(coachAssignments).set(update).where(eq(coachAssignments.id, id)).returning();
    if (!updated) return res.status(404).json({ success: false, error: 'Assignment not found' });

    res.json({ success: true, assignment: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/coach-assignments/:id
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(coachAssignments).where(eq(coachAssignments.id, id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
