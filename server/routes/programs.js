import { Router } from 'express';
import { eq, desc } from 'drizzle-orm';
import db from '../db-postgres.js';
import { programs, schoolYears, enrollments, sections } from '../schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { logAudit } from '../services/audit.service.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const allPrograms = await db.select().from(programs).orderBy(desc(programs.createdAt));

    // Fetch section counts per program
    const allSections = await db.select({ programId: sections.programId }).from(sections);
    const sectionCountMap = {};
    for (const s of allSections) {
      if (s.programId) sectionCountMap[s.programId] = (sectionCountMap[s.programId] || 0) + 1;
    }

    res.json({
      success: true,
      programs: allPrograms.map(p => ({
        ...p,
        category: p.type,
        ...(p.metadata || {}),
        sectionCount: sectionCountMap[p.id] || 0,
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/available', requireAuth, async (req, res) => {
  try {
    const [currentYear] = await db.select().from(schoolYears).where(eq(schoolYears.isCurrent, true));
    if (!currentYear) {
      return res.json({ success: true, programs: [], schoolYear: null });
    }
    const available = await db.select().from(programs)
      .where(eq(programs.schoolYearId, currentYear.id))
      .orderBy(programs.name);
    res.json({ success: true, programs: available.filter(p => p.status === 'active'), schoolYear: currentYear });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const [program] = await db.select().from(programs).where(eq(programs.id, parseInt(req.params.id)));
    if (!program) return res.status(404).json({ success: false, error: 'Program not found' });
    res.json({ success: true, program });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { name, type, description, tuitionAmount, billingCycle, status, schoolYearId } = req.body;
    if (!name || !type) {
      return res.status(400).json({ success: false, error: 'Name and type are required' });
    }
    const [program] = await db.insert(programs).values({
      name: name.trim(),
      type,
      description: description || null,
      tuitionAmount: tuitionAmount || '0',
      billingCycle: billingCycle || 'monthly',
      status: status || 'active',
      schoolYearId: schoolYearId ? parseInt(schoolYearId) : null,
    }).returning();

    await logAudit({
      userId: req.user.id,
      action: 'create',
      entityType: 'program',
      entityId: program.id,
      details: { name, type, tuitionAmount },
      ipAddress: req.ip,
    });

    res.json({ success: true, program });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.patch('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, type, description, tuitionAmount, billingCycle, status, schoolYearId } = req.body;
    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (type !== undefined) updateData.type = type;
    if (description !== undefined) updateData.description = description;
    if (tuitionAmount !== undefined) updateData.tuitionAmount = tuitionAmount;
    if (billingCycle !== undefined) updateData.billingCycle = billingCycle;
    if (status !== undefined) updateData.status = status;
    if (schoolYearId !== undefined) updateData.schoolYearId = schoolYearId ? parseInt(schoolYearId) : null;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    const [updated] = await db.update(programs).set(updateData).where(eq(programs.id, id)).returning();
    if (!updated) return res.status(404).json({ success: false, error: 'Program not found' });

    await logAudit({
      userId: req.user.id,
      action: 'update',
      entityType: 'program',
      entityId: id,
      details: updateData,
      ipAddress: req.ip,
    });

    res.json({ success: true, program: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    // Check for any enrollments referencing this program (any status)
    const programEnrollments = await db
      .select({ id: enrollments.id, status: enrollments.status })
      .from(enrollments)
      .where(eq(enrollments.programId, id));

    // Check for any enrollments that block deletion (cancelled/paused are excluded — historical only)
    const blockingEnrollments = programEnrollments.filter(
      e => !['cancelled', 'paused'].includes(e.status)
    );

    if (blockingEnrollments.length > 0) {
      const byStatus = {
        active:   blockingEnrollments.filter(e => ['active', 'active_override'].includes(e.status)).length,
        pending:  blockingEnrollments.filter(e => ['pending_payment', 'pending'].includes(e.status)).length,
        pastDue:  blockingEnrollments.filter(e => ['past_due', 'payment_failed'].includes(e.status)).length,
      };
      const reasons = [];
      if (byStatus.active  > 0) reasons.push(`${byStatus.active} active enrollment${byStatus.active > 1 ? 's' : ''}`);
      if (byStatus.pending > 0) reasons.push(`${byStatus.pending} pending enrollment${byStatus.pending > 1 ? 's' : ''}`);
      if (byStatus.pastDue > 0) reasons.push(`${byStatus.pastDue} past-due enrollment${byStatus.pastDue > 1 ? 's' : ''}`);
      return res.status(409).json({
        success: false,
        error: `Cannot delete: ${reasons.join(', ')}. Resolve or remove all enrollments before deleting this program.`,
        blockers: { total: blockingEnrollments.length, ...byStatus },
      });
    }

    // Check for sections assigned to this program
    const programSections = await db
      .select({ id: sections.id, name: sections.name })
      .from(sections)
      .where(eq(sections.programId, id));

    if (programSections.length > 0) {
      return res.status(409).json({
        success: false,
        error: `Cannot delete: ${programSections.length} section${programSections.length > 1 ? 's are' : ' is'} assigned to this program. Delete or reassign all sections first.`,
        blockers: { sections: programSections.length },
      });
    }

    await db.delete(programs).where(eq(programs.id, id));
    await logAudit({
      userId: req.user.id,
      action: 'delete',
      entityType: 'program',
      entityId: id,
      ipAddress: req.ip,
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
