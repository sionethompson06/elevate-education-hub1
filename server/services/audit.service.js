import db from '../db-postgres.js';
import { auditLogs } from '../schema.js';

export async function logAudit({ userId = null, action, entityType, entityId = null, details = null, ipAddress = null }) {
  try {
    await db.insert(auditLogs).values({
      userId,
      action,
      entityType,
      entityId: entityId ? String(entityId) : null,
      details,
      ipAddress,
    });
  } catch (err) {
    console.error('Audit log error:', err.message);
  }
}
