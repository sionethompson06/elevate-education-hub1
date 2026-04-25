import { Router } from 'express';
import { eq, desc, asc, and, inArray, isNull, gte, lte } from 'drizzle-orm';
import db from '../db-postgres.js';
import {
  sections, programs, sectionStudents, students, enrollments, classSessions,
  coachAssignments, assignments, assignmentSubmissions,
} from '../schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { logAudit } from '../services/audit.service.js';

const router = Router();
const DAY_LABELS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function normalizeDay(day) {
  if (typeof day === 'number' && day >= 0 && day <= 6) return day;
  if (typeof day !== 'string') return null;
  const idx = DAY_LABELS.indexOf(day.trim().toLowerCase().slice(0, 3));
  return idx >= 0 ? idx : null;
}

function buildDateTime(dateString, timeString) {
  if (!dateString || !timeString) return null;
  const [hours, minutes] = String(timeString).split(':').map((v) => parseInt(v, 10));
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  const dt = new Date(`${dateString}T00:00:00.000Z`);
  dt.setUTCHours(hours, minutes, 0, 0);
  return dt;
}

async function getCoachClassScope(coachUserId) {
  const coachStudentRows = await db.select({
    studentId: coachAssignments.studentId,
  }).from(coachAssignments).where(and(
    eq(coachAssignments.coachUserId, coachUserId),
    eq(coachAssignments.isActive, true)
  ));
  const coachStudentIds = [...new Set(coachStudentRows.map((r) => r.studentId))];
  if (coachStudentIds.length === 0) return { coachStudentIds: [], sectionIds: [] };

  const activePlacements = await db.select({
    sectionId: sectionStudents.sectionId,
  }).from(sectionStudents).where(and(
    inArray(sectionStudents.studentId, coachStudentIds),
    eq(sectionStudents.status, 'active'),
    isNull(sectionStudents.removedAt)
  ));
  const sectionIds = [...new Set(activePlacements.map((r) => r.sectionId))];
  return { coachStudentIds, sectionIds };
}

