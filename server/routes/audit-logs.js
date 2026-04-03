import { Router } from 'express';
import { desc } from 'drizzle-orm';
import db from '../db-postgres.js';
import { auditLogs } from '../schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// GET /api/audit-logs — admin only
router.get('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const rows = await db.select().from(auditLogs).orderBy(desc(auditLogs.timestamp)).limit(200);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/audit-logs — log an access denial (called by RBACGuard)
router.post('/', requireAuth, async (req, res) => {
  try {
    const { action, entityType, entityId, details } = req.body;
    await db.insert(auditLogs).values({
      userId: req.user.id,
      action: action || 'denied',
      entityType: entityType || 'route',
      entityId: String(entityId || ''),
      details: details || null,
      ipAddress: req.ip,
    });
    res.json({ success: true });
  } catch {
    res.json({ success: true }); // non-critical
  }
});

export default router;
