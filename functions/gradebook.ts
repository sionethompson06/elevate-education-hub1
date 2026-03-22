import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

// KPI timezone: America/Los_Angeles, week starts Monday
function getWeekBounds() {
  const now = new Date();
  // Get current day in LA time
  const la = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(now);
  const get = (t) => la.find(p => p.type === t)?.value;
  const laDate = new Date(`${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}-08:00`);
  const day = laDate.getDay(); // 0=Sun
  const daysToMon = day === 0 ? 6 : day - 1;
  const monday = new Date(laDate);
  monday.setDate(monday.getDate() - daysToMon);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { monday, sunday, now: laDate };
}

function computeKPIs(lessons) {
  const { monday, sunday, now } = getWeekBounds();
  const todayStr = now.toISOString().split('T')[0];

  let due_today = 0, upcoming_7d = 0, overdue = 0, completed = 0, incomplete = 0;
  let due_this_week = 0, completed_this_week = 0, on_time_this_week = 0;

  const in7d = new Date(now); in7d.setDate(in7d.getDate() + 7);

  for (const l of lessons) {
    const due = l.due_at ? new Date(l.due_at) : null;
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
          const completedAt = l.completed_at ? new Date(l.completed_at) : null;
          if (completedAt && completedAt <= due) on_time_this_week++;
        }
      }
    }
  }

  const total = lessons.length;
  const overall_completion_rate = total > 0 ? Math.round((completed / total) * 100) / 100 : null;
  const weekly_completion_rate = due_this_week > 0 ? Math.round((completed_this_week / due_this_week) * 100) / 100 : null;

  const COMPLETION_THRESHOLD = 0.70;
  const OVERDUE_THRESHOLD = 3;
  const intervention = (
    (overall_completion_rate !== null && overall_completion_rate < COMPLETION_THRESHOLD) ||
    overdue >= OVERDUE_THRESHOLD
  );

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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const db = base44.asServiceRole;
    const body = await req.json();
    const { action } = body;

    // ── CREATE LESSON ────────────────────────────────────────────────────────
    if (action === 'create') {
      if (!['admin', 'academic_coach'].includes(user.role)) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
      const { student_id, title, subject, instructions, due_at, points_possible, student_ids } = body;

      // Bulk create support
      const targets = student_ids?.length ? student_ids : [student_id];
      if (!targets[0]) return Response.json({ error: 'student_id required' }, { status: 400 });
      if (!title) return Response.json({ error: 'title required' }, { status: 400 });

      // Coach assignment check
      if (user.role === 'academic_coach') {
        const assignments = await db.entities.CoachAssignment.filter({
          coach_user_id: user.id,
          coach_type: 'academic_coach',
          is_active: true,
        });
        const assignedStudentIds = assignments.map(a => a.student_id);
        const forbidden = targets.filter(id => !assignedStudentIds.includes(id));
        if (forbidden.length > 0) {
          return Response.json({ error: 'One or more students are not assigned to you' }, { status: 403 });
        }
      }

      const created = [];
      for (const sid of targets) {
        const lesson = await db.entities.LessonAssignment.create({
          student_id: sid,
          academic_coach_user_id: user.id,
          academic_coach_email: user.email,
          subject: subject || 'General',
          title,
          instructions: instructions || '',
          assigned_at: new Date().toISOString(),
          due_at: due_at || null,
          status: 'incomplete',
          points_possible: points_possible || 10,
          points_earned: null,
          reward_points_awarded: 0,
        });
        created.push(lesson);
      }

      console.log(`Lesson created: ${title} for ${targets.length} student(s) by ${user.email}`);
      return Response.json({ lessons: created });
    }

    // ── UPDATE LESSON STATUS ────────────────────────────────────────────────
    if (action === 'update_status') {
      const { lesson_id, new_status, comment, points_earned } = body;
      if (!lesson_id || !new_status) return Response.json({ error: 'lesson_id and new_status required' }, { status: 400 });

      const lessons = await db.entities.LessonAssignment.filter({ id: lesson_id });
      const lesson = lessons[0];
      if (!lesson) return Response.json({ error: 'Lesson not found' }, { status: 404 });

      // Permission check
      if (user.role === 'academic_coach' && lesson.academic_coach_user_id !== user.id) {
        return Response.json({ error: 'Not your assigned student' }, { status: 403 });
      }
      if (user.role === 'parent') {
        return Response.json({ error: 'Read-only access' }, { status: 403 });
      }
      // Students can mark their own lessons complete
      if (user.role === 'student') {
        const students = await db.entities.Student.filter({ user_id: user.id });
        const sid = students[0]?.id;
        if (lesson.student_id !== sid) return Response.json({ error: 'Not your lesson' }, { status: 403 });
        if (!['complete', 'incomplete'].includes(new_status)) return Response.json({ error: 'Invalid status' }, { status: 400 });
      }
      if (user.role === 'performance_coach') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
      if (user.role === 'parent') {
        return Response.json({ error: 'Read-only access' }, { status: 403 });
      }
      // Students can mark their own lessons complete/incomplete
      if (user.role === 'student') {
        const students = await db.entities.Student.filter({ user_id: user.id });
        const sid = students[0]?.id;
        if (lesson.student_id !== sid) return Response.json({ error: 'Not your lesson' }, { status: 403 });
        if (!['complete', 'incomplete'].includes(new_status)) return Response.json({ error: 'Invalid status' }, { status: 400 });
      }
      if (user.role === 'admin' && !comment) {
        return Response.json({ error: 'Admin corrections require a comment' }, { status: 400 });
      }

      const old_status = lesson.status;
      const updates = {
        status: new_status,
        completed_at: new_status === 'complete' ? new Date().toISOString() : null,
      };
      if (points_earned != null) updates.points_earned = points_earned;

      await db.entities.LessonAssignment.update(lesson_id, updates);

      // ── Reward trigger: incomplete → complete ──────────────────────────────
      if (new_status === 'complete' && old_status !== 'complete') {
        const rules = await db.entities.RewardRule.filter({ trigger: 'lesson_complete', is_active: true });
        for (const rule of rules) {
          if (rule.subject_filter && rule.subject_filter !== lesson.subject) continue;
          const ikey = `lesson:${lesson_id}:rule:${rule.id}`;
          const dup = await db.entities.RewardTransaction.filter({ idempotency_key: ikey });
          if (dup.length > 0) continue; // idempotency guard
          await db.entities.RewardTransaction.create({
            student_id: lesson.student_id,
            track: rule.track,
            points: rule.points_awarded,
            reason: `Lesson completed: ${lesson.title}`,
            source_type: 'lesson_complete',
            source_id: lesson_id,
            idempotency_key: ikey,
            awarded_by: user.email,
            awarded_at: new Date().toISOString(),
          });
          // Update balance inline (mirrors rewards.js upsertBalance logic)
          const balArr = await db.entities.StudentRewardBalance.filter({ student_id: lesson.student_id });
          const bal = balArr[0];
          const now = new Date().toISOString();
          if (!bal) {
            await db.entities.StudentRewardBalance.create({
              student_id: lesson.student_id,
              academic_points: rule.track === 'academic' ? rule.points_awarded : 0,
              performance_points: rule.track === 'performance' ? rule.points_awarded : 0,
              total_points: rule.points_awarded,
              total_earned: rule.points_awarded,
              total_redeemed: 0,
              last_updated: now,
            });
          } else {
            const ap = (bal.academic_points || 0) + (rule.track === 'academic' ? rule.points_awarded : 0);
            const pp = (bal.performance_points || 0) + (rule.track === 'performance' ? rule.points_awarded : 0);
            await db.entities.StudentRewardBalance.update(bal.id, {
              academic_points: ap,
              performance_points: pp,
              total_points: (bal.total_points || 0) + rule.points_awarded,
              total_earned: (bal.total_earned || 0) + rule.points_awarded,
              last_updated: now,
            });
          }
          console.log(`Reward triggered: ${rule.points_awarded} ${rule.track} pts for lesson ${lesson_id}`);
        }
      }

      // Write history
      await db.entities.LessonStatusHistory.create({
        lesson_id,
        student_id: lesson.student_id,
        previous_status: old_status,
        new_status,
        changed_by: user.email,
        changed_at: new Date().toISOString(),
        reason: comment || '',
      });

      // Admin audit log
      if (user.role === 'admin') {
        await db.entities.AuditLog.create({
          actor_user_id: user.id,
          actor_email: user.email,
          actor_role: 'admin',
          action: 'gradebook_admin_correction',
          resource_type: 'LessonAssignment',
          resource_id: lesson_id,
          description: `Admin changed lesson status ${old_status}→${new_status}: ${comment}`,
          metadata: JSON.stringify({ old_status, new_status, comment }),
          timestamp: new Date().toISOString(),
          severity: 'warning',
        });
      }

      return Response.json({ success: true });
    }

    // ── GET LESSONS WITH KPIs ────────────────────────────────────────────────
    if (action === 'get_lessons') {
      const { student_id, subject, limit = 200 } = body;
      let lessons = [];

      if (user.role === 'academic_coach') {
        lessons = student_id
          ? await db.entities.LessonAssignment.filter({ student_id, academic_coach_user_id: user.id }, '-due_at', limit)
          : await db.entities.LessonAssignment.filter({ academic_coach_user_id: user.id }, '-due_at', limit);
      } else if (user.role === 'student') {
        // Fetch student record for this user
        const students = await db.entities.Student.filter({ user_id: user.id });
        const sid = students[0]?.id;
        if (!sid) return Response.json({ lessons: [], kpis: computeKPIs([]) });
        lessons = await db.entities.LessonAssignment.filter({ student_id: sid }, '-due_at', limit);
      } else if (user.role === 'parent') {
        const parents = await db.entities.Parent.filter({ user_email: user.email });
        const parent = parents[0];
        if (!parent?.student_ids?.length) return Response.json({ lessons: [], kpis: computeKPIs([]) });
        const sid = student_id || parent.student_ids[0];
        lessons = await db.entities.LessonAssignment.filter({ student_id: sid }, '-due_at', limit);
      } else if (user.role === 'admin') {
        lessons = student_id
          ? await db.entities.LessonAssignment.filter({ student_id }, '-due_at', limit)
          : await db.entities.LessonAssignment.list('-due_at', limit);
      }

      if (subject && subject !== 'all') {
        lessons = lessons.filter(l => l.subject === subject);
      }

      const kpis = computeKPIs(lessons);
      return Response.json({ lessons, kpis });
    }

    // ── GET LESSON HISTORY ───────────────────────────────────────────────────
    if (action === 'get_history') {
      const { lesson_id } = body;
      if (!lesson_id) return Response.json({ error: 'lesson_id required' }, { status: 400 });
      const history = await db.entities.LessonStatusHistory.filter({ lesson_id }, '-changed_at', 50);
      return Response.json({ history });
    }

    // ── GET COACH STUDENT QUEUE ─────────────────────────────────────────────
    if (action === 'get_coach_queue') {
      if (!['admin', 'academic_coach'].includes(user.role)) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }

      const assignments = user.role === 'academic_coach'
        ? await db.entities.CoachAssignment.filter({ coach_user_id: user.id, coach_type: 'academic_coach', is_active: true })
        : await db.entities.CoachAssignment.filter({ coach_type: 'academic_coach', is_active: true });

      const results = [];
      for (const ca of assignments) {
        const lessons = await db.entities.LessonAssignment.filter(
          { student_id: ca.student_id, academic_coach_user_id: ca.coach_user_id }, '-due_at', 100
        );
        const kpis = computeKPIs(lessons);
        const students = await db.entities.Student.filter({ id: ca.student_id });
        results.push({
          student_id: ca.student_id,
          student_name: students[0]?.full_name || ca.student_id,
          assignment_id: ca.id,
          kpis,
        });
      }
      return Response.json({ queue: results });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('gradebook error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});