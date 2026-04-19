import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import db from '../db-postgres.js';
import { eq, desc } from 'drizzle-orm';
import { rewardCatalog, studentPoints, pointTransactions, rewardRedemptions, students, studentGoals } from '../schema.js';

const router = Router();

router.get('/catalog', requireAuth, async (req, res) => {
  try {
    const items = await db.select().from(rewardCatalog).where(eq(rewardCatalog.isActive, true));
    res.json(items);
  } catch {
    res.json([]);
  }
});

router.get('/points/:studentId', requireAuth, async (req, res) => {
  try {
    const [row] = await db.select().from(studentPoints).where(eq(studentPoints.studentId, Number(req.params.studentId)));
    res.json(row || { studentId: Number(req.params.studentId), points: 0 });
  } catch {
    res.json({ studentId: Number(req.params.studentId), points: 0 });
  }
});

// GET /rewards/transactions — admin: all recent transactions with student info
router.get('/transactions', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const rows = await db.select({
      id: pointTransactions.id,
      studentId: pointTransactions.studentId,
      delta: pointTransactions.delta,
      reason: pointTransactions.reason,
      awardedBy: pointTransactions.awardedBy,
      createdAt: pointTransactions.createdAt,
      studentFirstName: students.firstName,
      studentLastName: students.lastName,
    }).from(pointTransactions)
      .leftJoin(students, eq(pointTransactions.studentId, students.id))
      .orderBy(desc(pointTransactions.createdAt))
      .limit(100);
    res.json(rows.map(r => ({
      ...r,
      student_name: `${r.studentFirstName || ''} ${r.studentLastName || ''}`.trim(),
      points: r.delta,
      awarded_at: r.createdAt,
    })));
  } catch {
    res.json([]);
  }
});

router.get('/transactions/:studentId', requireAuth, async (req, res) => {
  try {
    const rows = await db.select().from(pointTransactions)
      .where(eq(pointTransactions.studentId, Number(req.params.studentId)))
      .orderBy(desc(pointTransactions.createdAt));
    res.json(rows);
  } catch {
    res.json([]);
  }
});

// GET /rewards/redemptions — admin: all redemptions with student + item info
router.get('/redemptions', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { status } = req.query;
    const base = db.select({
      id: rewardRedemptions.id,
      studentId: rewardRedemptions.studentId,
      catalogItemId: rewardRedemptions.catalogItemId,
      pointsCost: rewardRedemptions.pointsCost,
      status: rewardRedemptions.status,
      reviewNotes: rewardRedemptions.reviewNotes,
      createdAt: rewardRedemptions.createdAt,
      studentFirstName: students.firstName,
      studentLastName: students.lastName,
      itemName: rewardCatalog.name,
    }).from(rewardRedemptions)
      .leftJoin(students, eq(rewardRedemptions.studentId, students.id))
      .leftJoin(rewardCatalog, eq(rewardRedemptions.catalogItemId, rewardCatalog.id))
      .orderBy(desc(rewardRedemptions.createdAt));

    const rows = status
      ? await base.where(eq(rewardRedemptions.status, status))
      : await base;

    res.json(rows.map(r => ({
      ...r,
      student_name: `${r.studentFirstName || ''} ${r.studentLastName || ''}`.trim(),
      item_name: r.itemName,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /rewards/redemptions/:id — admin approve/deny
router.patch('/redemptions/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status, reviewNotes } = req.body;
    const [updated] = await db.update(rewardRedemptions)
      .set({ status, reviewNotes: reviewNotes || null, reviewedBy: req.user.id })
      .where(eq(rewardRedemptions.id, id)).returning();
    res.json({ success: true, redemption: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/award', requireAuth, requireRole('admin', 'academic_coach', 'performance_coach'), async (req, res) => {
  const { studentId, points, reason } = req.body;
  if (!studentId || !points) return res.status(400).json({ error: 'studentId and points required' });
  try {
    await db.insert(pointTransactions).values({
      studentId: Number(studentId),
      delta: Number(points),
      reason: reason || 'Award',
      awardedBy: req.user.id,
    });
    const [existing] = await db.select().from(studentPoints).where(eq(studentPoints.studentId, Number(studentId)));
    if (existing) {
      await db.update(studentPoints).set({ points: existing.points + Number(points), updatedAt: new Date() })
        .where(eq(studentPoints.studentId, Number(studentId)));
    } else {
      await db.insert(studentPoints).values({ studentId: Number(studentId), points: Number(points) });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/redeem', requireAuth, async (req, res) => {
  const { studentId, catalogItemId } = req.body;
  if (!studentId || !catalogItemId) return res.status(400).json({ error: 'studentId and catalogItemId required' });
  try {
    const [item] = await db.select().from(rewardCatalog).where(eq(rewardCatalog.id, Number(catalogItemId)));
    if (!item) return res.status(404).json({ error: 'Item not found' });

    const [pts] = await db.select().from(studentPoints).where(eq(studentPoints.studentId, Number(studentId)));
    const currentPts = pts?.points ?? 0;
    if (currentPts < item.pointCost) return res.status(400).json({ error: 'Insufficient points' });

    if (pts) {
      await db.update(studentPoints).set({ points: currentPts - item.pointCost, updatedAt: new Date() })
        .where(eq(studentPoints.studentId, Number(studentId)));
    }

    await db.insert(pointTransactions).values({
      studentId: Number(studentId),
      delta: -item.pointCost,
      reason: `Redeemed: ${item.name}`,
    });

    await db.insert(rewardRedemptions).values({
      studentId: Number(studentId),
      catalogItemId: Number(catalogItemId),
      pointsCost: item.pointCost,
      status: 'pending',
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /rewards/catalog — admin create catalog item
router.post('/catalog', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { name, description, pointCost } = req.body;
    if (!name || !pointCost) return res.status(400).json({ error: 'name and pointCost required' });
    const [item] = await db.insert(rewardCatalog).values({
      name, description: description || '', pointCost: Number(pointCost), isActive: true,
    }).returning();
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /rewards/catalog/:id — admin update catalog item
router.patch('/catalog/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, description, pointCost, isActive } = req.body;
    const update = {};
    if (name !== undefined) update.name = name;
    if (description !== undefined) update.description = description;
    if (pointCost !== undefined) update.pointCost = Number(pointCost);
    if (isActive !== undefined) update.isActive = isActive;
    const [updated] = await db.update(rewardCatalog).set(update).where(eq(rewardCatalog.id, id)).returning();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', requireAuth, async (req, res) => {
  try {
    const catalog = await db.select().from(rewardCatalog);
    res.json(catalog);
  } catch {
    res.json([]);
  }
});

// POST /rewards/goals — create a student goal
router.post('/goals', requireAuth, async (req, res) => {
  try {
    const { studentId, track, title, description, targetPoints } = req.body;
    if (!studentId || !track || !title || !targetPoints) {
      return res.status(400).json({ error: 'studentId, track, title, and targetPoints are required' });
    }
    const [goal] = await db.insert(studentGoals).values({
      studentId: Number(studentId),
      track,
      title,
      targetPoints: Number(targetPoints),
    }).returning();
    res.json({ success: true, goal });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
