import { Router } from 'express';
import { eq, desc } from 'drizzle-orm';
import db from '../db-postgres.js';
import { schoolYears, terms } from '../schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { logAudit } from '../services/audit.service.js';

const router = Router();

router.get('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const years = await db.select().from(schoolYears).orderBy(desc(schoolYears.startDate));
    res.json({ success: true, schoolYears: years });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { name, startDate, endDate, isCurrent } = req.body;
    if (!name || !startDate || !endDate) {
      return res.status(400).json({ success: false, error: 'Name, start date, and end date are required' });
    }
    if (isCurrent) {
      await db.update(schoolYears).set({ isCurrent: false });
    }
    const [year] = await db.insert(schoolYears).values({
      name,
      startDate,
      endDate,
      isCurrent: isCurrent || false,
    }).returning();

    await logAudit({
      userId: req.user.id,
      action: 'create',
      entityType: 'school_year',
      entityId: year.id,
      details: { name },
      ipAddress: req.ip,
    });

    res.json({ success: true, schoolYear: year });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.patch('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, startDate, endDate, isCurrent } = req.body;
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (startDate !== undefined) updateData.startDate = startDate;
    if (endDate !== undefined) updateData.endDate = endDate;
    if (isCurrent !== undefined) {
      if (isCurrent) {
        await db.update(schoolYears).set({ isCurrent: false });
      }
      updateData.isCurrent = isCurrent;
    }

    const [updated] = await db.update(schoolYears).set(updateData).where(eq(schoolYears.id, id)).returning();
    if (!updated) return res.status(404).json({ success: false, error: 'School year not found' });

    await logAudit({
      userId: req.user.id,
      action: 'update',
      entityType: 'school_year',
      entityId: id,
      details: updateData,
      ipAddress: req.ip,
    });

    res.json({ success: true, schoolYear: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id/terms', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const yearId = parseInt(req.params.id);
    const yearTerms = await db.select().from(terms).where(eq(terms.schoolYearId, yearId)).orderBy(terms.startDate);
    res.json({ success: true, terms: yearTerms });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/terms', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const yearId = parseInt(req.params.id);
    const { name, startDate, endDate } = req.body;
    if (!name || !startDate || !endDate) {
      return res.status(400).json({ success: false, error: 'Name, start date, and end date are required' });
    }
    const [term] = await db.insert(terms).values({
      schoolYearId: yearId,
      name,
      startDate,
      endDate,
    }).returning();

    await logAudit({
      userId: req.user.id,
      action: 'create',
      entityType: 'term',
      entityId: term.id,
      details: { name, schoolYearId: yearId },
      ipAddress: req.ip,
    });

    res.json({ success: true, term });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.patch('/terms/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, startDate, endDate } = req.body;
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (startDate !== undefined) updateData.startDate = startDate;
    if (endDate !== undefined) updateData.endDate = endDate;

    const [updated] = await db.update(terms).set(updateData).where(eq(terms.id, id)).returning();
    if (!updated) return res.status(404).json({ success: false, error: 'Term not found' });

    await logAudit({
      userId: req.user.id,
      action: 'update',
      entityType: 'term',
      entityId: id,
      details: updateData,
      ipAddress: req.ip,
    });

    res.json({ success: true, term: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
