import { Router } from 'express';
import { eq, and } from 'drizzle-orm';
import db from '../db-postgres.js';
import {
  assignments, assignmentSubmissions, attendanceRecords, trainingLogs,
  coachNotes, sectionStudents, sections, students, users,
  enrollments, programs
} from '../schema.js';
import { requireAuth } from '../middleware/auth.js';
import { canAccessStudent } from '../middleware/scope.js';

const router = Router();

router.get('/student/:studentId', requireAuth, async (req, res) => {
  try {
    const studentId = parseInt(req.params.studentId);

    if (!await canAccessStudent(req.user, studentId)) {
      return res.status(403).json({ success: false, error: 'Not authorized to view this student' });
    }

    const studentSections = await db.select({
      sectionId: sectionStudents.sectionId,
      sectionName: sections.name,
      programId: sections.programId,
    }).from(sectionStudents)
      .innerJoin(sections, eq(sectionStudents.sectionId, sections.id))
      .where(eq(sectionStudents.studentId, studentId));

    const sectionIds = studentSections.map(s => s.sectionId);

    let allAssignments = [];
    let allSubmissions = [];
    for (const secId of sectionIds) {
      const secAssignments = await db.select().from(assignments)
        .where(eq(assignments.sectionId, secId));
      allAssignments.push(...secAssignments);

      for (const a of secAssignments) {
        const [sub] = await db.select().from(assignmentSubmissions)
          .where(and(
            eq(assignmentSubmissions.assignmentId, a.id),
            eq(assignmentSubmissions.studentId, studentId)
          ));
        if (sub) allSubmissions.push({ ...sub, assignmentTitle: a.title, maxScore: a.maxScore, sectionId: a.sectionId });
      }
    }

    const grades = {};
    for (const sec of studentSections) {
      const secSubmissions = allSubmissions.filter(s => s.sectionId === sec.sectionId && s.score !== null);
      const secAssignments = allAssignments.filter(a => a.sectionId === sec.sectionId);
      if (secSubmissions.length > 0) {
        const totalScore = secSubmissions.reduce((sum, s) => sum + s.score, 0);
        const totalMax = secSubmissions.reduce((sum, s) => sum + s.maxScore, 0);
        grades[sec.sectionId] = {
          sectionName: sec.sectionName,
          average: totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0,
          gradedCount: secSubmissions.length,
          totalAssignments: secAssignments.length,
        };
      } else {
        grades[sec.sectionId] = {
          sectionName: sec.sectionName,
          average: null,
          gradedCount: 0,
          totalAssignments: secAssignments.length,
        };
      }
    }

    const attendance = await db.select({
      id: attendanceRecords.id,
      sectionId: attendanceRecords.sectionId,
      date: attendanceRecords.date,
      status: attendanceRecords.status,
      notes: attendanceRecords.notes,
      sectionName: sections.name,
    }).from(attendanceRecords)
      .leftJoin(sections, eq(attendanceRecords.sectionId, sections.id))
      .where(eq(attendanceRecords.studentId, studentId));

    const attendanceSummary = {
      present: attendance.filter(a => a.status === 'present').length,
      absent: attendance.filter(a => a.status === 'absent').length,
      tardy: attendance.filter(a => a.status === 'tardy').length,
      excused: attendance.filter(a => a.status === 'excused').length,
      total: attendance.length,
    };

    const training = await db.select({
      id: trainingLogs.id,
      date: trainingLogs.date,
      type: trainingLogs.type,
      durationMinutes: trainingLogs.durationMinutes,
      notes: trainingLogs.notes,
      coachFirstName: users.firstName,
      coachLastName: users.lastName,
    }).from(trainingLogs)
      .leftJoin(users, eq(trainingLogs.coachUserId, users.id))
      .where(eq(trainingLogs.studentId, studentId));

    let notes = await db.select({
      id: coachNotes.id,
      content: coachNotes.content,
      visibility: coachNotes.visibility,
      createdAt: coachNotes.createdAt,
      coachFirstName: users.firstName,
      coachLastName: users.lastName,
    }).from(coachNotes)
      .leftJoin(users, eq(coachNotes.coachUserId, users.id))
      .where(eq(coachNotes.studentId, studentId));

    if (req.user.role === 'parent') {
      notes = notes.filter(n => n.visibility === 'parent_visible');
    } else if (req.user.role === 'student') {
      notes = notes.filter(n => n.visibility === 'student_visible');
    }

    const studentEnrollments = await db.select({
      id: enrollments.id,
      programName: programs.name,
      sectionId: enrollments.sectionId,
      status: enrollments.status,
    }).from(enrollments)
      .leftJoin(programs, eq(enrollments.programId, programs.id))
      .where(eq(enrollments.studentId, studentId));

    res.json({
      success: true,
      sections: studentSections,
      grades,
      assignments: allAssignments.map(a => ({
        id: a.id, sectionId: a.sectionId, title: a.title, maxScore: a.maxScore,
        dueDate: a.dueDate, category: a.category, status: a.status,
      })),
      submissions: allSubmissions.map(s => ({
        id: s.id, assignmentId: s.assignmentId, score: s.score, maxScore: s.maxScore,
        isMissing: s.isMissing, isLate: s.isLate, feedback: s.feedback,
        assignmentTitle: s.assignmentTitle, sectionId: s.sectionId,
      })),
      attendance: attendance.slice(0, 50),
      attendanceSummary,
      trainingLogs: training,
      coachNotes: notes,
      enrollments: studentEnrollments,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/progress/gradebook?studentId=X  — alias used by frontend functions.invoke
router.get('/gradebook', requireAuth, async (req, res) => {
  const studentId = parseInt(req.query.studentId);
  if (!studentId) return res.status(400).json({ error: 'studentId required' });
  try {
    const subs = await db.select().from(assignmentSubmissions).where(eq(assignmentSubmissions.studentId, studentId));
    res.json({ grades: subs, summary: {} });
  } catch {
    res.json({ grades: [], summary: {} });
  }
});

// GET /api/progress/analytics — admin analytics overview
router.get('/analytics', requireAuth, async (req, res) => {
  try {
    const [studentCount] = await db.select({ count: students.id }).from(students);
    const [enrollmentCount] = await db.select({ count: enrollments.id }).from(enrollments);
    res.json({
      students: studentCount?.count ?? 0,
      enrollments: enrollmentCount?.count ?? 0,
    });
  } catch {
    res.json({});
  }
});

export default router;
