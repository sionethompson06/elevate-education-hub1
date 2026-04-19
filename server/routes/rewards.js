import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import db from '../db-postgres.js';
import { eq, desc } from 'drizzle-orm';
import { rewardCatalog, studentPoints, pointTransactions, rewardRedemptions } from '../schema.js';

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
      catalogItemId: Number(catalogItemId),
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

router.get('/', requireAuth, async (req, res) => {
  try {
    const catalog = await db.select().from(rewardCatalog);
    res.json(catalog);
  } catch {
    res.json([]);
  }
});

export default router;
