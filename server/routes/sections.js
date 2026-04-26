import { Router } from 'express';
import { eq, desc, and, inArray, gte, lte } from 'drizzle-orm';
import db from '../db-postgres.js';
import { sections, programs, sectionStudents, students, enrollments, assignments, assignmentSubmissions, classSessions, users, guardianStudents } from '../schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { getCoachSectionIds } from '../middleware/scope.js';
import { logAudit } from '../services/audit.service.js';

const router = Router();

// ── Coach: sections assigned to me ──────────────────────────────────────────
router.get('/my-sections', requireAuth, async (req, res) => {
  try {
    const sectionIds = await getCoachSectionIds(req.user.id);
    if (sectionIds.length === 0) return res.json({ success: true, sections: [] });

    const result = await db.select({
      id: sections.id,
      programId: sections.programId,
      termId: sections.termId,
      coachUserId: sections.coachUserId,
      name: sections.name,
      subject: sections.subject,
      gradeLevel: sections.gradeLevel,
      description: sections.description,
      isPublished: sections.isPublished,
      schedule: sections.schedule,
      capacity: sections.capacity,
      room: sections.room,
      status: sections.status,
      createdAt: sections.createdAt,
      programName: programs.name,
      coachFirstName: users.firstName,
      coachLastName: users.lastName,
    }).from(sections)
      .leftJoin(programs, eq(sections.programId, programs.id))
      .leftJoin(users, eq(sections.coachUserId, users.id))
      .where(inArray(sections.id, sectionIds));

    const today = new Date().toISOString().split('T')[0];
    const enriched = await Promise.all(result.map(async (s) => {
      const roster = await db.select({ id: sectionStudents.id })
        .from(sectionStudents).where(eq(sectionStudents.sectionId, s.id));
      const [nextSession] = await db.select({
        sessionDate: classSessions.sessionDate,
        startAt: classSessions.startAt,
        endAt: classSessions.endAt,
        status: classSessions.status,
      }).from(classSessions)
        .where(and(
          eq(classSessions.sectionId, s.id),
          eq(classSessions.status, 'scheduled'),
          gte(classSessions.sessionDate, today),
        ))
        .orderBy(classSessions.sessionDate, classSessions.startAt)
        .limit(1);
      return { ...s, rosterCount: roster.length, nextSession: nextSession || null };
    }));

    res.json({ success: true, sections: enriched });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Schedule board: all sessions across sections (admin) ─────────────────────
router.get('/sessions-board', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { from, to } = req.query;
    const conditions = [];
    if (from) conditions.push(gte(classSessions.sessionDate, from));
    if (to)   conditions.push(lte(classSessions.sessionDate, to));

    const rows = await db.select({
      id: classSessions.id,
      sectionId: classSessions.sectionId,
      sessionDate: classSessions.sessionDate,
      startAt: classSessions.startAt,
      endAt: classSessions.endAt,
      locationSnapshot: classSessions.locationSnapshot,
      status: classSessions.status,
      canceledReason: classSessions.canceledReason,
      sectionName: sections.name,
      room: sections.room,
      programName: programs.name,
      coachFirstName: users.firstName,
      coachLastName: users.lastName,
    }).from(classSessions)
      .innerJoin(sections, eq(classSessions.sectionId, sections.id))
      .leftJoin(programs, eq(sections.programId, programs.id))
      .leftJoin(users, eq(sections.coachUserId, users.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(classSessions.sessionDate, classSessions.startAt);

    res.json({ success: true, sessions: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Admin: list all sections ─────────────────────────────────────────────────
router.get('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { programId } = req.query;
    let result = await db.select({
      id: sections.id,
      programId: sections.programId,
      termId: sections.termId,
      coachUserId: sections.coachUserId,
      name: sections.name,
      subject: sections.subject,
      gradeLevel: sections.gradeLevel,
      description: sections.description,
      isPublished: sections.isPublished,
      schedule: sections.schedule,
      capacity: sections.capacity,
      room: sections.room,
      status: sections.status,
      createdAt: sections.createdAt,
      programName: programs.name,
      coachFirstName: users.firstName,
      coachLastName: users.lastName,
    }).from(sections)
      .leftJoin(programs, eq(sections.programId, programs.id))
      .leftJoin(users, eq(sections.coachUserId, users.id))
      .orderBy(desc(sections.createdAt));

    if (programId) result = result.filter(s => s.programId === parseInt(programId));
    res.json({ success: true, sections: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Section detail (admin or assigned coach) ─────────────────────────────────
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    if (req.user.role !== 'admin') {
      const sectionIds = await getCoachSectionIds(req.user.id);
      if (!sectionIds.includes(id)) {
        return res.status(403).json({ success: false, error: 'Not assigned to this section' });
      }
    }

    const [section] = await db.select({
      id: sections.id,
      programId: sections.programId,
      termId: sections.termId,
      coachUserId: sections.coachUserId,
      name: sections.name,
      subject: sections.subject,
      gradeLevel: sections.gradeLevel,
      description: sections.description,
      isPublished: sections.isPublished,
      schedule: sections.schedule,
      capacity: sections.capacity,
      room: sections.room,
      status: sections.status,
      createdAt: sections.createdAt,
      programName: programs.name,
      coachFirstName: users.firstName,
      coachLastName: users.lastName,
    }).from(sections)
      .leftJoin(programs, eq(sections.programId, programs.id))
      .leftJoin(users, eq(sections.coachUserId, users.id))
      .where(eq(sections.id, id));

    if (!section) return res.status(404).json({ success: false, error: 'Section not found' });

    const enrolled = await db.select({
      id: sectionStudents.id,
      studentId: sectionStudents.studentId,
      enrollmentId: sectionStudents.enrollmentId,
      enrolledDate: sectionStudents.enrolledDate,
      placementStatus: sectionStudents.status,
      firstName: students.firstName,
      lastName: students.lastName,
      grade: students.grade,
    }).from(sectionStudents)
      .innerJoin(students, eq(sectionStudents.studentId, students.id))
      .where(eq(sectionStudents.sectionId, id));

    // Enrich with guardian name
    const enrichedStudents = await Promise.all(enrolled.map(async (s) => {
      const [guardianLink] = await db.select({ guardianUserId: guardianStudents.guardianUserId })
        .from(guardianStudents).where(eq(guardianStudents.studentId, s.studentId));
      let guardianName = null;
      if (guardianLink) {
        const [guardian] = await db.select({ firstName: users.firstName, lastName: users.lastName })
          .from(users).where(eq(users.id, guardianLink.guardianUserId));
        if (guardian) guardianName = `${guardian.firstName} ${guardian.lastName}`.trim();
      }
      return { ...s, guardianName };
    }));

    res.json({ success: true, section, students: enrichedStudents });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Eligible students: enrolled in the section's program (admin) ─────────────
router.get('/:id/eligible-students', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const sectionId = parseInt(req.params.id);
    const [section] = await db.select().from(sections).where(eq(sections.id, sectionId));
    if (!section) return res.status(404).json({ success: false, error: 'Section not found' });

    const activeEnrollments = await db.select({
      studentId: enrollments.studentId,
      enrollmentId: enrollments.id,
      status: enrollments.status,
    }).from(enrollments)
      .where(and(
        eq(enrollments.programId, section.programId),
        inArray(enrollments.status, ['active', 'active_override'])
      ));

    const rosterRows = await db.select({ studentId: sectionStudents.studentId })
      .from(sectionStudents).where(eq(sectionStudents.sectionId, sectionId));
    const rosterIds = new Set(rosterRows.map(r => r.studentId));

    const studentIds = [...new Set(activeEnrollments.map(e => e.studentId))];
    if (studentIds.length === 0) return res.json({ success: true, students: [] });

    const studentRows = await db.select({
      id: students.id,
      firstName: students.firstName,
      lastName: students.lastName,
      grade: students.grade,
    }).from(students).where(inArray(students.id, studentIds));

    const enrollmentMap = {};
    for (const e of activeEnrollments) enrollmentMap[e.studentId] = e.enrollmentId;

    const result = studentRows.map(s => ({
      ...s,
      enrollmentId: enrollmentMap[s.id] ?? null,
      inRoster: rosterIds.has(s.id),
    }));

    res.json({ success: true, students: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Gradebook matrix: roster × assignments × submissions (coach/admin) ───────
router.get('/:id/gradebook', requireAuth, async (req, res) => {
  try {
    const sectionId = parseInt(req.params.id);

    if (req.user.role !== 'admin') {
      const sectionIds = await getCoachSectionIds(req.user.id);
      if (!sectionIds.includes(sectionId)) {
        return res.status(403).json({ success: false, error: 'Not assigned to this section' });
      }
    }

    const [section] = await db.select().from(sections).where(eq(sections.id, sectionId));
    if (!section) return res.status(404).json({ success: false, error: 'Section not found' });

    const roster = await db.select({
      id: sectionStudents.id,
      studentId: sectionStudents.studentId,
      firstName: students.firstName,
      lastName: students.lastName,
      grade: students.grade,
    }).from(sectionStudents)
      .innerJoin(students, eq(sectionStudents.studentId, students.id))
      .where(eq(sectionStudents.sectionId, sectionId));

    const sectionAssignments = await db.select()
      .from(assignments)
      .where(and(eq(assignments.sectionId, sectionId), eq(assignments.status, 'active')))
      .orderBy(assignments.dueDate, assignments.createdAt);

    let submissions = [];
    if (sectionAssignments.length > 0 && roster.length > 0) {
      const assignmentIds = sectionAssignments.map(a => a.id);
      const studentIds = roster.map(s => s.studentId);
      submissions = await db.select({
        id: assignmentSubmissions.id,
        assignmentId: assignmentSubmissions.assignmentId,
        studentId: assignmentSubmissions.studentId,
        score: assignmentSubmissions.score,
        status: assignmentSubmissions.status,
        isMissing: assignmentSubmissions.isMissing,
        isLate: assignmentSubmissions.isLate,
        feedback: assignmentSubmissions.feedback,
        submittedAt: assignmentSubmissions.submittedAt,
        gradedAt: assignmentSubmissions.gradedAt,
      }).from(assignmentSubmissions)
        .where(and(
          inArray(assignmentSubmissions.assignmentId, assignmentIds),
          inArray(assignmentSubmissions.studentId, studentIds)
        ));
    }

    // Build submission lookup: { studentId: { assignmentId: submission } }
    const subMap = {};
    for (const sub of submissions) {
      if (!subMap[sub.studentId]) subMap[sub.studentId] = {};
      subMap[sub.studentId][sub.assignmentId] = sub;
    }

    // Build gradebook rows
    const rows = roster.map(student => ({
      studentId: student.studentId,
      firstName: student.firstName,
      lastName: student.lastName,
      grade: student.grade,
      scores: sectionAssignments.map(a => subMap[student.studentId]?.[a.id] ?? null),
    }));

    res.json({
      success: true,
      section,
      assignments: sectionAssignments,
      rows,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Create section (admin) ────────────────────────────────────────────────────
router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { programId, termId, coachUserId, name, subject, gradeLevel, description, schedule, capacity, room, status } = req.body;
    if (!programId || !name) {
      return res.status(400).json({ success: false, error: 'Program and name are required' });
    }
    const [section] = await db.insert(sections).values({
      programId: parseInt(programId),
      termId: termId ? parseInt(termId) : null,
      coachUserId: coachUserId ? parseInt(coachUserId) : null,
      name: name.trim(),
      subject: subject || null,
      gradeLevel: gradeLevel || null,
      description: description || null,
      isPublished: false,
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

// ── Update section (admin) ────────────────────────────────────────────────────
router.patch('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, subject, gradeLevel, description, schedule, capacity, room, status, termId, coachUserId } = req.body;
    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (subject !== undefined) updateData.subject = subject || null;
    if (gradeLevel !== undefined) updateData.gradeLevel = gradeLevel || null;
    if (description !== undefined) updateData.description = description || null;
    if (schedule !== undefined) updateData.schedule = schedule;
    if (capacity !== undefined) updateData.capacity = parseInt(capacity);
    if (room !== undefined) updateData.room = room || null;
    if (status !== undefined) updateData.status = status;
    if (termId !== undefined) updateData.termId = termId ? parseInt(termId) : null;
    if (coachUserId !== undefined) updateData.coachUserId = coachUserId ? parseInt(coachUserId) : null;

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

// ── Publish toggle (admin) ────────────────────────────────────────────────────
router.patch('/:id/publish', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [existing] = await db.select({ isPublished: sections.isPublished }).from(sections).where(eq(sections.id, id));
    if (!existing) return res.status(404).json({ success: false, error: 'Section not found' });

    const newValue = !existing.isPublished;
    const [updated] = await db.update(sections).set({ isPublished: newValue }).where(eq(sections.id, id)).returning();

    await logAudit({
      userId: req.user.id,
      action: 'update',
      entityType: 'section',
      entityId: id,
      details: { isPublished: newValue },
      ipAddress: req.ip,
    });

    res.json({ success: true, section: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Delete section (admin) ────────────────────────────────────────────────────
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

// ── Add student to section roster (admin) ─────────────────────────────────────
router.post('/:id/students', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const sectionId = parseInt(req.params.id);
    const { studentId, enrollmentId } = req.body;
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

    if (section.capacity) {
      const currentRoster = await db.select({ id: sectionStudents.id })
        .from(sectionStudents).where(eq(sectionStudents.sectionId, sectionId));
      if (currentRoster.length >= section.capacity) {
        return res.status(400).json({
          success: false,
          error: `Section is at capacity (${section.capacity} students)`,
        });
      }
    }

    // Resolve enrollmentId if not provided
    let resolvedEnrollmentId = enrollmentId ? parseInt(enrollmentId) : null;
    if (!resolvedEnrollmentId) {
      const enrollmentCheck = await db.select({ id: enrollments.id }).from(enrollments)
        .where(and(
          eq(enrollments.studentId, parseInt(studentId)),
          eq(enrollments.programId, section.programId)
        ))
        .orderBy(desc(enrollments.createdAt))
        .limit(1);

      if (enrollmentCheck.length === 0) {
        return res.status(400).json({ success: false, error: 'Student must be enrolled in the program before section placement' });
      }
      resolvedEnrollmentId = enrollmentCheck[0].id;
    }

    const [placement] = await db.insert(sectionStudents).values({
      sectionId,
      studentId: parseInt(studentId),
      enrollmentId: resolvedEnrollmentId,
    }).returning();

    await db.update(enrollments).set({ sectionId })
      .where(eq(enrollments.id, resolvedEnrollmentId));

    await logAudit({
      userId: req.user.id,
      action: 'create',
      entityType: 'section_student',
      entityId: placement.id,
      details: { sectionId, studentId, enrollmentId: resolvedEnrollmentId },
      ipAddress: req.ip,
    });

    res.json({ success: true, placement });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Remove student from section roster (admin) ────────────────────────────────
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

// ── Class Sessions ────────────────────────────────────────────────────────────

// GET /sections/:sectionId/sessions — list sessions for a section
router.get('/:sectionId/sessions', requireAuth, async (req, res) => {
  try {
    const sectionId = parseInt(req.params.sectionId);
    const role = req.user.role;

    if (role !== 'admin') {
      const allowed = await getCoachSectionIds(req.user.id);
      if (!allowed.includes(sectionId)) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
    }

    const rows = await db.select().from(classSessions)
      .where(eq(classSessions.sectionId, sectionId))
      .orderBy(classSessions.sessionDate, classSessions.startAt);

    res.json({ success: true, sessions: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /sections/:sectionId/sessions — create a session
router.post('/:sectionId/sessions', requireAuth, async (req, res) => {
  try {
    const sectionId = parseInt(req.params.sectionId);
    const role = req.user.role;

    if (role !== 'admin') {
      const allowed = await getCoachSectionIds(req.user.id);
      if (!allowed.includes(sectionId)) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
    }

    const { sessionDate, startAt, endAt, locationSnapshot } = req.body;
    if (!sessionDate) return res.status(400).json({ success: false, error: 'sessionDate is required' });

    const [session] = await db.insert(classSessions).values({
      sectionId,
      sessionDate,
      startAt: startAt || null,
      endAt: endAt || null,
      locationSnapshot: locationSnapshot || null,
      status: 'scheduled',
    }).returning();

    await logAudit({
      userId: req.user.id,
      action: 'create',
      entityType: 'class_session',
      entityId: session.id,
      details: { sectionId, sessionDate },
      ipAddress: req.ip,
    });

    res.json({ success: true, session });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /sections/sessions/:id — update a session (status, cancel, reschedule)
router.patch('/sessions/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [existing] = await db.select().from(classSessions).where(eq(classSessions.id, id));
    if (!existing) return res.status(404).json({ success: false, error: 'Session not found' });

    const role = req.user.role;
    if (role !== 'admin') {
      const allowed = await getCoachSectionIds(req.user.id);
      if (!allowed.includes(existing.sectionId)) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
    }

    const { sessionDate, startAt, endAt, locationSnapshot, status, canceledReason } = req.body;
    const [updated] = await db.update(classSessions).set({
      ...(sessionDate !== undefined && { sessionDate }),
      ...(startAt !== undefined && { startAt }),
      ...(endAt !== undefined && { endAt }),
      ...(locationSnapshot !== undefined && { locationSnapshot }),
      ...(status !== undefined && { status }),
      ...(canceledReason !== undefined && { canceledReason }),
    }).where(eq(classSessions.id, id)).returning();

    res.json({ success: true, session: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /sections/sessions/:id — delete a session (admin only)
router.delete('/sessions/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(classSessions).where(eq(classSessions.id, id));
    await logAudit({
      userId: req.user.id,
      action: 'delete',
      entityType: 'class_session',
      entityId: id,
      details: {},
      ipAddress: req.ip,
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