router.get('/coach/my-classes', requireAuth, requireRole('academic_coach', 'performance_coach'), async (req, res) => {
  try {
    const { coachStudentIds, sectionIds } = await getCoachClassScope(req.user.id);
    if (sectionIds.length === 0) {
      return res.json({ success: true, classes: [] });
    }

    const classes = await db.select({
      id: sections.id,
      name: sections.name,
      termId: sections.termId,
      programId: sections.programId,
      room: sections.room,
      capacity: sections.capacity,
      status: sections.status,
      programName: programs.name,
    }).from(sections)
      .leftJoin(programs, eq(sections.programId, programs.id))
      .where(inArray(sections.id, sectionIds))
      .orderBy(asc(sections.name));

    const activeRoster = await db.select({
      sectionId: sectionStudents.sectionId,
      studentId: sectionStudents.studentId,
    }).from(sectionStudents).where(and(
      inArray(sectionStudents.sectionId, sectionIds),
      eq(sectionStudents.status, 'active'),
      isNull(sectionStudents.removedAt)
    ));

    const upcomingSessions = await db.select({
      sectionId: classSessions.sectionId,
      sessionDate: classSessions.sessionDate,
      startAt: classSessions.startAt,
      status: classSessions.status,
    }).from(classSessions).where(and(
      inArray(classSessions.sectionId, sectionIds),
      gte(classSessions.sessionDate, new Date().toISOString().slice(0, 10))
    )).orderBy(asc(classSessions.sessionDate), asc(classSessions.startAt));

    const rosterBySection = {};
    const myStudentsBySection = {};
    for (const row of activeRoster) {
      rosterBySection[row.sectionId] = (rosterBySection[row.sectionId] || 0) + 1;
      if (coachStudentIds.includes(row.studentId)) {
        myStudentsBySection[row.sectionId] = (myStudentsBySection[row.sectionId] || 0) + 1;
      }
    }
    const nextSessionBySection = {};
    for (const s of upcomingSessions) {
      if (!nextSessionBySection[s.sectionId] && s.status !== 'canceled') {
        nextSessionBySection[s.sectionId] = s;
      }
    }

    const classesWithCounts = classes.map((c) => ({
      ...c,
      rosterCount: rosterBySection[c.id] || 0,
      myStudentCount: myStudentsBySection[c.id] || 0,
      nextSession: nextSessionBySection[c.id] || null,
    }));

    res.json({ success: true, classes: classesWithCounts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/coach/my-classes/:id', requireAuth, requireRole('academic_coach', 'performance_coach'), async (req, res) => {
  try {
    const sectionId = parseInt(req.params.id, 10);
    const { coachStudentIds, sectionIds } = await getCoachClassScope(req.user.id);
    if (!sectionIds.includes(sectionId)) {
      return res.status(403).json({ success: false, error: 'Not assigned to this class' });
    }

    const [section] = await db.select({
      id: sections.id,
      name: sections.name,
      termId: sections.termId,
      room: sections.room,
      capacity: sections.capacity,
      status: sections.status,
      programId: sections.programId,
      programName: programs.name,
    }).from(sections)
      .leftJoin(programs, eq(sections.programId, programs.id))
      .where(eq(sections.id, sectionId));
    if (!section) return res.status(404).json({ success: false, error: 'Class not found' });

    const roster = await db.select({
      studentId: sectionStudents.studentId,
      firstName: students.firstName,
      lastName: students.lastName,
      grade: students.grade,
      placementStatus: sectionStudents.status,
    }).from(sectionStudents)
      .innerJoin(students, eq(sectionStudents.studentId, students.id))
      .where(and(
        eq(sectionStudents.sectionId, sectionId),
        eq(sectionStudents.status, 'active'),
        isNull(sectionStudents.removedAt)
      ))
      .orderBy(asc(students.lastName), asc(students.firstName));

    const sessions = await db.select({
      id: classSessions.id,
      sessionDate: classSessions.sessionDate,
      startAt: classSessions.startAt,
      endAt: classSessions.endAt,
      location: classSessions.location,
      status: classSessions.status,
      canceledReason: classSessions.canceledReason,
    }).from(classSessions)
      .where(eq(classSessions.sectionId, sectionId))
      .orderBy(asc(classSessions.sessionDate), asc(classSessions.startAt));

    const classAssignments = await db.select({
      id: assignments.id,
      title: assignments.title,
      dueDate: assignments.dueDate,
      status: assignments.status,
      maxScore: assignments.maxScore,
      createdAt: assignments.createdAt,
    }).from(assignments)
      .where(eq(assignments.sectionId, sectionId))
      .orderBy(desc(assignments.createdAt));

    const assignmentIds = classAssignments.map((a) => a.id);
    const rosterStudentIds = roster.map((s) => s.studentId);
    const submissions = assignmentIds.length > 0 && rosterStudentIds.length > 0
      ? await db.select({
        assignmentId: assignmentSubmissions.assignmentId,
        studentId: assignmentSubmissions.studentId,
        submissionContent: assignmentSubmissions.submissionContent,
        score: assignmentSubmissions.score,
        feedback: assignmentSubmissions.feedback,
        gradedAt: assignmentSubmissions.gradedAt,
      }).from(assignmentSubmissions).where(and(
        inArray(assignmentSubmissions.assignmentId, assignmentIds),
        inArray(assignmentSubmissions.studentId, rosterStudentIds)
      ))
      : [];

    const subByKey = new Map(submissions.map((s) => [`${s.assignmentId}-${s.studentId}`, s]));
    const progress = { assigned: 0, in_progress: 0, submitted: 0, reviewed: 0 };
    for (const assignment of classAssignments) {
      for (const student of roster) {
        const row = subByKey.get(`${assignment.id}-${student.studentId}`);
        if (!row) {
          progress.assigned++;
          continue;
        }
        if (row.gradedAt || row.score != null || row.feedback?.trim()) {
          progress.reviewed++;
        } else if (row.submissionContent?.trim()) {
          progress.submitted++;
        } else {
          progress.in_progress++;
        }
      }
    }

    const myStudentIds = new Set(coachStudentIds);
    const rosterWithOwnership = roster.map((s) => ({
      ...s,
      assignedToMe: myStudentIds.has(s.studentId),
    }));

    res.json({
      success: true,
      class: section,
      roster: rosterWithOwnership,
      sessions,
      assignments: classAssignments,
      assignmentProgress: progress,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/schedule/overview', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { from, to, termId, programId, status } = req.query;
    const filters = [];
    if (from) filters.push(gte(classSessions.sessionDate, from));
    if (to) filters.push(lte(classSessions.sessionDate, to));
    if (termId) filters.push(eq(sections.termId, parseInt(termId)));
    if (programId) filters.push(eq(sections.programId, parseInt(programId)));
    if (status) filters.push(eq(classSessions.status, status));

    const query = db.select({
      sessionId: classSessions.id,
      sessionDate: classSessions.sessionDate,
      startAt: classSessions.startAt,
      endAt: classSessions.endAt,
      location: classSessions.location,
      status: classSessions.status,
      canceledReason: classSessions.canceledReason,
      notes: classSessions.notes,
      sectionId: sections.id,
      sectionName: sections.name,
      termId: sections.termId,
      room: sections.room,
      programId: sections.programId,
      programName: programs.name,
    }).from(classSessions)
      .innerJoin(sections, eq(classSessions.sectionId, sections.id))
      .leftJoin(programs, eq(sections.programId, programs.id))
      .orderBy(asc(classSessions.sessionDate), asc(classSessions.startAt));

    const sessions = filters.length > 0 ? await query.where(and(...filters)) : await query;
    res.json({ success: true, sessions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

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
      enrollmentId: sectionStudents.enrollmentId,
      status: sectionStudents.status,
      enrolledDate: sectionStudents.enrolledDate,
      firstName: students.firstName,
      lastName: students.lastName,
      grade: students.grade,
    }).from(sectionStudents)
      .innerJoin(students, eq(sectionStudents.studentId, students.id))
      .where(and(
        eq(sectionStudents.sectionId, section.id),
        eq(sectionStudents.status, 'active'),
        isNull(sectionStudents.removedAt)
      ));

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
      .where(and(
        eq(sectionStudents.sectionId, sectionId),
        eq(sectionStudents.studentId, parseInt(studentId)),
        isNull(sectionStudents.removedAt)
      ));
    if (existing.length > 0) {
      return res.status(400).json({ success: false, error: 'Student already placed in this section' });
    }

    const [section] = await db.select().from(sections).where(eq(sections.id, sectionId));
    if (!section) return res.status(404).json({ success: false, error: 'Section not found' });

    // Enforce capacity if set
    if (section.capacity) {
      const currentRoster = await db.select({ id: sectionStudents.id })
        .from(sectionStudents).where(and(
          eq(sectionStudents.sectionId, sectionId),
          eq(sectionStudents.status, 'active'),
          isNull(sectionStudents.removedAt)
        ));
      if (currentRoster.length >= section.capacity) {
        return res.status(400).json({
          success: false,
          error: `Section is at capacity (${section.capacity} students)`,
        });
      }
    }

    const enrollmentCheck = await db.select().from(enrollments)
      .where(and(
        eq(enrollments.studentId, parseInt(studentId)),
        eq(enrollments.programId, section.programId),
        inArray(enrollments.status, ['active', 'active_override'])
      ));
    if (enrollmentCheck.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Student needs an active enrollment in this program before class placement',
      });
    }
    const activeEnrollment = enrollmentCheck[0];

    const [placement] = await db.insert(sectionStudents).values({
      sectionId,
      studentId: parseInt(studentId),
      enrollmentId: activeEnrollment.id,
      status: 'active',
      placedAt: new Date(),
    }).returning();

    await db.update(enrollments).set({ sectionId })
      .where(and(
        eq(enrollments.id, activeEnrollment.id)
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
    const [activePlacement] = await db.select().from(sectionStudents)
      .where(and(
        eq(sectionStudents.sectionId, sectionId),
        eq(sectionStudents.studentId, studentId),
        isNull(sectionStudents.removedAt)
      ));
    if (!activePlacement) {
      return res.status(404).json({ success: false, error: 'Roster placement not found' });
    }

    await db.update(sectionStudents)
      .set({ status: 'dropped', removedAt: new Date(), removedReason: 'admin_removed' })
      .where(eq(sectionStudents.id, activePlacement.id));

    if (activePlacement.enrollmentId) {
      await db.update(enrollments)
        .set({ sectionId: null })
        .where(eq(enrollments.id, activePlacement.enrollmentId));
    }

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

router.get('/:id/sessions', requireAuth, async (req, res) => {
  try {
    const sectionId = parseInt(req.params.id);
    const [section] = await db.select().from(sections).where(eq(sections.id, sectionId));
    if (!section) return res.status(404).json({ success: false, error: 'Section not found' });

    const sessions = await db.select().from(classSessions)
      .where(eq(classSessions.sectionId, sectionId))
      .orderBy(asc(classSessions.sessionDate));

    res.json({ success: true, sessions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/sessions', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const sectionId = parseInt(req.params.id);
    const [section] = await db.select().from(sections).where(eq(sections.id, sectionId));
    if (!section) return res.status(404).json({ success: false, error: 'Section not found' });

    const { sessions = [] } = req.body;
    if (!Array.isArray(sessions) || sessions.length === 0) {
      return res.status(400).json({ success: false, error: 'sessions[] is required' });
    }

    const payload = sessions.map((s) => ({
      sectionId,
      sessionDate: s.sessionDate,
      startAt: s.startAt ? new Date(s.startAt) : null,
      endAt: s.endAt ? new Date(s.endAt) : null,
      location: s.location || section.room || null,
      status: s.status || 'scheduled',
      notes: s.notes || null,
      createdBy: req.user.id,
    }));

    const created = await db.insert(classSessions).values(payload).returning();

    await logAudit({
      userId: req.user.id,
      action: 'create',
      entityType: 'class_session',
      entityId: `${sectionId}`,
      details: { sectionId, createdCount: created.length },
      ipAddress: req.ip,
    });

    res.json({ success: true, sessions: created });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/sessions/generate', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const sectionId = parseInt(req.params.id);
    const [section] = await db.select().from(sections).where(eq(sections.id, sectionId));
    if (!section) return res.status(404).json({ success: false, error: 'Section not found' });

    const { startDate, endDate, weekdays, startTime, endTime, location, status } = req.body;
    if (!startDate || !endDate || !Array.isArray(weekdays) || weekdays.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'startDate, endDate, and weekdays[] are required',
      });
    }

    const parsedDays = [...new Set(weekdays.map(normalizeDay).filter((d) => d !== null))];
    if (parsedDays.length === 0) {
      return res.status(400).json({ success: false, error: 'weekdays[] must include valid weekday values' });
    }
    if (startDate > endDate) {
      return res.status(400).json({ success: false, error: 'startDate must be on or before endDate' });
    }

    const existingSessions = await db.select({
      sessionDate: classSessions.sessionDate,
      startAt: classSessions.startAt,
    }).from(classSessions).where(eq(classSessions.sectionId, sectionId));
    const existingKeys = new Set(existingSessions.map((s) => {
      const startAtIso = s.startAt ? new Date(s.startAt).toISOString() : '';
      return `${s.sessionDate}|${startAtIso}`;
    }));

    let candidateCount = 0;
    const pending = [];
    const cursor = new Date(`${startDate}T00:00:00.000Z`);
    const last = new Date(`${endDate}T00:00:00.000Z`);
    while (cursor <= last) {
      if (parsedDays.includes(cursor.getUTCDay())) {
        candidateCount++;
        const datePart = cursor.toISOString().slice(0, 10);
        const startAt = buildDateTime(datePart, startTime);
        const endAt = buildDateTime(datePart, endTime);
        const dedupeKey = `${datePart}|${startAt ? startAt.toISOString() : ''}`;
        if (!existingKeys.has(dedupeKey)) {
          pending.push({
            sectionId,
            sessionDate: datePart,
            startAt,
            endAt,
            location: location || section.room || null,
            status: status || 'scheduled',
            createdBy: req.user.id,
          });
        }
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    const created = pending.length > 0
      ? await db.insert(classSessions).values(pending).returning()
      : [];

    await logAudit({
      userId: req.user.id,
      action: 'create',
      entityType: 'class_session',
      entityId: `${sectionId}`,
      details: {
        sectionId,
        generatedRange: { startDate, endDate },
        weekdays: parsedDays,
        createdCount: created.length,
      },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      createdCount: created.length,
      skippedCount: candidateCount - created.length,
      sessions: created,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.patch('/:sectionId/sessions/:sessionId', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const sectionId = parseInt(req.params.sectionId);
    const sessionId = parseInt(req.params.sessionId);
    const [existing] = await db.select().from(classSessions).where(and(
      eq(classSessions.id, sessionId),
      eq(classSessions.sectionId, sectionId)
    ));
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    const { sessionDate, startAt, endAt, location, status, notes, canceledReason } = req.body;
    const updateData = {};
    if (sessionDate !== undefined) updateData.sessionDate = sessionDate;
    if (startAt !== undefined) updateData.startAt = startAt ? new Date(startAt) : null;
    if (endAt !== undefined) updateData.endAt = endAt ? new Date(endAt) : null;
    if (location !== undefined) updateData.location = location || null;
    if (status !== undefined) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes || null;
    if (canceledReason !== undefined) updateData.canceledReason = canceledReason || null;
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    const [updated] = await db.update(classSessions)
      .set(updateData)
      .where(eq(classSessions.id, sessionId))
      .returning();

    await logAudit({
      userId: req.user.id,
      action: 'update',
      entityType: 'class_session',
      entityId: `${sessionId}`,
      details: updateData,
      ipAddress: req.ip,
    });

    res.json({ success: true, session: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/:sectionId/sessions/:sessionId', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const sectionId = parseInt(req.params.sectionId);
    const sessionId = parseInt(req.params.sessionId);
    const [existing] = await db.select({ id: classSessions.id }).from(classSessions).where(and(
      eq(classSessions.id, sessionId),
      eq(classSessions.sectionId, sectionId)
    ));
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    await db.delete(classSessions).where(eq(classSessions.id, sessionId));

    await logAudit({
      userId: req.user.id,
      action: 'delete',
      entityType: 'class_session',
      entityId: `${sessionId}`,
      details: { sectionId },
      ipAddress: req.ip,
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
