/**
 * dataAccess — Server-side permission enforcement for all role-scoped data reads.
 *
 * POST / with JSON body: { action, params }
 *
 * Supported actions:
 *   getMyStudentProfile        — student gets own Student record
 *   getMyEnrollments           — student gets own enrollments
 *   getMyLessons               — student gets own lessons
 *   getMyRewardBalance         — student gets own reward balance
 *   getParentStudents          — parent gets linked students
 *   getParentEnrollments       — parent gets enrollments for linked students
 *   getCoachStudents           — coach gets assigned students
 *   getCoachLessons            — coach gets lessons for assigned students
 *   adminGetAll                — admin gets any entity list (entity_name required in params)
 *   adminGetEnrollments        — admin gets all enrollments (with optional filters)
 *   adminGetPayments           — admin gets all payments
 *   adminGetOverrides          — admin gets all payment overrides
 *   adminGetAuditLogs          — admin gets audit logs
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function writeAuditLog(base44, { actor, action, resource_type, resource_id, description, severity = "info", metadata = null }) {
  await base44.asServiceRole.entities.AuditLog.create({
    actor_user_id: actor.id,
    actor_email: actor.email,
    actor_role: actor.role,
    action,
    resource_type,
    resource_id,
    description,
    metadata: metadata ? JSON.stringify(metadata) : null,
    timestamp: new Date().toISOString(),
    severity,
  }).catch(() => {});
}

function deny(reason, status = 403) {
  return Response.json({ error: reason }, { status });
}

// ── Main Handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  // Authenticate
  const user = await base44.auth.me().catch(() => null);
  if (!user) return deny("Unauthorized", 401);

  const body = await req.json().catch(() => ({}));
  const { action, params = {} } = body;

  if (!action) return deny("Missing action");

  const role = user.role;

  // ── STUDENT ACTIONS ───────────────────────────────────────────────────────
  if (action === "getMyStudentProfile") {
    if (role !== "student") {
      await writeAuditLog(base44, { actor: user, action: "access_denied", resource_type: "Student", description: `Role ${role} attempted student-only action`, severity: "warning" });
      return deny("Students only");
    }
    const students = await base44.asServiceRole.entities.Student.filter({ user_email: user.email });
    return Response.json({ data: students[0] || null });
  }

  if (action === "getMyEnrollments") {
    if (role !== "student") {
      await writeAuditLog(base44, { actor: user, action: "access_denied", resource_type: "Enrollment", description: `Role ${role} attempted student-only action`, severity: "warning" });
      return deny("Students only");
    }
    const students = await base44.asServiceRole.entities.Student.filter({ user_email: user.email });
    if (!students.length) return Response.json({ data: [] });
    const enrollments = await base44.asServiceRole.entities.Enrollment.filter({ student_id: students[0].id });
    return Response.json({ data: enrollments });
  }

  if (action === "getMyLessons") {
    if (role !== "student") return deny("Students only");
    const students = await base44.asServiceRole.entities.Student.filter({ user_email: user.email });
    if (!students.length) return Response.json({ data: [] });
    const lessons = await base44.asServiceRole.entities.LessonAssignment.filter({ student_id: students[0].id });
    return Response.json({ data: lessons });
  }

  if (action === "getMyRewardBalance") {
    if (role !== "student") return deny("Students only");
    const students = await base44.asServiceRole.entities.Student.filter({ user_email: user.email });
    if (!students.length) return Response.json({ data: null });
    const balances = await base44.asServiceRole.entities.StudentRewardBalance.filter({ student_id: students[0].id });
    return Response.json({ data: balances[0] || null });
  }

  // ── PARENT ACTIONS ────────────────────────────────────────────────────────
  if (action === "getParentStudents") {
    if (role !== "parent") {
      await writeAuditLog(base44, { actor: user, action: "access_denied", resource_type: "Parent", description: `Role ${role} attempted parent-only action`, severity: "warning" });
      return deny("Parents only");
    }
    const parents = await base44.asServiceRole.entities.Parent.filter({ user_email: user.email });
    if (!parents.length) return Response.json({ data: [] });
    const parent = parents[0];
    const studentIds = parent.student_ids || [];
    if (!studentIds.length) return Response.json({ data: [] });

    const studentPromises = studentIds.map(id => base44.asServiceRole.entities.Student.filter({ id }));
    const allResults = await Promise.all(studentPromises);
    const students = allResults.flat();
    return Response.json({ data: students });
  }

  if (action === "getParentEnrollments") {
    if (role !== "parent") return deny("Parents only");
    const parents = await base44.asServiceRole.entities.Parent.filter({ user_email: user.email });
    if (!parents.length) return Response.json({ data: [] });
    const studentIds = parents[0].student_ids || [];
    if (!studentIds.length) return Response.json({ data: [] });

    const allEnrollments = await Promise.all(
      studentIds.map(sid => base44.asServiceRole.entities.Enrollment.filter({ student_id: sid }))
    );
    return Response.json({ data: allEnrollments.flat() });
  }

  // ── COACH ACTIONS ─────────────────────────────────────────────────────────
  if (action === "getCoachStudents") {
    if (role !== "academic_coach" && role !== "performance_coach") {
      await writeAuditLog(base44, { actor: user, action: "access_denied", resource_type: "CoachAssignment", description: `Role ${role} attempted coach-only action`, severity: "warning" });
      return deny("Coaches only");
    }
    const assignments = await base44.asServiceRole.entities.CoachAssignment.filter({
      coach_email: user.email,
      coach_type: role,
      is_active: true,
    });
    if (!assignments.length) return Response.json({ data: [] });
    const studentIds = assignments.map(a => a.student_id);
    const students = await Promise.all(studentIds.map(sid => base44.asServiceRole.entities.Student.filter({ id: sid })));
    return Response.json({ data: students.flat() });
  }

  if (action === "getCoachLessons") {
    if (role !== "academic_coach" && role !== "performance_coach") return deny("Coaches only");
    const assignments = await base44.asServiceRole.entities.CoachAssignment.filter({
      coach_email: user.email,
      coach_type: role,
      is_active: true,
    });
    if (!assignments.length) return Response.json({ data: [] });
    const studentIds = assignments.map(a => a.student_id);
    const lessons = await Promise.all(
      studentIds.map(sid => base44.asServiceRole.entities.LessonAssignment.filter({ student_id: sid, coach_user_id: user.id }))
    );
    return Response.json({ data: lessons.flat() });
  }

  // ── ADMIN ACTIONS ─────────────────────────────────────────────────────────
  if (action.startsWith("admin")) {
    if (role !== "admin") {
      await writeAuditLog(base44, { actor: user, action: "access_denied", resource_type: "admin_endpoint", description: `Role ${role} attempted admin action: ${action}`, severity: "critical" });
      return deny("Admin only", 403);
    }

    if (action === "adminGetAll") {
      const { entity_name, filters = {}, sort = "-created_date", limit = 50 } = params;
      if (!entity_name) return deny("entity_name required");
      const data = await base44.asServiceRole.entities[entity_name].list(sort, limit);
      return Response.json({ data });
    }

    if (action === "adminGetEnrollments") {
      const { status, student_id } = params;
      const filters = {};
      if (status) filters.status = status;
      if (student_id) filters.student_id = student_id;
      const data = Object.keys(filters).length
        ? await base44.asServiceRole.entities.Enrollment.filter(filters)
        : await base44.asServiceRole.entities.Enrollment.list("-created_date", 100);
      return Response.json({ data });
    }

    if (action === "adminGetPayments") {
      const { enrollment_id, student_id, status } = params;
      const filters = {};
      if (enrollment_id) filters.enrollment_id = enrollment_id;
      if (student_id) filters.student_id = student_id;
      if (status) filters.status = status;
      const data = Object.keys(filters).length
        ? await base44.asServiceRole.entities.Payment.filter(filters)
        : await base44.asServiceRole.entities.Payment.list("-created_date", 100);
      return Response.json({ data });
    }

    if (action === "adminGetOverrides") {
      const data = await base44.asServiceRole.entities.PaymentOverride.list("-created_date", 100);
      return Response.json({ data });
    }

    if (action === "adminGetAuditLogs") {
      const { severity, actor_email } = params;
      const filters = {};
      if (severity) filters.severity = severity;
      if (actor_email) filters.actor_email = actor_email;
      const data = Object.keys(filters).length
        ? await base44.asServiceRole.entities.AuditLog.filter(filters, "-timestamp", 200)
        : await base44.asServiceRole.entities.AuditLog.list("-timestamp", 200);
      return Response.json({ data });
    }
  }

  return deny(`Unknown action: ${action}`);
});