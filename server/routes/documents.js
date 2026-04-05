import { Router } from 'express';
import { eq, desc, and } from 'drizzle-orm';
import db from '../db-postgres.js';
import { documents, users } from '../schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { canAccessStudent } from '../middleware/scope.js';
import { logAudit } from '../services/audit.service.js';

const router = Router();

router.get('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const result = await db.select({
      id: documents.id,
      entityType: documents.entityType,
      entityId: documents.entityId,
      category: documents.category,
      fileName: documents.fileName,
      filePath: documents.filePath,
      uploadedAt: documents.uploadedAt,
      uploaderFirstName: users.firstName,
      uploaderLastName: users.lastName,
    }).from(documents)
      .leftJoin(users, eq(documents.uploadedBy, users.id))
      .orderBy(desc(documents.uploadedAt));
    res.json({ success: true, documents: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/entity/:entityType/:entityId', requireAuth, async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const eid = parseInt(entityId);

    if (req.user.role !== 'admin') {
      if (entityType === 'student') {
        if (!await canAccessStudent(req.user, eid)) {
          return res.status(403).json({ success: false, error: 'Not authorized' });
        }
      } else {
        return res.status(403).json({ success: false, error: 'Only admins can view non-student documents' });
      }
    }

    const result = await db.select({
      id: documents.id,
      entityType: documents.entityType,
      entityId: documents.entityId,
      category: documents.category,
      fileName: documents.fileName,
      filePath: documents.filePath,
      uploadedAt: documents.uploadedAt,
      uploaderFirstName: users.firstName,
      uploaderLastName: users.lastName,
    }).from(documents)
      .leftJoin(users, eq(documents.uploadedBy, users.id))
      .where(and(eq(documents.entityType, entityType), eq(documents.entityId, eid)))
      .orderBy(desc(documents.uploadedAt));
    res.json({ success: true, documents: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { entityType, entityId, category, fileName, filePath } = req.body;
    if (!entityType || !entityId || !fileName || !filePath) {
      return res.status(400).json({ success: false, error: 'Entity type, entity ID, file name, and file path are required' });
    }

    const [doc] = await db.insert(documents).values({
      entityType,
      entityId: parseInt(entityId),
      category: category || null,
      fileName: fileName.trim(),
      filePath: filePath.trim(),
      uploadedBy: req.user.id,
    }).returning();

    await logAudit({
      userId: req.user.id,
      action: 'create',
      entityType: 'document',
      entityId: doc.id,
      details: { entityType, entityId, fileName },
      ipAddress: req.ip,
    });

    res.json({ success: true, document: doc });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(documents).where(eq(documents.id, id));

    await logAudit({
      userId: req.user.id,
      action: 'delete',
      entityType: 'document',
      entityId: id,
      ipAddress: req.ip,
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
