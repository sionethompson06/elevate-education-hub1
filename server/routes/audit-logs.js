import { Router } from 'express';
import { desc, eq } from 'drizzle-orm';
import db from '../db-postgres.js';
import { auditLogs, users } from '../schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const rows = await db.select({
      id: auditLogs.id,
      userId: auditLogs.userId,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      details: auditLogs.details,
      ipAddress: auditLogs.ipAddress,
      timestamp: auditLogs.timestamp,
      userEmail: users.email,
      userRole: users.role,
    }).from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .orderBy(desc(auditLogs.timestamp))
      .limit(200);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
    res.json({ success: true });
  }
});

export default router;
