import { Router } from 'express';
import { eq, desc, and, or } from 'drizzle-orm';
import db from '../db-postgres.js';
import { resources, resourceAssignments, users, sectionStudents, enrollments, students, guardianStudents } from '../schema.js';
import { requireAuth } from '../middleware/auth.js';
import { canAccessStudent, getCoachSectionIds, getCoachStudentIds } from '../middleware/scope.js';
import { logAudit } from '../services/audit.service.js';
import { createNotification } from '../services/notification.service.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin only' });
    }
    const result = await db.select({
      id: resources.id,
      title: resources.title,
      description: resources.description,
      type: resources.type,
      filePath: resources.filePath,
      externalUrl: resources.externalUrl,
      subjectArea: resources.subjectArea,
      tags: resources.tags,
      status: resources.status,
      createdAt: resources.createdAt,
      uploaderFirstName: users.firstName,
      uploaderLastName: users.lastName,
    }).from(resources)
      .leftJoin(users, eq(resources.uploadedBy, users.id))
      .orderBy(desc(resources.createdAt));
    res.json({ success: true, resources: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/my', requireAuth, async (req, res) => {
  try {
    let assignedResources = [];

    const roleAssignments = await db.select().from(resourceAssignments)
      .where(and(eq(resourceAssignments.targetType, 'role'), eq(resourceAssignments.targetId, 0)));
    const allRoleAssignments = await db.select().from(resourceAssignments)
      .where(eq(resourceAssignments.targetType, 'role'));

    let relevantAssignmentIds = new Set();

    if (req.user.role === 'student') {
      const [studentRec] = await db.select().from(students).where(eq(students.userId, req.user.id));
      if (studentRec) {
        const studentAssignments = await db.select().from(resourceAssignments)
          .where(and(eq(resourceAssignments.targetType, 'student'), eq(resourceAssignments.targetId, studentRec.id)));
        studentAssignments.forEach(a => relevantAssignmentIds.add(a.resourceId));

        const mySections = await db.select().from(sectionStudents).where(eq(sectionStudents.studentId, studentRec.id));
        for (const sec of mySections) {
          const secAssignments = await db.select().from(resourceAssignments)
            .where(and(eq(resourceAssignments.targetType, 'section'), eq(resourceAssignments.targetId, sec.sectionId)));
          secAssignments.forEach(a => relevantAssignmentIds.add(a.resourceId));
        }

        const myEnrollments = await db.select().from(enrollments).where(eq(enrollments.studentId, studentRec.id));
        for (const enr of myEnrollments) {
          const progAssignments = await db.select().from(resourceAssignments)
            .where(and(eq(resourceAssignments.targetType, 'program'), eq(resourceAssignments.targetId, enr.programId)));
          progAssignments.forEach(a => relevantAssignmentIds.add(a.resourceId));
        }
      }
    } else if (req.user.role === 'parent') {
      const guardianLinks = await db.select().from(guardianStudents)
        .where(eq(guardianStudents.guardianUserId, req.user.id));
      for (const gl of guardianLinks) {
        const studentAssignments = await db.select().from(resourceAssignments)
          .where(and(eq(resourceAssignments.targetType, 'student'), eq(resourceAssignments.targetId, gl.studentId)));
        studentAssignments.forEach(a => relevantAssignmentIds.add(a.resourceId));

        const mySections = await db.select().from(sectionStudents).where(eq(sectionStudents.studentId, gl.studentId));
        for (const sec of mySections) {
          const secAssignments = await db.select().from(resourceAssignments)
            .where(and(eq(resourceAssignments.targetType, 'section'), eq(resourceAssignments.targetId, sec.sectionId)));
          secAssignments.forEach(a => relevantAssignmentIds.add(a.resourceId));
        }

        const myEnrollments = await db.select().from(enrollments).where(eq(enrollments.studentId, gl.studentId));
        for (const enr of myEnrollments) {
          const progAssignments = await db.select().from(resourceAssignments)
            .where(and(eq(resourceAssignments.targetType, 'program'), eq(resourceAssignments.targetId, enr.programId)));
          progAssignments.forEach(a => relevantAssignmentIds.add(a.resourceId));
        }
      }
    } else if (req.user.role === 'academic_coach' || req.user.role === 'performance_coach') {
      const sectionIds = await getCoachSectionIds(req.user.id);
      for (const secId of sectionIds) {
        const secAssignments = await db.select().from(resourceAssignments)
          .where(and(eq(resourceAssignments.targetType, 'section'), eq(resourceAssignments.targetId, secId)));
        secAssignments.forEach(a => relevantAssignmentIds.add(a.resourceId));
      }
      const studentIds = await getCoachStudentIds(req.user.id);
      for (const sid of studentIds) {
        const studentAssignments = await db.select().from(resourceAssignments)
          .where(and(eq(resourceAssignments.targetType, 'student'), eq(resourceAssignments.targetId, sid)));
        studentAssignments.forEach(a => relevantAssignmentIds.add(a.resourceId));
      }
    }

    if (relevantAssignmentIds.size > 0) {
      for (const rid of relevantAssignmentIds) {
        const [res] = await db.select().from(resources).where(and(eq(resources.id, rid), eq(resources.status, 'active')));
        if (res) assignedResources.push(res);
      }
    }

    res.json({ success: true, resources: assignedResources });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const allowedRoles = ['admin', 'academic_coach', 'performance_coach'];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Not authorized to create resources' });
    }

    const { title, description, type, filePath, externalUrl, subjectArea, tags } = req.body;
    if (!title) return res.status(400).json({ success: false, error: 'Title is required' });

    const validTypes = ['document', 'video', 'link'];
    if (type && !validTypes.includes(type)) {
      return res.status(400).json({ success: false, error: 'Type must be document, video, or link' });
    }

    const [resource] = await db.insert(resources).values({
      title: title.trim(),
      description: description?.trim() || null,
      type: type || 'document',
      filePath: filePath || null,
      externalUrl: externalUrl || null,
      subjectArea: subjectArea || null,
      tags: tags || null,
      uploadedBy: req.user.id,
    }).returning();

    await logAudit({
      userId: req.user.id,
      action: 'create',
      entityType: 'resource',
      entityId: resource.id,
      details: { title, type: resource.type },
      ipAddress: req.ip,
    });

    res.json({ success: true, resource });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [existing] = await db.select().from(resources).where(eq(resources.id, id));
    if (!existing) return res.status(404).json({ success: false, error: 'Resource not found' });

    if (req.user.role !== 'admin' && existing.uploadedBy !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Can only edit your own resources' });
    }

    const { title, description, type, filePath, externalUrl, subjectArea, tags, status } = req.body;
    const updateData = {};
    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (type !== undefined) updateData.type = type;
    if (filePath !== undefined) updateData.filePath = filePath;
    if (externalUrl !== undefined) updateData.externalUrl = externalUrl;
    if (subjectArea !== undefined) updateData.subjectArea = subjectArea;
    if (tags !== undefined) updateData.tags = tags;
    if (status !== undefined) updateData.status = status;

    const [updated] = await db.update(resources).set(updateData).where(eq(resources.id, id)).returning();

    await logAudit({
      userId: req.user.id,
      action: 'update',
      entityType: 'resource',
      entityId: id,
      details: updateData,
      ipAddress: req.ip,
    });

    res.json({ success: true, resource: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Only admins can delete resources' });
    }
    const id = parseInt(req.params.id);
    await db.delete(resourceAssignments).where(eq(resourceAssignments.resourceId, id));
    await db.delete(resources).where(eq(resources.id, id));

    await logAudit({
      userId: req.user.id,
      action: 'delete',
      entityType: 'resource',
      entityId: id,
      ipAddress: req.ip,
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id/assignments', requireAuth, async (req, res) => {
  try {
    const allowedRoles = ['admin', 'academic_coach', 'performance_coach'];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    const id = parseInt(req.params.id);
    const result = await db.select().from(resourceAssignments)
      .where(eq(resourceAssignments.resourceId, id));

    if (req.user.role !== 'admin') {
      const coachSectionIds = await getCoachSectionIds(req.user.id);
      const coachStudentIds = await getCoachStudentIds(req.user.id);
      const filtered = result.filter(a => {
        if (a.targetType === 'student') return coachStudentIds.includes(a.targetId);
        if (a.targetType === 'section') return coachSectionIds.includes(a.targetId);
        return false;
      });
      return res.json({ success: true, assignments: filtered });
    }

    res.json({ success: true, assignments: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/assign', requireAuth, async (req, res) => {
  try {
    const allowedRoles = ['admin', 'academic_coach', 'performance_coach'];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    const resourceId = parseInt(req.params.id);
    const { targetType, targetId, isRequired } = req.body;
    if (!targetType || targetId === undefined) {
      return res.status(400).json({ success: false, error: 'Target type and ID are required' });
    }

    const validTargetTypes = ['student', 'section', 'program', 'role'];
    if (!validTargetTypes.includes(targetType)) {
      return res.status(400).json({ success: false, error: 'Target type must be student, section, program, or role' });
    }

    if (req.user.role !== 'admin') {
      if (targetType === 'student') {
        const coachStudentIds = await getCoachStudentIds(req.user.id);
        if (!coachStudentIds.includes(parseInt(targetId))) {
          return res.status(403).json({ success: false, error: 'You can only assign resources to students in your sections' });
        }
      } else if (targetType === 'section') {
        const sectionIds = await getCoachSectionIds(req.user.id);
        if (!sectionIds.includes(parseInt(targetId))) {
          return res.status(403).json({ success: false, error: 'You can only assign resources to your sections' });
        }
      } else if (targetType === 'program' || targetType === 'role') {
        return res.status(403).json({ success: false, error: 'Only admins can assign resources to programs or roles' });
      }
    }

    const [assignment] = await db.insert(resourceAssignments).values({
      resourceId,
      targetType,
      targetId: parseInt(targetId),
      assignedBy: req.user.id,
      isRequired: isRequired || false,
    }).returning();

    if (targetType === 'student') {
      try {
        const [student] = await db.select().from(students).where(eq(students.id, parseInt(targetId)));
        if (student && student.userId) {
          await createNotification({
            userId: student.userId,
            type: 'resource_assigned',
            title: 'New Resource Assigned',
            body: `A new resource has been assigned to you.`,
          });
        }
      } catch (notifErr) { console.error('Notification error:', notifErr); }
    }

    await logAudit({
      userId: req.user.id,
      action: 'create',
      entityType: 'resource_assignment',
      entityId: assignment.id,
      details: { resourceId, targetType, targetId },
      ipAddress: req.ip,
    });

    res.json({ success: true, assignment });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/assignments/:assignmentId', requireAuth, async (req, res) => {
  try {
    const allowedRoles = ['admin', 'academic_coach', 'performance_coach'];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    const id = parseInt(req.params.assignmentId);

    if (req.user.role !== 'admin') {
      const [assignment] = await db.select().from(resourceAssignments).where(eq(resourceAssignments.id, id));
      if (!assignment) return res.status(404).json({ success: false, error: 'Assignment not found' });
      const coachSectionIds = await getCoachSectionIds(req.user.id);
      const coachStudentIds = await getCoachStudentIds(req.user.id);
      const allowed = (assignment.targetType === 'student' && coachStudentIds.includes(assignment.targetId))
        || (assignment.targetType === 'section' && coachSectionIds.includes(assignment.targetId));
      if (!allowed) return res.status(403).json({ success: false, error: 'Cannot delete assignments outside your scope' });
    }

    await db.delete(resourceAssignments).where(eq(resourceAssignments.id, id));
    await logAudit({
      userId: req.user.id,
      action: 'delete',
      entityType: 'resource_assignment',
      entityId: id,
      ipAddress: req.ip,
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
