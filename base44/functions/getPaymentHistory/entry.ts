import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const db = base44.asServiceRole;

    // Get parent record
    const parents = await db.entities.Parent.filter({ user_email: user.email });
    const parent = parents[0];
    if (!parent) return Response.json({ payments: [], enrollments: [] });

    const studentIds = parent.student_ids || [];
    if (!studentIds.length) return Response.json({ payments: [], enrollments: [] });

    // Get all enrollments for this parent's students
    const enrollmentPromises = studentIds.map((sid) =>
      db.entities.Enrollment.filter({ student_id: sid })
    );
    const enrollmentArrays = await Promise.all(enrollmentPromises);
    const enrollments = enrollmentArrays.flat();

    // Get payment history for each enrollment
    const paymentPromises = enrollments.map((e) =>
      db.entities.Payment.filter({ enrollment_id: e.id })
    );
    const paymentArrays = await Promise.all(paymentPromises);
    const payments = paymentArrays.flat().sort((a, b) =>
      new Date(b.paid_at || b.created_date) - new Date(a.paid_at || a.created_date)
    );

    return Response.json({ payments, enrollments, parent });
  } catch (error) {
    console.error('getPaymentHistory error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});