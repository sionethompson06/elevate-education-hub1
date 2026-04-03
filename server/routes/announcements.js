import { Router } from 'express';
import { eq, desc, or, and } from 'drizzle-orm';
import db from '../db-postgres.js';
import { announcements, users, enrollments, programs } from '../schema.js';
import { requireAuth } from '../middleware/auth.js';
import { logAudit } from '../services/audit.service.js';
import { createNotification } from '../services/notification.service.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    let result;
    if (req.user.role === 'admin') {
      result = await db.select({
        id: announcements.id,
        authorUserId: announcements.authorUserId,
        title: announcements.title,
        body: announcements.body,
        targetRole: announcements.targetRole,
        targetProgramId: announcements.targetProgramId,
        status: announcements.status,
        publishedAt: announcements.publishedAt,
        createdAt: announcements.createdAt,
        authorFirstName: users.firstName,
        authorLastName: users.lastName,
      }).from(announcements)
        .leftJoin(users, eq(announcements.authorUserId, users.id))
        .orderBy(desc(announcements.createdAt));
    } else {
      const roleMap = {
        parent: 'parent',
        student: 'student',
        academic_coach: 'coach',
        performance_coach: 'coach',
      };
      const userRole = roleMap[req.user.role] || req.user.role;
      result = await db.select({
        id: announcements.id,
        authorUserId: announcements.authorUserId,
        title: announcements.title,
        body: announcements.body,
        targetRole: announcements.targetRole,
        targetProgramId: announcements.targetProgramId,
        status: announcements.status,
        publishedAt: announcements.publishedAt,
        createdAt: announcements.createdAt,
        authorFirstName: users.firstName,
        authorLastName: users.lastName,
      }).from(announcements)
        .leftJoin(users, eq(announcements.authorUserId, users.id))
        .where(eq(announcements.status, 'published'))
        .orderBy(desc(announcements.publishedAt));

      result = result.filter(a =>
        a.targetRole === 'all' || a.targetRole === userRole || a.targetRole === req.user.role
      );
    }
    res.json({ success: true, announcements: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const allowedRoles = ['admin'];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Only admins can create announcements' });
    }

    const { title, body, targetRole, targetProgramId, status } = req.body;
    if (!title || !body) {
      return res.status(400).json({ success: false, error: 'Title and body are required' });
    }

    const validTargets = ['all', 'parent', 'student', 'coach', 'admin', 'academic_coach', 'performance_coach'];
    if (targetRole && !validTargets.includes(targetRole)) {
      return res.status(400).json({ success: false, error: 'Invalid target role' });
    }

    const [ann] = await db.insert(announcements).values({
      authorUserId: req.user.id,
      title: title.trim(),
      body: body.trim(),
      targetRole: targetRole || 'all',
      targetProgramId: targetProgramId ? parseInt(targetProgramId) : null,
      status: status || 'draft',
      publishedAt: status === 'published' ? new Date() : null,
    }).returning();

    if (status === 'published') {
      await notifyAnnouncementTargets(ann);
    }

    await logAudit({
      userId: req.user.id,
      action: 'create',
      entityType: 'announcement',
      entityId: ann.id,
      details: { title, targetRole: ann.targetRole, status: ann.status },
      ipAddress: req.ip,
    });

    res.json({ success: true, announcement: ann });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.patch('/:id', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Only admins can update announcements' });
    }

    const id = parseInt(req.params.id);
    const [existing] = await db.select().from(announcements).where(eq(announcements.id, id));
    if (!existing) return res.status(404).json({ success: false, error: 'Announcement not found' });

    const { title, body, targetRole, targetProgramId, status } = req.body;
    const updateData = {};
    if (title !== undefined) updateData.title = title.trim();
    if (body !== undefined) updateData.body = body.trim();
    if (targetRole !== undefined) updateData.targetRole = targetRole;
    if (targetProgramId !== undefined) updateData.targetProgramId = targetProgramId ? parseInt(targetProgramId) : null;
    if (status !== undefined) {
      updateData.status = status;
      if (status === 'published' && existing.status !== 'published') {
        updateData.publishedAt = new Date();
      }
    }

    const [updated] = await db.update(announcements).set(updateData).where(eq(announcements.id, id)).returning();

    if (status === 'published' && existing.status !== 'published') {
      await notifyAnnouncementTargets(updated);
    }

    await logAudit({
      userId: req.user.id,
      action: 'update',
      entityType: 'announcement',
      entityId: id,
      details: updateData,
      ipAddress: req.ip,
    });

    res.json({ success: true, announcement: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Only admins can delete announcements' });
    }
    const id = parseInt(req.params.id);
    await db.delete(announcements).where(eq(announcements.id, id));
    await logAudit({
      userId: req.user.id,
      action: 'delete',
      entityType: 'announcement',
      entityId: id,
      ipAddress: req.ip,
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

async function notifyAnnouncementTargets(ann) {
  try {
    let targetUsers = [];
    const allUsers = await db.select({ id: users.id, role: users.role }).from(users).where(eq(users.status, 'active'));

    if (ann.targetRole === 'all') {
      targetUsers = allUsers;
    } else if (ann.targetRole === 'coach') {
      targetUsers = allUsers.filter(u => u.role === 'academic_coach' || u.role === 'performance_coach');
    } else {
      targetUsers = allUsers.filter(u => u.role === ann.targetRole);
    }

    targetUsers = targetUsers.filter(u => u.id !== ann.authorUserId);

    for (const u of targetUsers) {
      await createNotification({
        userId: u.id,
        type: 'announcement',
        title: 'New announcement',
        body: ann.title,
        link: '/hub/announcements',
      });
    }
  } catch (err) {
    console.error('Failed to notify announcement targets:', err.message);
  }
}

export default router;
