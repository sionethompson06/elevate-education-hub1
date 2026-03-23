import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Enrollment function — handles the full parent enrollment flow:
 * - get_programs: list all active programs
 * - enroll: create Parent record (if missing), Student record (if missing), and Enrollment record
 * - get_my_enrollments: get all enrollments for the calling parent's students
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const db = base44.asServiceRole;
    const body = await req.json();
    const { action } = body;

    // ── GET PROGRAMS ──────────────────────────────────────────────────────────
    if (action === 'get_programs') {
      const programs = await db.entities.Program.filter({ is_active: true }, 'name', 50);
      return Response.json({ programs });
    }

    // ── ENROLL ────────────────────────────────────────────────────────────────
    if (action === 'enroll') {
      if (user.role !== 'parent' && user.role !== 'user' && user.role !== 'admin') {
        return Response.json({ error: 'Only parents can enroll students' }, { status: 403 });
      }

      const { program_id, student_id, billing_cycle } = body;
      if (!program_id) return Response.json({ error: 'program_id required' }, { status: 400 });

      // Validate program exists
      const programs = await db.entities.Program.filter({ id: program_id });
      const program = programs[0];
      if (!program) return Response.json({ error: 'Program not found' }, { status: 404 });

      // Get or create Parent record
      let parents = await db.entities.Parent.filter({ user_email: user.email });
      let parent = parents[0];
      if (!parent) {
        parent = await db.entities.Parent.create({
          user_id: user.id,
          user_email: user.email,
          full_name: user.full_name || user.email,
          student_ids: [],
          is_primary_contact: true,
          billing_email: user.email,
        });
        console.log(`Created Parent record for ${user.email}`);
      }

      // Determine student — either supplied or first linked student
      let targetStudentId = student_id;
      if (!targetStudentId) {
        if (parent.student_ids?.length > 0) {
          targetStudentId = parent.student_ids[0];
        } else {
          // Create a placeholder student record linked to this parent
          const student = await db.entities.Student.create({
            user_id: user.id,
            user_email: user.email,
            full_name: user.full_name || user.email,
            parent_ids: [parent.id],
            is_active: true,
          });
          targetStudentId = student.id;
          // Link student to parent
          await db.entities.Parent.update(parent.id, {
            student_ids: [student.id],
          });
          console.log(`Created placeholder Student record ${student.id} for parent ${user.email}`);
        }
      } else {
        // Verify this student belongs to this parent
        if (user.role !== 'admin' && !parent.student_ids?.includes(targetStudentId)) {
          return Response.json({ error: 'Student not linked to your account' }, { status: 403 });
        }
      }

      // Check for duplicate active enrollment in same program
      const existing = await db.entities.Enrollment.filter({
        student_id: targetStudentId,
        program_id,
      });
      const alreadyEnrolled = existing.find(e => ['active', 'active_override', 'pending_payment'].includes(e.status));
      if (alreadyEnrolled) {
        return Response.json({
          error: 'Already enrolled in this program',
          enrollment_id: alreadyEnrolled.id,
          status: alreadyEnrolled.status,
        }, { status: 409 });
      }

      // Create enrollment record
      const enrollment = await db.entities.Enrollment.create({
        student_id: targetStudentId,
        student_email: user.email,
        program_id,
        program_name: program.name,
        status: 'pending_payment',
        payment_status: 'unpaid',
        billing_cycle: billing_cycle || 'monthly',
        enrolled_date: new Date().toISOString().split('T')[0],
        amount_due: billing_cycle === 'annual' ? (program.price_annual || 0) : (program.price_monthly || 0),
        notes: '',
      });

      console.log(`Enrollment created: ${enrollment.id} for student ${targetStudentId} in program ${program.name}`);
      return Response.json({ enrollment, program });
    }

    // ── GET MY ENROLLMENTS ────────────────────────────────────────────────────
    if (action === 'get_my_enrollments') {
      if (!['parent', 'user', 'admin'].includes(user.role)) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }

      const parents = await db.entities.Parent.filter({ user_email: user.email });
      const parent = parents[0];
      if (!parent?.student_ids?.length) return Response.json({ enrollments: [], programs: [] });

      const allEnrollments = [];
      for (const sid of parent.student_ids) {
        const enrs = await db.entities.Enrollment.filter({ student_id: sid }, '-enrolled_date', 50);
        allEnrollments.push(...enrs);
      }

      const programs = await db.entities.Program.filter({ is_active: true }, 'name', 50);
      return Response.json({ enrollments: allEnrollments, programs });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('enrollment error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});