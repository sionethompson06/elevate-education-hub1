import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import db from '../db-postgres.js';
import { eq } from 'drizzle-orm';
import { cmsContent } from '../schema.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const rows = await db.select().from(cmsContent);
    res.json(rows);
  } catch {
    res.json([]);
  }
});

router.get('/:key', async (req, res) => {
  try {
    const [row] = await db.select().from(cmsContent).where(eq(cmsContent.key, req.params.key));
    res.json(row || null);
  } catch {
    res.json(null);
  }
});

router.put('/:key', requireAuth, requireRole('admin'), async (req, res) => {
  const { title, body, section } = req.body;
  try {
    const existing = await db.select().from(cmsContent).where(eq(cmsContent.key, req.params.key));
    if (existing.length) {
      const [updated] = await db.update(cmsContent).set({ title, body, section, updatedAt: new Date() })
        .where(eq(cmsContent.key, req.params.key)).returning();
      return res.json(updated);
    }
    const [created] = await db.insert(cmsContent).values({ key: req.params.key, title, body, section }).returning();
    res.json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
