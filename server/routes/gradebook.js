import { Router } from 'express';
import { eq, and, desc, inArray } from 'drizzle-orm';
import db from '../db-postgres.js';
import {
  lessonAssignments, coachAssignments, students, users
} from '../schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// ── Normalize lesson to snake_case for frontend ────────────────────────────────
function formatLesson(l) {
  return {
    id: l.id,
    student_id: l.studentId,
    academic_coach_user_id: l.academicCoachUserId,
    title: l.title,
    subject: l.subject,
    instructions: l.instructions,
    due_at: l.dueAt ? new Date(l.dueAt).toISOString() : null,
    points_possible: l.pointsPossible,
    status: l.status,
    points_earned: l.pointsEarned,
    completed_at: l.completedAt ? new Date(l.completedAt).toISOString() : null,
    assigned_at: l.assignedAt ? new Date(l.assignedAt).toISOString() : null,
  };
}

// ── KPI helpers ────────────────────────────────────────────────────────────────
function getWeekBounds() {
  const now = new Date();
  const day = now.getDay();
  const daysToMon = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(monday.getDate() - daysToMon);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { monday, sunday, now };
}

function computeKPIs(lessons) {
  const { monday, sunday, now } = getWeekBounds();
  const todayStr = now.toISOString().split('T')[0];
  const in7d = new Date(now);
  in7d.setDate(in7d.getDate() + 7);

  let due_today = 0, upcoming_7d = 0, overdue = 0, completed = 0, incomplete = 0;
  let due_this_week = 0, completed_this_week = 0, on_time_this_week = 0;

  for (const l of lessons) {
    const due = l.dueAt ? new Date(l.dueAt) : null;
    const dueStr = due ? due.toISOString().split('T')[0] : null;
    const isComplete = l.status === 'complete';

    if (isComplete) completed++;
    else incomplete++;

    if (due) {
      if (dueStr === todayStr && !isComplete) due_today++;
      if (due > now && due <= in7d && !isComplete) upcoming_7d++;
      if (due < now && !isComplete) overdue++;
      if (due >= monday && due <= sunday) {
        due_this_week++;
        if (isComplete) {
          completed_this_week++;
          const completedAt = l.completedAt ? new Date(l.completedAt) : null;
          if (completedAt && completedAt <= due) on_time_this_week++;
        }
      }
    }
  }

  const total = lessons.length;
  const overall_completion_rate = total > 0 ? Math.round((completed / total) * 100) / 100 : null;
  const weekly_completion_rate = due_this_week > 0 ? Math.round((completed_this_week / due_this_week) * 100) / 100 : null;
  const intervention = (overall_completion_rate !== null && overall_completion_rate < 0.70) || overdue >= 3;

  return {
    due_today_count: due_today,
    upcoming_7d_count: upcoming_7d,
    overdue_count: overdue,
    completed_count: completed,
    incomplete_count: incomplete,
    due_this_week_count: due_this_week,
    completed_this_week_count: completed_this_week,
    on_time_due_this_week_count: on_time_this_week,
    weekly_completion_rate,
    overall_completion_rate,
    intervention,
  };
}

