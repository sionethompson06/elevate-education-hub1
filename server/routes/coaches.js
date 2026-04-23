import { Router } from 'express';
import { eq, and, desc, inArray, or } from 'drizzle-orm';
import db from '../db-postgres.js';
import {
  users, staffProfiles, coachAssignments, staffAssignments, sections,
  sectionStudents, programs, students, lessonAssignments, enrollments, trainingLogs,
} from '../schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { sendInviteEmail } from '../services/email.service.js';
import { logAudit } from '../services/audit.service.js';
import crypto from 'crypto';

const router = Router();

// ── GET /api/coaches — all coaches with stats ──────────────────────────────────
router.get('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const allCoaches = await db.select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      role: users.role,
      status: users.status,
      inviteToken: users.inviteToken,
      inviteTokenExpiry: users.inviteTokenExpiry,
      createdAt: users.createdAt,
    }).from(users)
      .where(or(eq(users.role, 'academic_coach'), eq(users.role, 'performance_coach')))
      .orderBy(desc(users.createdAt));

    if (!allCoaches.length) return res.json({ success: true, coaches: [] });

    const coachIds = allCoaches.map(c => c.id);

    const profiles = await db.select().from(staffProfiles)
      .where(inArray(staffProfiles.userId, coachIds));
    const profileMap = Object.fromEntries(profiles.map(p => [p.userId, p]));

    const assignments = await db.select({
      coachUserId: coachAssignments.coachUserId,
      id: coachAssignments.id,
    }).from(coachAssignments)
      .where(and(inArray(coachAssignments.coachUserId, coachIds), eq(coachAssignments.isActive, true)));
    const studentCountMap = {};
    for (const a of assignments) {
      studentCountMap[a.coachUserId] = (studentCountMap[a.coachUserId] || 0) + 1;
    }

    const staffAssigs = await db.select({
      staffUserId: staffAssignments.staffUserId,
      id: staffAssignments.id,
    }).from(staffAssignments).where(inArray(staffAssignments.staffUserId, coachIds));
    const sectionCountMap = {};
    for (const a of staffAssigs) {
      sectionCountMap[a.staffUserId] = (sectionCountMap[a.staffUserId] || 0) + 1;
    }

    const now = new Date();
    const enriched = allCoaches.map(coach => {
      const profile = profileMap[coach.id] || null;
      let coachStatus = 'inactive';
      if (coach.inviteToken) {
        coachStatus = coach.inviteTokenExpiry && new Date(coach.inviteTokenExpiry) > now
          ? 'invited' : 'expired';
      } else if (coach.status === 'active') {
        coachStatus = 'active';
      }
      return {
        ...coach,
        inviteToken: undefined,
        profile,
        studentCount: studentCountMap[coach.id] || 0,
        sectionCount: sectionCountMap[coach.id] || 0,
        coachStatus,
      };
    });

    res.json({ success: true, coaches: enriched });
  } catch (err) {
    console.error('[coaches] GET / error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/coaches/:id — full coach profile ──────────────────────────────────
router.get('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const coachId = parseInt(req.params.id);
    const [coach] = await db.select().from(users).where(eq(users.id, coachId));
    if (!coach || !['academic_coach', 'performance_coach'].includes(coach.role)) {
      return res.status(404).json({ success: false, error: 'Coach not found' });
    }
    const [profile] = await db.select().from(staffProfiles)
      .where(eq(staffProfiles.userId, coachId));
    res.json({ success: true, coach: { ...coach, passwordHash: undefined, profile: profile || null } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/coaches/:id/students — assigned students ─────────────────────────
router.get('/:id/students', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const coachId = parseInt(req.params.id);

    const directRows = await db.select({
      assignmentId: coachAssignments.id,
      studentId: students.id,
      firstName: students.firstName,
      lastName: students.lastName,
      grade: students.grade,
      studentStatus: students.status,
      coachType: coachAssignments.coachType,
      startDate: coachAssignments.startDate,
    }).from(coachAssignments)
      .leftJoin(students, eq(coachAssignments.studentId, students.id))
      .where(and(eq(coachAssignments.coachUserId, coachId), eq(coachAssignments.isActive, true)));

    // Enrich with program name for each student
    const studentIds = [...new Set(directRows.map(r => r.studentId).filter(Boolean))];
    let programByStudent = {};
    if (studentIds.length > 0) {
      const enrollRows = await db.select({
        studentId: enrollments.studentId,
        programName: programs.name,
      }).from(enrollments)
        .leftJoin(programs, eq(enrollments.programId, programs.id))
        .where(and(inArray(enrollments.studentId, studentIds), eq(enrollments.status, 'active')));
      for (const r of enrollRows) {
        if (!programByStudent[r.studentId]) programByStudent[r.studentId] = r.programName;
      }
    }

    const result = directRows.map(r => ({
      ...r,
      programName: programByStudent[r.studentId] || null,
    }));

    res.json({ success: true, students: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/coaches/:id/schedule — sections assigned to coach ─────────────────
router.get('/:id/schedule', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const coachId = parseInt(req.params.id);

    const staffAssigs = await db.select({
      assignmentId: staffAssignments.assignmentId,
      roleInAssignment: staffAssignments.roleInAssignment,
    }).from(staffAssignments)
      .where(and(eq(staffAssignments.staffUserId, coachId), eq(staffAssignments.assignmentType, 'section')));

    const sectionIds = staffAssigs.map(a => a.assignmentId).filter(Boolean);
    if (!sectionIds.length) return res.json({ success: true, sections: [] });

    const sectionRows = await db.select({
      id: sections.id,
      name: sections.name,
      schedule: sections.schedule,
      capacity: sections.capacity,
      room: sections.room,
      status: sections.status,
      programId: sections.programId,
      programName: programs.name,
    }).from(sections)
      .leftJoin(programs, eq(sections.programId, programs.id))
      .where(inArray(sections.id, sectionIds));

    const sectionStudentRows = await db.select({
      sectionId: sectionStudents.sectionId,
      studentId: sectionStudents.studentId,
      firstName: students.firstName,
      lastName: students.lastName,
    }).from(sectionStudents)
      .leftJoin(students, eq(sectionStudents.studentId, students.id))
      .where(inArray(sectionStudents.sectionId, sectionIds));

    const sectionStudentMap = {};
    for (const row of sectionStudentRows) {
      if (!sectionStudentMap[row.sectionId]) sectionStudentMap[row.sectionId] = [];
      sectionStudentMap[row.sectionId].push({ studentId: row.studentId, firstName: row.firstName, lastName: row.lastName });
    }

    const result = sectionRows.map(s => ({
      ...s,
      students: sectionStudentMap[s.id] || [],
      studentCount: (sectionStudentMap[s.id] || []).length,
    }));

    res.json({ success: true, sections: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/coaches/:id/gradebook — lesson assignments for coach's students ────
router.get('/:id/gradebook', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const coachId = parseInt(req.params.id);

    const activeAssignments = await db.select({ studentId: coachAssignments.studentId })
      .from(coachAssignments)
      .where(and(eq(coachAssignments.coachUserId, coachId), eq(coachAssignments.isActive, true)));

    const studentIds = [...new Set(activeAssignments.map(a => a.studentId))];
    if (!studentIds.length) return res.json({ success: true, lessons: [], type: 'academic' });

    const [coach] = await db.select({ role: users.role }).from(users).where(eq(users.id, coachId));
    const isPerformance = coach?.role === 'performance_coach';

    if (isPerformance) {
      // Performance coaches → training logs
      const logs = await db.select({
        id: trainingLogs.id,
        studentId: trainingLogs.studentId,
        coachUserId: trainingLogs.coachUserId,
        sessionDate: trainingLogs.date,
        duration: trainingLogs.durationMinutes,
        notes: trainingLogs.notes,
        createdAt: trainingLogs.createdAt,
        studentFirstName: students.firstName,
        studentLastName: students.lastName,
      }).from(trainingLogs)
        .leftJoin(students, eq(trainingLogs.studentId, students.id))
        .where(inArray(trainingLogs.studentId, studentIds))
        .orderBy(desc(trainingLogs.createdAt));
      return res.json({ success: true, logs, type: 'performance' });
    }

    // Academic coaches → lesson assignments
    const lessons = await db.select({
      id: lessonAssignments.id,
      studentId: lessonAssignments.studentId,
      academicCoachUserId: lessonAssignments.academicCoachUserId,
      subject: lessonAssignments.subject,
      title: lessonAssignments.title,
      instructions: lessonAssignments.instructions,
      assignedAt: lessonAssignments.assignedAt,
      dueAt: lessonAssignments.dueAt,
      status: lessonAssignments.status,
      completedAt: lessonAssignments.completedAt,
      pointsPossible: lessonAssignments.pointsPossible,
      pointsEarned: lessonAssignments.pointsEarned,
      createdAt: lessonAssignments.createdAt,
      studentFirstName: students.firstName,
      studentLastName: students.lastName,
    }).from(lessonAssignments)
      .leftJoin(students, eq(lessonAssignments.studentId, students.id))
      .where(inArray(lessonAssignments.studentId, studentIds))
      .orderBy(desc(lessonAssignments.assignedAt));

    res.json({ success: true, lessons, type: 'academic' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/coaches/:id/invite — resend invite email ─────────────────────────
router.post('/:id/invite', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const coachId = parseInt(req.params.id);
    const [coach] = await db.select().from(users).where(eq(users.id, coachId));
    if (!coach) return res.status(404).json({ success: false, error: 'Coach not found' });

    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 72 * 60 * 60 * 1000);
    await db.update(users).set({ inviteToken: token, inviteTokenExpiry: expiry })
      .where(eq(users.id, coachId));

    await sendInviteEmail(coach.email, coach.firstName, token);

    await logAudit({
      userId: req.user.id,
      action: 'update',
      entityType: 'user',
      entityId: String(coachId),
      details: { action: 'resend_invite', email: coach.email },
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'Invite sent' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── PATCH /api/coaches/:id/section-schedule — update section schedule JSONB ─────
router.patch('/:id/section-schedule', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const coachId = parseInt(req.params.id);
    const { sectionId, schedule } = req.body;
    if (!sectionId || !schedule) {
      return res.status(400).json({ success: false, error: 'sectionId and schedule are required' });
    }

    // Verify coach is assigned to this section
    const [assignment] = await db.select().from(staffAssignments)
      .where(and(
        eq(staffAssignments.staffUserId, coachId),
        eq(staffAssignments.assignmentType, 'section'),
        eq(staffAssignments.assignmentId, parseInt(sectionId))
      ));
    if (!assignment) {
      return res.status(403).json({ success: false, error: 'Coach is not assigned to this section' });
    }

    const [updated] = await db.update(sections)
      .set({ schedule })
      .where(eq(sections.id, parseInt(sectionId)))
      .returning();

    await logAudit({
      userId: req.user.id,
      action: 'update',
      entityType: 'section',
      entityId: String(sectionId),
      details: { schedule, coachId },
      ipAddress: req.ip,
    });

    res.json({ success: true, section: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
