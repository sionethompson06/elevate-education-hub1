import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

// ── Helper: upsert balance ───────────────────────────────────────────────────
async function upsertBalance(db, student_id, track, delta) {
  const existing = await db.entities.StudentRewardBalance.filter({ student_id });
  const bal = existing[0];
  const now = new Date().toISOString();

  if (!bal) {
    const init = {
      student_id,
      academic_points: 0, performance_points: 0, total_points: 0,
      total_earned: 0, total_redeemed: 0, last_updated: now,
    };
    if (track === 'academic') init.academic_points = Math.max(0, delta);
    else init.performance_points = Math.max(0, delta);
    init.total_points = Math.max(0, delta);
    if (delta > 0) init.total_earned = delta;
    if (delta < 0) init.total_redeemed = Math.abs(delta);
    return db.entities.StudentRewardBalance.create(init);
  }

  const updates = { last_updated: now };
  if (track === 'academic') {
    updates.academic_points = Math.max(0, (bal.academic_points || 0) + delta);
  } else {
    updates.performance_points = Math.max(0, (bal.performance_points || 0) + delta);
  }
  updates.total_points = Math.max(0, (bal.total_points || 0) + delta);
  if (delta > 0) updates.total_earned = (bal.total_earned || 0) + delta;
  if (delta < 0) updates.total_redeemed = (bal.total_redeemed || 0) + Math.abs(delta);
  return db.entities.StudentRewardBalance.update(bal.id, updates);
}

