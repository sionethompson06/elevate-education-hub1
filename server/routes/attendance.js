import { Router } from 'express';
import { eq, desc, and } from 'drizzle-orm';
import db from '../db-postgres.js';
import { attendanceRecords, sectionStudents, sections, students } from '../schema.js';
import { requireAuth } from '../middleware/auth.js';
import { canAccessStudent, getCoachSectionIds, isStudentInSection } from '../middleware/scope.js';
import { logAudit } from '../services/audit.service.js';

const router = Router();

router.get('/section/:sectionId', requireAuth, async (req, res) => {
  try {
    const sectionId = parseInt(req.params.sectionId);
    if (req.user.role !== 'admin') {
      const sectionIds = await getCoachSectionIds(req.user.id);
      if (!sectionIds.includes(sectionId)) {
        return res.status(403).json({ success: false, error: 'Not assigned to this section' });
      }
    }
    const { date } = req.query;
    let records;
    if (date) {
      records = await db.select({
        id: attendanceRecords.id,
        studentId: attendanceRecords.studentId,
        sectionId: attendanceRecords.sectionId,
        date: attendanceRecords.date,
        status: attendanceRecords.status,
        notes: attendanceRecords.notes,
        markedBy: attendanceRecords.markedBy,
        firstName: students.firstName,
        lastName: students.lastName,
      }).from(attendanceRecords)
        .leftJoin(students, eq(attendanceRecords.studentId, students.id))
        .where(and(eq(attendanceRecords.sectionId, sectionId), eq(attendanceRecords.date, date)));
    } else {
      records = await db.select({
        id: attendanceRecords.id,
        studentId: attendanceRecords.studentId,
        sectionId: attendanceRecords.sectionId,
        date: attendanceRecords.date,
        status: attendanceRecords.status,
        notes: attendanceRecords.notes,
        markedBy: attendanceRecords.markedBy,
        firstName: students.firstName,
        lastName: students.lastName,
      }).from(attendanceRecords)
        .leftJoin(students, eq(attendanceRecords.studentId, students.id))
        .where(eq(attendanceRecords.sectionId, sectionId))
        .orderBy(desc(attendanceRecords.date));
    }
    res.json({ success: true, records });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/mark', requireAuth, async (req, res) => {
  try {
    const allowedRoles = ['admin', 'academic_coach', 'performance_coach'];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Only coaches and admins can mark attendance' });
    }

    const { sectionId, studentId, date, status, notes } = req.body;
    if (!sectionId || !studentId || !date || !status) {
      return res.status(400).json({ success: false, error: 'Section, student, date, and status are required' });
    }

    const validStatuses = ['present', 'absent', 'tardy', 'excused'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Status must be present, absent, tardy, or excused' });
    }

    if (req.user.role !== 'admin') {
      const sectionIds = await getCoachSectionIds(req.user.id);
      if (!sectionIds.includes(parseInt(sectionId))) {
        return res.status(403).json({ success: false, error: 'Not assigned to this section' });
      }
    }

    if (!await isStudentInSection(parseInt(studentId), parseInt(sectionId))) {
      return res.status(400).json({ success: false, error: 'Student is not in this section roster' });
    }

    const [existing] = await db.select().from(attendanceRecords)
      .where(and(
        eq(attendanceRecords.sectionId, parseInt(sectionId)),
        eq(attendanceRecords.studentId, parseInt(studentId)),
        eq(attendanceRecords.date, date)
      ));

    let record;
    if (existing) {
      [record] = await db.update(attendanceRecords).set({
        status,
        notes: notes || existing.notes,
        markedBy: req.user.id,
      }).where(eq(attendanceRecords.id, existing.id)).returning();

      await logAudit({
        userId: req.user.id,
        action: 'update',
        entityType: 'attendance_record',
        entityId: existing.id,
        details: { sectionId, studentId, date, status },
        ipAddress: req.ip,
      });
    } else {
      [record] = await db.insert(attendanceRecords).values({
        sectionId: parseInt(sectionId),
        studentId: parseInt(studentId),
        date,
        status,
        notes: notes || null,
        markedBy: req.user.id,
      }).returning();

      await logAudit({
        userId: req.user.id,
        action: 'create',
        entityType: 'attendance_record',
        entityId: record.id,
        details: { sectionId, studentId, date, status },
        ipAddress: req.ip,
      });
    }

    res.json({ success: true, record });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/mark-bulk', requireAuth, async (req, res) => {
  try {
    const allowedRoles = ['admin', 'academic_coach', 'performance_coach'];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Only coaches and admins can mark attendance' });
    }

    const { sectionId, date, records: attendanceData } = req.body;
    if (!sectionId || !date || !attendanceData || !Array.isArray(attendanceData)) {
      return res.status(400).json({ success: false, error: 'Section, date, and records array are required' });
    }

    if (req.user.role !== 'admin') {
      const sectionIds = await getCoachSectionIds(req.user.id);
      if (!sectionIds.includes(parseInt(sectionId))) {
        return res.status(403).json({ success: false, error: 'Not assigned to this section' });
      }
    }

    const roster = await db.select().from(sectionStudents)
      .where(eq(sectionStudents.sectionId, parseInt(sectionId)));
    const rosterStudentIds = new Set(roster.map(r => r.studentId));

    const validStatuses = ['present', 'absent', 'tardy', 'excused'];
    const results = [];
    for (const entry of attendanceData) {
      const { studentId, status, notes } = entry;

      if (!validStatuses.includes(status)) continue;
      if (!rosterStudentIds.has(parseInt(studentId))) continue;

      const [existing] = await db.select().from(attendanceRecords)
        .where(and(
          eq(attendanceRecords.sectionId, parseInt(sectionId)),
          eq(attendanceRecords.studentId, parseInt(studentId)),
          eq(attendanceRecords.date, date)
        ));

      let record;
      if (existing) {
        [record] = await db.update(attendanceRecords).set({
          status, notes: notes || null, markedBy: req.user.id,
        }).where(eq(attendanceRecords.id, existing.id)).returning();
      } else {
        [record] = await db.insert(attendanceRecords).values({
          sectionId: parseInt(sectionId),
          studentId: parseInt(studentId),
          date, status, notes: notes || null, markedBy: req.user.id,
        }).returning();
      }
      results.push(record);
    }

    await logAudit({
      userId: req.user.id,
      action: 'create',
      entityType: 'attendance_bulk',
      entityId: sectionId,
      details: { sectionId, date, count: results.length },
      ipAddress: req.ip,
    });

    res.json({ success: true, records: results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/student/:studentId', requireAuth, async (req, res) => {
  try {
    const studentId = parseInt(req.params.studentId);

    if (!await canAccessStudent(req.user, studentId)) {
      return res.status(403).json({ success: false, error: 'Not authorized to view this student' });
    }

    const records = await db.select({
      id: attendanceRecords.id,
      sectionId: attendanceRecords.sectionId,
      date: attendanceRecords.date,
      status: attendanceRecords.status,
      notes: attendanceRecords.notes,
      sectionName: sections.name,
    }).from(attendanceRecords)
      .leftJoin(sections, eq(attendanceRecords.sectionId, sections.id))
      .where(eq(attendanceRecords.studentId, studentId))
      .orderBy(desc(attendanceRecords.date));
    res.json({ success: true, records });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
