import { Router } from 'express';
import { eq, desc, and } from 'drizzle-orm';
import db from '../db-postgres.js';
import { sections, programs, sectionStudents, students, enrollments } from '../schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { logAudit } from '../services/audit.service.js';

const router = Router();

router.get('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { programId } = req.query;
    let query = db.select({
      id: sections.id,
      programId: sections.programId,
      termId: sections.termId,
      name: sections.name,
      schedule: sections.schedule,
      capacity: sections.capacity,
      room: sections.room,
      status: sections.status,
      createdAt: sections.createdAt,
      programName: programs.name,
    }).from(sections)
      .leftJoin(programs, eq(sections.programId, programs.id))
      .orderBy(desc(sections.createdAt));

    let result = await query;
    if (programId) {
      result = result.filter(s => s.programId === parseInt(programId));
    }
    res.json({ success: true, sections: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const [section] = await db.select().from(sections).where(eq(sections.id, parseInt(req.params.id)));
    if (!section) return res.status(404).json({ success: false, error: 'Section not found' });

    const enrolled = await db.select({
      id: sectionStudents.id,
      studentId: sectionStudents.studentId,
      enrolledDate: sectionStudents.enrolledDate,
      firstName: students.firstName,
      lastName: students.lastName,
      grade: students.grade,
    }).from(sectionStudents)
      .innerJoin(students, eq(sectionStudents.studentId, students.id))
      .where(eq(sectionStudents.sectionId, section.id));

    res.json({ success: true, section, students: enrolled });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { programId, termId, name, schedule, capacity, room, status } = req.body;
    if (!programId || !name) {
      return res.status(400).json({ success: false, error: 'Program and name are required' });
    }
    const [section] = await db.insert(sections).values({
      programId: parseInt(programId),
      termId: termId ? parseInt(termId) : null,
      name: name.trim(),
      schedule: schedule || null,
      capacity: capacity ? parseInt(capacity) : 20,
      room: room || null,
      status: status || 'active',
    }).returning();

    await logAudit({
      userId: req.user.id,
      action: 'create',
      entityType: 'section',
      entityId: section.id,
      details: { name, programId },
      ipAddress: req.ip,
    });

    res.json({ success: true, section });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.patch('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, schedule, capacity, room, status, termId } = req.body;
    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (schedule !== undefined) updateData.schedule = schedule;
    if (capacity !== undefined) updateData.capacity = parseInt(capacity);
    if (room !== undefined) updateData.room = room;
    if (status !== undefined) updateData.status = status;
    if (termId !== undefined) updateData.termId = termId ? parseInt(termId) : null;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    const [updated] = await db.update(sections).set(updateData).where(eq(sections.id, id)).returning();
    if (!updated) return res.status(404).json({ success: false, error: 'Section not found' });

    await logAudit({
      userId: req.user.id,
      action: 'update',
      entityType: 'section',
      entityId: id,
      details: updateData,
      ipAddress: req.ip,
    });

    res.json({ success: true, section: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(sectionStudents).where(eq(sectionStudents.sectionId, id));
    await db.delete(sections).where(eq(sections.id, id));
    await logAudit({
      userId: req.user.id,
      action: 'delete',
      entityType: 'section',
      entityId: id,
      ipAddress: req.ip,
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/students', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const sectionId = parseInt(req.params.id);
    const { studentId } = req.body;
    if (!studentId) {
      return res.status(400).json({ success: false, error: 'Student ID is required' });
    }

    const existing = await db.select().from(sectionStudents)
      .where(and(eq(sectionStudents.sectionId, sectionId), eq(sectionStudents.studentId, parseInt(studentId))));
    if (existing.length > 0) {
      return res.status(400).json({ success: false, error: 'Student already placed in this section' });
    }

    const [section] = await db.select().from(sections).where(eq(sections.id, sectionId));
    if (!section) return res.status(404).json({ success: false, error: 'Section not found' });

    const enrollmentCheck = await db.select().from(enrollments)
      .where(and(
        eq(enrollments.studentId, parseInt(studentId)),
        eq(enrollments.programId, section.programId)
      ));
    if (enrollmentCheck.length === 0) {
      return res.status(400).json({ success: false, error: 'Student must be enrolled in the program before section placement' });
    }

    const [placement] = await db.insert(sectionStudents).values({
      sectionId,
      studentId: parseInt(studentId),
    }).returning();

    await db.update(enrollments).set({ sectionId })
      .where(and(
        eq(enrollments.studentId, parseInt(studentId)),
        eq(enrollments.programId, section.programId)
      ));

    await logAudit({
      userId: req.user.id,
      action: 'create',
      entityType: 'section_student',
      entityId: placement.id,
      details: { sectionId, studentId },
      ipAddress: req.ip,
    });

    res.json({ success: true, placement });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/:sectionId/students/:studentId', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const sectionId = parseInt(req.params.sectionId);
    const studentId = parseInt(req.params.studentId);
    await db.delete(sectionStudents)
      .where(and(eq(sectionStudents.sectionId, sectionId), eq(sectionStudents.studentId, studentId)));

    await logAudit({
      userId: req.user.id,
      action: 'delete',
      entityType: 'section_student',
      entityId: `${sectionId}-${studentId}`,
      details: { sectionId, studentId },
      ipAddress: req.ip,
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
