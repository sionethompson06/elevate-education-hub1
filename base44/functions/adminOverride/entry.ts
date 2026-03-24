import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') {
      // Log denied attempt
      await base44.asServiceRole.entities.AuditLog.create({
        actor_user_id: user.id,
        actor_email: user.email,
        actor_role: user.role,
        action: 'override_access_denied',
        resource_type: 'PaymentOverride',
        description: `Non-admin attempted override action`,
        timestamp: new Date().toISOString(),
        severity: 'warning',
      });
      return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    const db = base44.asServiceRole;
    const body = await req.json();
    const { action } = body;

    // ── CREATE OVERRIDE ─────────────────────────────────────────────────────
    if (action === 'create') {
      const {
        enrollment_id, override_type, reason,
        amount_waived_cents = 0, amount_deferred_cents = 0, amount_due_now_cents = 0,
        effective_start_at, effective_end_at,
      } = body;

      if (!enrollment_id || !override_type || !reason) {
        return Response.json({ error: 'enrollment_id, override_type, and reason are required' }, { status: 400 });
      }

      const enrollments = await db.entities.Enrollment.filter({ id: enrollment_id });
      const enrollment = enrollments[0];
      if (!enrollment) return Response.json({ error: 'Enrollment not found' }, { status: 404 });

      const prevStatus = enrollment.status;
      const prevPayment = enrollment.payment_status;

      // Determine new payment_status from amounts
      let newPaymentStatus = 'waived';
      if (amount_due_now_cents > 0 && (amount_waived_cents > 0 || amount_deferred_cents > 0)) {
        newPaymentStatus = 'partial';
      } else if (amount_deferred_cents > 0 && amount_waived_cents === 0) {
        newPaymentStatus = 'deferred';
      } else if (amount_waived_cents > 0) {
        newPaymentStatus = 'waived';
      }

      // Create override record
      const override = await db.entities.PaymentOverride.create({
        enrollment_id,
        student_id: enrollment.student_id,
        override_type,
        amount_original: enrollment.amount_due || 0,
        amount_overridden: amount_due_now_cents / 100,
        reason,
        approved_by: user.email,
        approved_at: new Date().toISOString(),
        effective_date: effective_start_at || new Date().toISOString().split('T')[0],
        expiry_date: effective_end_at || null,
        is_active: true,
        notes: `amount_waived: $${amount_waived_cents/100}, amount_deferred: $${amount_deferred_cents/100}, due_now: $${amount_due_now_cents/100}`,
      });

      // Activate enrollment
      await db.entities.Enrollment.update(enrollment_id, {
        status: 'active_override',
        payment_status: newPaymentStatus,
        override_id: override.id,
        amount_due: amount_due_now_cents / 100,
      });

      // Write audit log
      await db.entities.AuditLog.create({
        actor_user_id: user.id,
        actor_email: user.email,
        actor_role: user.role,
        action: 'payment_override_created',
        resource_type: 'PaymentOverride',
        resource_id: override.id,
        description: `Override (${override_type}) created for enrollment ${enrollment_id}`,
        metadata: JSON.stringify({
          enrollment_id, override_type, reason,
          before: { status: prevStatus, payment_status: prevPayment },
          after: { status: 'active_override', payment_status: newPaymentStatus },
          amount_waived_cents, amount_deferred_cents, amount_due_now_cents,
        }),
        timestamp: new Date().toISOString(),
        severity: 'info',
      });

      console.log(`Override created: ${override.id} for enrollment ${enrollment_id}`);
      return Response.json({ override, enrollment_status: 'active_override', payment_status: newPaymentStatus });
    }

    // ── REVOKE OVERRIDE ──────────────────────────────────────────────────────
    if (action === 'revoke') {
      const { override_id, revoke_reason } = body;
      if (!override_id || !revoke_reason) {
        return Response.json({ error: 'override_id and revoke_reason are required' }, { status: 400 });
      }

      const overrides = await db.entities.PaymentOverride.filter({ id: override_id });
      const override = overrides[0];
      if (!override) return Response.json({ error: 'Override not found' }, { status: 404 });

      const enrollment_id = override.enrollment_id;
      const enrollments = await db.entities.Enrollment.filter({ id: enrollment_id });
      const enrollment = enrollments[0];

      const prevStatus = enrollment?.status;

      // Deactivate override
      await db.entities.PaymentOverride.update(override_id, {
        is_active: false,
        notes: (override.notes || '') + `\nREVOKED by ${user.email} at ${new Date().toISOString()}: ${revoke_reason}`,
      });

      // Revert enrollment to pending_payment
      if (enrollment) {
        await db.entities.Enrollment.update(enrollment_id, {
          status: 'pending_payment',
          payment_status: 'unpaid',
          override_id: null,
          amount_due: override.amount_original || 0,
        });
      }

      await db.entities.AuditLog.create({
        actor_user_id: user.id,
        actor_email: user.email,
        actor_role: user.role,
        action: 'payment_override_revoked',
        resource_type: 'PaymentOverride',
        resource_id: override_id,
        description: `Override revoked for enrollment ${enrollment_id}: ${revoke_reason}`,
        metadata: JSON.stringify({
          enrollment_id, revoke_reason,
          before: { status: prevStatus, override_active: true },
          after: { status: 'pending_payment', override_active: false },
        }),
        timestamp: new Date().toISOString(),
        severity: 'warning',
      });

      console.log(`Override revoked: ${override_id}`);
      return Response.json({ success: true });
    }

    // ── GET OVERRIDES ────────────────────────────────────────────────────────
    if (action === 'list') {
      const { enrollment_id } = body;
      const overrides = enrollment_id
        ? await db.entities.PaymentOverride.filter({ enrollment_id })
        : await db.entities.PaymentOverride.list('-approved_at', 50);
      return Response.json({ overrides });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('adminOverride error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});