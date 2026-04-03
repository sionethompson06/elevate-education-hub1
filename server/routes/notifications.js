import { Router } from 'express';
import { eq, desc, and } from 'drizzle-orm';
import db from '../db-postgres.js';
import { notifications } from '../schema.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await db.select().from(notifications)
      .where(eq(notifications.userId, req.user.id))
      .orderBy(desc(notifications.createdAt));
    const unreadCount = result.filter(n => !n.isRead).length;
    res.json({ success: true, notifications: result.slice(0, 50), unreadCount });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/unread-count', requireAuth, async (req, res) => {
  try {
    const result = await db.select().from(notifications)
      .where(and(eq(notifications.userId, req.user.id), eq(notifications.isRead, false)));
    res.json({ success: true, count: result.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.patch('/:id/read', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [notif] = await db.select().from(notifications).where(eq(notifications.id, id));
    if (!notif) return res.status(404).json({ success: false, error: 'Notification not found' });
    if (notif.userId !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Not your notification' });
    }
    const [updated] = await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id)).returning();
    res.json({ success: true, notification: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/mark-all-read', requireAuth, async (req, res) => {
  try {
    await db.update(notifications).set({ isRead: true })
      .where(and(eq(notifications.userId, req.user.id), eq(notifications.isRead, false)));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