// GET /api/gradebook/lessons — get lessons scoped by role
router.get('/lessons', requireAuth, async (req, res) => {
  try {
    const { student_id, subject } = req.query;
    const user = req.user;
    let lessons = [];

    if (user.role === 'academic_coach') {
      const conds = [eq(lessonAssignments.academicCoachUserId, user.id)];
      if (student_id) conds.push(eq(lessonAssignments.studentId, Number(student_id)));
      lessons = await db.select().from(lessonAssignments).where(and(...conds)).orderBy(desc(lessonAssignments.dueAt));
    } else if (user.role === 'student') {
      const [student] = await db.select().from(students).where(eq(students.userId, user.id));
      if (!student) return res.json({ lessons: [], kpis: computeKPIs([]) });
      lessons = await db.select().from(lessonAssignments).where(eq(lessonAssignments.studentId, student.id)).orderBy(desc(lessonAssignments.dueAt));
    } else if (user.role === 'parent') {
      if (!student_id) return res.status(400).json({ error: 'student_id required for parent' });
      lessons = await db.select().from(lessonAssignments).where(eq(lessonAssignments.studentId, Number(student_id))).orderBy(desc(lessonAssignments.dueAt));
    } else if (user.role === 'admin') {
      const conds = [];
      if (student_id) conds.push(eq(lessonAssignments.studentId, Number(student_id)));
      lessons = conds.length
        ? await db.select().from(lessonAssignments).where(and(...conds)).orderBy(desc(lessonAssignments.dueAt))
        : await db.select().from(lessonAssignments).orderBy(desc(lessonAssignments.dueAt)).limit(200);
    }

    if (subject && subject !== 'all') {
      lessons = lessons.filter(l => l.subject === subject);
    }

    res.json({ lessons: lessons.map(formatLesson), kpis: computeKPIs(lessons) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/gradebook/queue — coach's student queue with KPIs
router.get('/queue', requireAuth, requireRole('admin', 'academic_coach'), async (req, res) => {
  try {
    const user = req.user;
    const conds = [eq(coachAssignments.coachType, 'academic_coach'), eq(coachAssignments.isActive, true)];
    if (user.role === 'academic_coach') conds.push(eq(coachAssignments.coachUserId, user.id));

    const assignments = await db.select({
      id: coachAssignments.id,
      studentId: coachAssignments.studentId,
      coachUserId: coachAssignments.coachUserId,
    }).from(coachAssignments).where(and(...conds));

    const results = [];
    for (const ca of assignments) {
      const lessons = await db.select().from(lessonAssignments).where(
        and(eq(lessonAssignments.studentId, ca.studentId), eq(lessonAssignments.academicCoachUserId, ca.coachUserId))
      );
      const [student] = await db.select({ firstName: students.firstName, lastName: students.lastName })
        .from(students).where(eq(students.id, ca.studentId));
      results.push({
        student_id: ca.studentId,
        student_name: student ? `${student.firstName} ${student.lastName}` : String(ca.studentId),
        assignment_id: ca.id,
        kpis: computeKPIs(lessons),
      });
    }

    res.json({ queue: results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/gradebook/lessons — create lesson(s)
router.post('/lessons', requireAuth, requireRole('admin', 'academic_coach'), async (req, res) => {
  try {
    const { student_id, student_ids, title, subject, instructions, due_at, points_possible } = req.body;
    if (!title) return res.status(400).json({ error: 'title required' });

    const targets = student_ids?.length ? student_ids.map(Number) : [Number(student_id)];
    if (!targets[0]) return res.status(400).json({ error: 'student_id required' });

    // Scope check for coach
    if (req.user.role === 'academic_coach') {
      const assignments = await db.select().from(coachAssignments).where(
        and(eq(coachAssignments.coachUserId, req.user.id), eq(coachAssignments.coachType, 'academic_coach'), eq(coachAssignments.isActive, true))
      );
      const allowedIds = assignments.map(a => a.studentId);
      const forbidden = targets.filter(id => !allowedIds.includes(id));
      if (forbidden.length) return res.status(403).json({ error: 'One or more students are not assigned to you' });
    }

    const created = [];
    for (const sid of targets) {
      const [lesson] = await db.insert(lessonAssignments).values({
        studentId: sid,
        academicCoachUserId: req.user.id,
        subject: subject || 'General',
        title,
        instructions: instructions || '',
        dueAt: due_at ? new Date(due_at) : null,
        status: 'incomplete',
        pointsPossible: points_possible || 10,
      }).returning();
      created.push(lesson);
    }

    res.json({ lessons: created.map(formatLesson) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/gradebook/lessons/:id — update status/score/feedback (coaches and admin only)
router.patch('/lessons/:id', requireAuth, requireRole('admin', 'academic_coach'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [lesson] = await db.select().from(lessonAssignments).where(eq(lessonAssignments.id, id));
    if (!lesson) return res.status(404).json({ error: 'Lesson not found' });

    // Non-admin coaches can only update lessons they own
    if (req.user.role !== 'admin' && lesson.academicCoachUserId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to update this lesson' });
    }

    const { new_status, points_earned } = req.body;
    const updates = {};

    if (new_status) {
      updates.status = new_status;
      if (new_status === 'complete') updates.completedAt = new Date();
      else updates.completedAt = null;
    }
    if (points_earned != null) updates.pointsEarned = points_earned;

    const [updated] = await db.update(lessonAssignments).set(updates)
      .where(eq(lessonAssignments.id, id)).returning();

    res.json({ lesson: formatLesson(updated) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/gradebook/coach-assignments — coach assignments list
router.get('/coach-assignments', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const conds = [];
    if (user.role === 'academic_coach') {
      conds.push(eq(coachAssignments.coachUserId, user.id));
      conds.push(eq(coachAssignments.coachType, 'academic_coach'));
    } else if (user.role === 'performance_coach') {
      conds.push(eq(coachAssignments.coachUserId, user.id));
      conds.push(eq(coachAssignments.coachType, 'performance_coach'));
    } else if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    conds.push(eq(coachAssignments.isActive, true));

    const rows = await db.select({
      id: coachAssignments.id,
      coachUserId: coachAssignments.coachUserId,
      coachType: coachAssignments.coachType,
      studentId: coachAssignments.studentId,
      isActive: coachAssignments.isActive,
      studentFirstName: students.firstName,
      studentLastName: students.lastName,
    }).from(coachAssignments)
      .leftJoin(students, eq(coachAssignments.studentId, students.id))
      .where(and(...conds));

    res.json(rows.map(r => ({
      id: r.id,
      coach_user_id: r.coachUserId,
      coach_type: r.coachType,
      student_id: r.studentId,
      is_active: r.isActive,
      student_name: `${r.studentFirstName || ''} ${r.studentLastName || ''}`.trim(),
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
