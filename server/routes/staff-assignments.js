import { Router } from 'express';
import { eq, desc, and } from 'drizzle-orm';
import db from '../db-postgres.js';
import { staffAssignments, users, sections, programs } from '../schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { logAudit } from '../services/audit.service.js';

const router = Router();

router.get('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const result = await db.select({
      id: staffAssignments.id,
      staffUserId: staffAssignments.staffUserId,
      assignmentType: staffAssignments.assignmentType,
      assignmentId: staffAssignments.assignmentId,
      roleInAssignment: staffAssignments.roleInAssignment,
      schoolYearId: staffAssignments.schoolYearId,
      startDate: staffAssignments.startDate,
      endDate: staffAssignments.endDate,
      staffFirstName: users.firstName,
      staffLastName: users.lastName,
      staffEmail: users.email,
      staffRole: users.role,
    }).from(staffAssignments)
      .leftJoin(users, eq(staffAssignments.staffUserId, users.id))
      .orderBy(desc(staffAssignments.id));

    const enriched = [];
    for (const sa of result) {
      let targetName = '';
      if (sa.assignmentType === 'section' && sa.assignmentId) {
        const [sec] = await db.select().from(sections).where(eq(sections.id, sa.assignmentId));
        targetName = sec?.name || `Section #${sa.assignmentId}`;
      } else if (sa.assignmentType === 'program' && sa.assignmentId) {
        const [prog] = await db.select().from(programs).where(eq(programs.id, sa.assignmentId));
        targetName = prog?.name || `Program #${sa.assignmentId}`;
      } else if (sa.assignmentType === 'student') {
        targetName = `Student #${sa.assignmentId}`;
      }
      enriched.push({ ...sa, targetName });
    }

    res.json({ success: true, staffAssignments: enriched });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { staffUserId, assignmentType, assignmentId, roleInAssignment, schoolYearId } = req.body;
    if (!staffUserId || !assignmentType || !assignmentId) {
      return res.status(400).json({ success: false, error: 'Staff user, assignment type, and target are required' });
    }

    const validTypes = ['section', 'program', 'student'];
    if (!validTypes.includes(assignmentType)) {
      return res.status(400).json({ success: false, error: 'Assignment type must be section, program, or student' });
    }

    const existing = await db.select().from(staffAssignments)
      .where(and(
        eq(staffAssignments.staffUserId, parseInt(staffUserId)),
        eq(staffAssignments.assignmentType, assignmentType),
        eq(staffAssignments.assignmentId, parseInt(assignmentId))
      ));
    if (existing.length > 0) {
      return res.status(400).json({ success: false, error: 'This staff assignment already exists' });
    }

    const [sa] = await db.insert(staffAssignments).values({
      staffUserId: parseInt(staffUserId),
      assignmentType,
      assignmentId: parseInt(assignmentId),
      roleInAssignment: roleInAssignment || assignmentType,
      schoolYearId: schoolYearId ? parseInt(schoolYearId) : null,
    }).returning();

    await logAudit({
      userId: req.user.id,
      action: 'create',
      entityType: 'staff_assignment',
      entityId: sa.id,
      details: { staffUserId, assignmentType, assignmentId },
      ipAddress: req.ip,
    });

    res.json({ success: true, staffAssignment: sa });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(staffAssignments).where(eq(staffAssignments.id, id));

    await logAudit({
      userId: req.user.id,
      action: 'delete',
      entityType: 'staff_assignment',
      entityId: id,
      ipAddress: req.ip,
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
