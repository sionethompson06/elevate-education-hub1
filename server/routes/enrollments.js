import { Router } from 'express';
import { eq, desc, and, sql } from 'drizzle-orm';
import db from '../db-postgres.js';
import { enrollments, programs, students, users, billingAccounts, invoices, schoolYears, sections, guardianStudents, enrollmentOverrides } from '../schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { logAudit } from '../services/audit.service.js';

const router = Router();

router.get('/my-students', requireAuth, async (req, res) => {
  try {
    const links = await db.select().from(guardianStudents)
      .where(eq(guardianStudents.guardianUserId, req.user.id));
    const studentIds = links.map(l => l.studentId);

    if (studentIds.length === 0) {
      return res.json({ success: true, students: [], enrollments: [] });
    }

    const myStudents = [];
    const myEnrollments = [];
    for (const sid of studentIds) {
      const [s] = await db.select().from(students).where(eq(students.id, sid));
      if (s) myStudents.push(s);

      const enrs = await db.select({
        id: enrollments.id,
        studentId: enrollments.studentId,
        programId: enrollments.programId,
        sectionId: enrollments.sectionId,
        status: enrollments.status,
        createdAt: enrollments.createdAt,
        programName: programs.name,
        programBillingCycle: programs.billingCycle,
        programTuition: programs.tuitionAmount,
        studentFirstName: students.firstName,
        studentLastName: students.lastName,
      }).from(enrollments)
        .leftJoin(programs, eq(enrollments.programId, programs.id))
        .leftJoin(students, eq(enrollments.studentId, students.id))
        .where(eq(enrollments.studentId, sid));
      myEnrollments.push(...enrs);
    }

    // Attach latest invoice data to each enrollment
    if (myEnrollments.length > 0) {
      const allInvoices = await db.select().from(invoices).orderBy(desc(invoices.createdAt));
      const invoiceMap = {};
      for (const inv of allInvoices) {
        if (inv.enrollmentId && !invoiceMap[inv.enrollmentId]) {
          invoiceMap[inv.enrollmentId] = inv;
        }
      }
      for (const enr of myEnrollments) {
        const inv = invoiceMap[enr.id];
        enr.invoiceId = inv?.id || null;
        enr.invoiceAmount = inv?.amount || null;
        enr.invoiceStatus = inv?.status || null;
        enr.invoiceDueDate = inv?.dueDate || null;
        enr.invoiceDescription = inv?.description || null;
      }
    }

    res.json({ success: true, students: myStudents, enrollments: myEnrollments });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const result = await db.select({
      id: enrollments.id,
      studentId: enrollments.studentId,
      programId: enrollments.programId,
      sectionId: enrollments.sectionId,
      schoolYearId: enrollments.schoolYearId,
      status: enrollments.status,
      startDate: enrollments.startDate,
      endDate: enrollments.endDate,
      enrolledBy: enrollments.enrolledBy,
      createdAt: enrollments.createdAt,
      studentFirstName: students.firstName,
      studentLastName: students.lastName,
      programName: programs.name,
      programTuition: programs.tuitionAmount,
      programBillingCycle: programs.billingCycle,
      parentFirstName: users.firstName,
      parentLastName: users.lastName,
      parentEmail: users.email,
    }).from(enrollments)
      .leftJoin(students, eq(enrollments.studentId, students.id))
      .leftJoin(programs, eq(enrollments.programId, programs.id))
      .leftJoin(users, eq(enrollments.enrolledBy, users.id))
      .orderBy(desc(enrollments.createdAt));

    // Fetch all invoices and map to the latest per enrollment
    const allInvoices = await db.select().from(invoices).orderBy(desc(invoices.createdAt));
    const invoiceMap = {};
    for (const inv of allInvoices) {
      if (inv.enrollmentId && !invoiceMap[inv.enrollmentId]) {
        invoiceMap[inv.enrollmentId] = inv;
      }
    }

    const enriched = result.map(e => ({
      ...e,
      invoiceId: invoiceMap[e.id]?.id || null,
      invoiceAmount: invoiceMap[e.id]?.amount || null,
      invoiceStatus: invoiceMap[e.id]?.status || null,
      invoiceDueDate: invoiceMap[e.id]?.dueDate || null,
      invoicePaidDate: invoiceMap[e.id]?.paidDate || null,
      invoiceDescription: invoiceMap[e.id]?.description || null,
    }));

    res.json({ success: true, enrollments: enriched });
  } catch (err) {
    console.error('List enrollments error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { studentId, programId } = req.body;
    if (!studentId || !programId) {
      return res.status(400).json({ success: false, error: 'Student and program are required' });
    }

    if (req.user.role !== 'admin') {
      const [link] = await db.select().from(guardianStudents)
        .where(and(
          eq(guardianStudents.guardianUserId, req.user.id),
          eq(guardianStudents.studentId, parseInt(studentId))
        ));
      if (!link) {
        return res.status(403).json({ success: false, error: 'You can only enroll your own students' });
      }
    }

    const [program] = await db.select().from(programs).where(eq(programs.id, parseInt(programId)));
    if (!program) return res.status(404).json({ success: false, error: 'Program not found' });

    // Get or auto-create current school year
    let [currentYear] = await db.select().from(schoolYears).where(eq(schoolYears.isCurrent, true));
    if (!currentYear) {
      const now = new Date();
      const yearLabel = `${now.getFullYear()}-${now.getFullYear() + 1}`;
      [currentYear] = await db.insert(schoolYears).values({
        name: yearLabel,
        startDate: `${now.getFullYear()}-08-01`,
        endDate: `${now.getFullYear() + 1}-06-30`,
        isCurrent: true,
      }).returning();
    }

    const existingEnrollment = await db.select().from(enrollments)
      .where(and(
        eq(enrollments.studentId, parseInt(studentId)),
        eq(enrollments.programId, parseInt(programId)),
        eq(enrollments.schoolYearId, currentYear.id)
      ));
    if (existingEnrollment.length > 0) {
      return res.status(400).json({ success: false, error: 'Student is already enrolled in this program for the current year' });
    }

    // Sequential inserts — neon-http driver does not support transactions
    const [enrollment] = await db.insert(enrollments).values({
      studentId: parseInt(studentId),
      programId: parseInt(programId),
      schoolYearId: currentYear.id,
      status: 'pending_payment',
      enrolledBy: req.user.id,
    }).returning();

    let [billingAccount] = await db.select().from(billingAccounts)
      .where(eq(billingAccounts.parentUserId, req.user.id));
    if (!billingAccount) {
      [billingAccount] = await db.insert(billingAccounts).values({
        parentUserId: req.user.id,
      }).returning();
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    const [invoice] = await db.insert(invoices).values({
      billingAccountId: billingAccount.id,
      enrollmentId: enrollment.id,
      description: `Tuition - ${program.name}`,
      amount: program.tuitionAmount,
      dueDate: dueDate.toISOString().split('T')[0],
    }).returning();

    const result = { enrollment, invoice, billingAccount };

    await logAudit({
      userId: req.user.id,
      action: 'create',
      entityType: 'enrollment',
      entityId: result.enrollment.id,
      details: { studentId, programId, programName: program.name },
      ipAddress: req.ip,
    });

    await logAudit({
      userId: req.user.id,
      action: 'create',
      entityType: 'invoice',
      entityId: result.invoice.id,
      details: { amount: program.tuitionAmount, enrollmentId: result.enrollment.id },
      ipAddress: req.ip,
    });

    res.json({ success: true, enrollment: result.enrollment, invoice: result.invoice });
  } catch (err) {
    console.error('Enrollment error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.patch('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status, sectionId } = req.body;
    const updateData = {};
    if (status !== undefined) updateData.status = status;
    if (sectionId !== undefined) updateData.sectionId = sectionId ? parseInt(sectionId) : null;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    const [updated] = await db.update(enrollments).set(updateData).where(eq(enrollments.id, id)).returning();
    if (!updated) return res.status(404).json({ success: false, error: 'Enrollment not found' });

    await logAudit({
      userId: req.user.id,
      action: 'update',
      entityType: 'enrollment',
      entityId: id,
      details: updateData,
      ipAddress: req.ip,
    });

    res.json({ success: true, enrollment: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Override routes ───────────────────────────────────────────────────────────

// GET /api/enrollments/:id/overrides — list all overrides for an enrollment
router.get('/:id/overrides', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const enrollmentId = parseInt(req.params.id);
    if (isNaN(enrollmentId)) return res.status(400).json({ success: false, error: 'Invalid enrollment ID' });

    // Query via raw SQL since the table may have been created post-startup
    const rows = await db.execute(sql`
      SELECT eo.*,
             u.first_name || ' ' || u.last_name AS approved_by_full_name
      FROM enrollment_overrides eo
      LEFT JOIN users u ON u.id = eo.approved_by_user_id
      WHERE eo.enrollment_id = ${enrollmentId}
      ORDER BY eo.created_at DESC
    `);

    const overrides = (rows.rows || rows).map(o => ({
      id: o.id,
      enrollmentId: o.enrollment_id,
      overrideType: o.override_type,
      reason: o.reason,
      amountWaivedCents: o.amount_waived_cents,
      amountDeferredCents: o.amount_deferred_cents,
      amountDueNowCents: o.amount_due_now_cents,
      effectiveStartAt: o.effective_start_at,
      effectiveEndAt: o.effective_end_at,
      isActive: o.is_active,
      approvedByUserId: o.approved_by_user_id,
      approvedByName: o.approved_by_name || o.approved_by_full_name || 'Admin',
      approvedAt: o.approved_at,
      revokedAt: o.revoked_at,
      revokeReason: o.revoke_reason,
      notes: o.notes,
      createdAt: o.created_at,
    }));

    res.json({ success: true, overrides });
  } catch (err) {
    console.error('List overrides error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/enrollments/:id/override — apply an override
// Sets enrollment → active_override, marks invoice waived (if comped/scholarship)
// Makes student active for downstream workflows
router.post('/:id/override', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const enrollmentId = parseInt(req.params.id);
    if (isNaN(enrollmentId)) return res.status(400).json({ success: false, error: 'Invalid enrollment ID' });

    const {
      overrideType, reason,
      amountWaivedCents = 0, amountDeferredCents = 0, amountDueNowCents = 0,
      effectiveStartAt, effectiveEndAt, notes,
    } = req.body;

    if (!overrideType) return res.status(400).json({ success: false, error: 'overrideType is required' });
    if (!reason?.trim()) return res.status(400).json({ success: false, error: 'reason is required' });

    const [enrollment] = await db.select().from(enrollments).where(eq(enrollments.id, enrollmentId));
    if (!enrollment) return res.status(404).json({ success: false, error: 'Enrollment not found' });

    const [admin] = await db.select({
      id: users.id, firstName: users.firstName, lastName: users.lastName,
    }).from(users).where(eq(users.id, req.user.id));
    const adminName = admin ? `${admin.firstName} ${admin.lastName}`.trim() : 'Admin';

    // Deactivate any prior active override on this enrollment
    await db.execute(sql`
      UPDATE enrollment_overrides
      SET is_active = FALSE, revoked_at = NOW(), revoke_reason = 'Superseded by new override'
      WHERE enrollment_id = ${enrollmentId} AND is_active = TRUE
    `);

    // Insert the new override record
    const inserted = await db.execute(sql`
      INSERT INTO enrollment_overrides
        (enrollment_id, override_type, reason,
         amount_waived_cents, amount_deferred_cents, amount_due_now_cents,
         effective_start_at, effective_end_at,
         is_active, approved_by_user_id, approved_by_name, approved_at, notes)
      VALUES
        (${enrollmentId}, ${overrideType}, ${reason.trim()},
         ${Number(amountWaivedCents)}, ${Number(amountDeferredCents)}, ${Number(amountDueNowCents)},
         ${effectiveStartAt || null}, ${effectiveEndAt || null},
         TRUE, ${req.user.id}, ${adminName}, NOW(),
         ${notes || null})
      RETURNING *
    `);
    const newOverride = (inserted.rows || inserted)[0];

    // Update enrollment status → active_override
    await db.update(enrollments)
      .set({ status: 'active_override' })
      .where(eq(enrollments.id, enrollmentId));

    // Mark student as active so they're eligible for downstream assignment
    if (enrollment.studentId) {
      await db.update(students)
        .set({ status: 'active' })
        .where(eq(students.id, enrollment.studentId));
    }

    // If comped or scholarship: mark linked invoice as waived (status = 'waived')
    // If deferred: leave invoice pending, just activate the enrollment
    if (['comped', 'scholarship'].includes(overrideType)) {
      await db.execute(sql`
        UPDATE invoices SET status = 'waived' WHERE enrollment_id = ${enrollmentId} AND status != 'paid'
      `);
    }

    await logAudit({
      userId: req.user.id,
      action: 'override_create',
      entityType: 'enrollment',
      entityId: enrollmentId,
      details: { overrideType, reason, adminName },
      ipAddress: req.ip,
    });

    res.json({ success: true, override: newOverride });
  } catch (err) {
    console.error('Apply override error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/enrollments/overrides/:overrideId/revoke — revoke an override
// Reverts enrollment to pending_payment
router.patch('/overrides/:overrideId/revoke', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const overrideId = parseInt(req.params.overrideId);
    if (isNaN(overrideId)) return res.status(400).json({ success: false, error: 'Invalid override ID' });

    const { revokeReason } = req.body;
    if (!revokeReason?.trim()) return res.status(400).json({ success: false, error: 'revokeReason is required' });

    // Fetch override to get enrollment_id
    const rows = await db.execute(sql`
      SELECT * FROM enrollment_overrides WHERE id = ${overrideId}
    `);
    const override = (rows.rows || rows)[0];
    if (!override) return res.status(404).json({ success: false, error: 'Override not found' });
    if (!override.is_active) return res.status(400).json({ success: false, error: 'Override is already revoked' });

    // Deactivate the override
    await db.execute(sql`
      UPDATE enrollment_overrides
      SET is_active = FALSE, revoked_at = NOW(), revoke_reason = ${revokeReason.trim()}
      WHERE id = ${overrideId}
    `);

    // Revert enrollment to pending_payment
    await db.update(enrollments)
      .set({ status: 'pending_payment' })
      .where(eq(enrollments.id, override.enrollment_id));

    // Re-open waived invoices if any
    await db.execute(sql`
      UPDATE invoices SET status = 'pending' WHERE enrollment_id = ${override.enrollment_id} AND status = 'waived'
    `);

    await logAudit({
      userId: req.user.id,
      action: 'override_revoke',
      entityType: 'enrollment',
      entityId: override.enrollment_id,
      details: { overrideId, revokeReason },
      ipAddress: req.ip,
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Revoke override error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