// ── Helper: check goal completion ────────────────────────────────────────────
async function checkGoals(db, student_id, track, new_balance_points) {
  const goals = await db.entities.StudentGoal.filter({ student_id, track, status: 'active' });
  for (const goal of goals) {
    if (new_balance_points >= goal.target_points) {
      await db.entities.StudentGoal.update(goal.id, {
        status: 'completed',
        completed_at: new Date().toISOString(),
        current_points: new_balance_points,
      });
      console.log(`Goal completed: ${goal.title} for student ${student_id}`);
    } else {
      await db.entities.StudentGoal.update(goal.id, { current_points: new_balance_points });
    }
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const db = base44.asServiceRole;
    const body = await req.json();
    const { action } = body;

    // ── AWARD POINTS (coach or gradebook trigger) ────────────────────────────
    if (action === 'award_points') {
      const { student_id, track, points, reason, source_type, source_id, idempotency_key } = body;

      // Permission: academic coach → academic track only, performance coach → performance track only
      const allowedRoles = ['admin', 'academic_coach', 'performance_coach'];
      if (!allowedRoles.includes(user.role)) return Response.json({ error: 'Forbidden' }, { status: 403 });
      if (user.role === 'academic_coach' && track !== 'academic') return Response.json({ error: 'Academic coaches can only award academic points' }, { status: 403 });
      if (user.role === 'performance_coach' && track !== 'performance') return Response.json({ error: 'Performance coaches can only award performance points' }, { status: 403 });

      if (!student_id || !track || !points) return Response.json({ error: 'student_id, track, points required' }, { status: 400 });

      // Coach scope check
      if (user.role === 'academic_coach') {
        const assignments = await db.entities.CoachAssignment.filter({ coach_user_id: user.id, coach_type: 'academic_coach', is_active: true });
        if (!assignments.find(a => a.student_id === student_id)) {
          return Response.json({ error: 'Student not assigned to you' }, { status: 403 });
        }
      }
      if (user.role === 'performance_coach') {
        const assignments = await db.entities.CoachAssignment.filter({ coach_user_id: user.id, coach_type: 'performance_coach', is_active: true });
        if (!assignments.find(a => a.student_id === student_id)) {
          return Response.json({ error: 'Student not assigned to you' }, { status: 403 });
        }
      }

      // Idempotency check
      if (idempotency_key) {
        const existing = await db.entities.RewardTransaction.filter({ idempotency_key });
        if (existing.length > 0) {
          console.log(`Duplicate award skipped: ${idempotency_key}`);
          return Response.json({ skipped: true, reason: 'duplicate' });
        }
      }

      const tx = await db.entities.RewardTransaction.create({
        student_id, track, points,
        reason: reason || 'Manual award',
        source_type: source_type || 'manual_award',
        source_id: source_id || null,
        idempotency_key: idempotency_key || null,
        awarded_by: user.email,
        awarded_at: new Date().toISOString(),
      });

      const newBal = await upsertBalance(db, student_id, track, points);
      const trackPoints = track === 'academic' ? newBal.academic_points : newBal.performance_points;
      await checkGoals(db, student_id, track, trackPoints);

      console.log(`Points awarded: ${points} ${track} pts to ${student_id} by ${user.email}`);
      return Response.json({ transaction: tx, balance: newBal });
    }

    // ── AWARD BADGE ──────────────────────────────────────────────────────────
    if (action === 'award_badge') {
      if (!['admin', 'academic_coach', 'performance_coach'].includes(user.role)) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
      const { student_id, badge_id, reason } = body;
      if (!student_id || !badge_id) return Response.json({ error: 'student_id and badge_id required' }, { status: 400 });

      const badges = await db.entities.Badge.filter({ id: badge_id });
      const badge = badges[0];
      if (!badge) return Response.json({ error: 'Badge not found' }, { status: 404 });

      const sb = await db.entities.StudentBadge.create({
        student_id, badge_id,
        badge_name: badge.name,
        badge_icon: badge.icon || '🏅',
        awarded_by: user.email,
        awarded_at: new Date().toISOString(),
        reason: reason || '',
      });
      return Response.json({ student_badge: sb });
    }

    // ── CREATE GOAL ──────────────────────────────────────────────────────────
    if (action === 'create_goal') {
      if (!['admin', 'academic_coach', 'performance_coach'].includes(user.role)) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
      const { student_id, track, title, description, target_points } = body;
      if (!student_id || !track || !title || !target_points) {
        return Response.json({ error: 'student_id, track, title, target_points required' }, { status: 400 });
      }
      const goal = await db.entities.StudentGoal.create({
        student_id, track, title,
        description: description || '',
        target_points,
        current_points: 0,
        status: 'active',
        created_by: user.email,
      });
      return Response.json({ goal });
    }

    // ── GET STUDENT REWARDS ──────────────────────────────────────────────────
    if (action === 'get_student_rewards') {
      const { student_id } = body;

      let sid = student_id;
      // Scope check
      if (user.role === 'student') {
        const students = await db.entities.Student.filter({ user_id: user.id });
        sid = students[0]?.id;
        if (!sid) return Response.json({ balance: null, transactions: [], goals: [], badges: [] });
      } else if (user.role === 'parent' || user.role === 'user') {
        const parents = await db.entities.Parent.filter({ user_email: user.email });
        const parent = parents[0];
        if (!sid) {
          // If no student_id provided, default to first linked student
          sid = parent?.student_ids?.[0];
          if (!sid) return Response.json({ balance: null, transactions: [], goals: [], badges: [] });
        } else if (!parent?.student_ids?.includes(student_id)) {
          return Response.json({ error: 'Not your student' }, { status: 403 });
        }
      } else if (user.role === 'academic_coach' || user.role === 'performance_coach') {
        const ct = user.role === 'academic_coach' ? 'academic_coach' : 'performance_coach';
        const assignments = await db.entities.CoachAssignment.filter({ coach_user_id: user.id, coach_type: ct, is_active: true });
        if (!assignments.find(a => a.student_id === student_id)) {
          return Response.json({ error: 'Student not assigned to you' }, { status: 403 });
        }
      }

      const [balArr, transactions, goals, badges, redemptions] = await Promise.all([
        db.entities.StudentRewardBalance.filter({ student_id: sid }),
        db.entities.RewardTransaction.filter({ student_id: sid }, '-awarded_at', 50),
        db.entities.StudentGoal.filter({ student_id: sid }, '-created_date', 20),
        db.entities.StudentBadge.filter({ student_id: sid }, '-awarded_at', 30),
        db.entities.RewardRedemption.filter({ student_id: sid }, '-requested_at', 20),
      ]);

      return Response.json({
        balance: balArr[0] || null,
        transactions,
        goals,
        badges,
        redemptions,
      });
    }

    // ── REQUEST REDEMPTION ───────────────────────────────────────────────────
    if (action === 'request_redemption') {
      if (!['student', 'admin'].includes(user.role)) return Response.json({ error: 'Forbidden' }, { status: 403 });
      const { student_id, catalog_item_id, track_used } = body;

      const items = await db.entities.RewardCatalogItem.filter({ id: catalog_item_id });
      const item = items[0];
      if (!item || !item.is_active) return Response.json({ error: 'Catalog item not found or inactive' }, { status: 404 });

      // Check balance
      const balArr = await db.entities.StudentRewardBalance.filter({ student_id });
      const bal = balArr[0];
      const available = track_used === 'academic' ? (bal?.academic_points || 0)
        : track_used === 'performance' ? (bal?.performance_points || 0)
        : (bal?.total_points || 0);

      if (available < item.point_cost) {
        return Response.json({ error: `Insufficient points. Need ${item.point_cost}, have ${available}` }, { status: 400 });
      }

      const redemption = await db.entities.RewardRedemption.create({
        student_id, catalog_item_id,
        catalog_item_name: item.name,
        points_spent: item.point_cost,
        track_used: track_used || 'total',
        status: item.requires_admin_approval ? 'pending' : 'approved',
        requested_at: new Date().toISOString(),
        reviewed_by: item.requires_admin_approval ? null : 'auto',
        reviewed_at: item.requires_admin_approval ? null : new Date().toISOString(),
      });

      // Deduct points immediately if auto-approved
      if (!item.requires_admin_approval) {
        const ikey = `redemption:${redemption.id}`;
        await db.entities.RewardTransaction.create({
          student_id, track: track_used === 'academic' ? 'academic' : 'performance',
          points: -item.point_cost,
          reason: `Redeemed: ${item.name}`,
          source_type: 'redemption',
          source_id: redemption.id,
          idempotency_key: ikey,
          awarded_by: user.email,
          awarded_at: new Date().toISOString(),
        });
        await upsertBalance(db, student_id, track_used === 'academic' ? 'academic' : 'performance', -item.point_cost);
      }

      return Response.json({ redemption });
    }

    // ── ADMIN: REVIEW REDEMPTION ─────────────────────────────────────────────
    if (action === 'review_redemption') {
      if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });
      const { redemption_id, decision, notes } = body;
      if (!['approved', 'denied'].includes(decision)) return Response.json({ error: 'decision must be approved or denied' }, { status: 400 });

      const reds = await db.entities.RewardRedemption.filter({ id: redemption_id });
      const redemption = reds[0];
      if (!redemption) return Response.json({ error: 'Redemption not found' }, { status: 404 });

      await db.entities.RewardRedemption.update(redemption_id, {
        status: decision,
        reviewed_by: user.email,
        reviewed_at: new Date().toISOString(),
        notes: notes || '',
      });

      if (decision === 'approved') {
        const ikey = `redemption:${redemption_id}`;
        const existing = await db.entities.RewardTransaction.filter({ idempotency_key: ikey });
        if (existing.length === 0) {
          const track = redemption.track_used === 'academic' ? 'academic' : 'performance';
          await db.entities.RewardTransaction.create({
            student_id: redemption.student_id,
            track, points: -redemption.points_spent,
            reason: `Admin approved redemption: ${redemption.catalog_item_name}`,
            source_type: 'redemption', source_id: redemption_id,
            idempotency_key: ikey,
            awarded_by: user.email, awarded_at: new Date().toISOString(),
          });
          await upsertBalance(db, redemption.student_id, track, -redemption.points_spent);
        }
      }

      await db.entities.AuditLog.create({
        actor_user_id: user.id, actor_email: user.email, actor_role: 'admin',
        action: `redemption_${decision}`,
        resource_type: 'RewardRedemption', resource_id: redemption_id,
        description: `Redemption for ${redemption.catalog_item_name} ${decision}`,
        metadata: JSON.stringify({ notes }),
        timestamp: new Date().toISOString(), severity: 'info',
      });

      return Response.json({ success: true });
    }

    // ── ADMIN: MANUAL ADJUSTMENT ─────────────────────────────────────────────
    if (action === 'admin_adjust') {
      if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });
      const { student_id, track, points, reason } = body;
      if (!student_id || !track || points == null || !reason) {
        return Response.json({ error: 'student_id, track, points, reason required' }, { status: 400 });
      }
      const tx = await db.entities.RewardTransaction.create({
        student_id, track, points,
        reason, source_type: 'admin_adjustment', source_id: null,
        awarded_by: user.email, awarded_at: new Date().toISOString(),
      });
      const newBal = await upsertBalance(db, student_id, track, points);
      await db.entities.AuditLog.create({
        actor_user_id: user.id, actor_email: user.email, actor_role: 'admin',
        action: 'reward_admin_adjustment',
        resource_type: 'StudentRewardBalance', resource_id: student_id,
        description: `Admin adjusted ${points} ${track} pts: ${reason}`,
        metadata: JSON.stringify({ points, track, reason }),
        timestamp: new Date().toISOString(), severity: 'warning',
      });
      return Response.json({ transaction: tx, balance: newBal });
    }

    // ── GET CATALOG ──────────────────────────────────────────────────────────
    if (action === 'get_catalog') {
      const items = await db.entities.RewardCatalogItem.filter({ is_active: true }, 'name', 50);
      return Response.json({ items });
    }

    // ── GET PENDING REDEMPTIONS (admin) ──────────────────────────────────────
    if (action === 'get_pending_redemptions') {
      if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });
      const redemptions = await db.entities.RewardRedemption.filter({ status: 'pending' }, '-requested_at', 50);
      return Response.json({ redemptions });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('rewards error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});