import { Router } from 'express';
import { eq, desc, and, ne } from 'drizzle-orm';
import db from '../db-postgres.js';
import { enrollments, programs, students, users, billingAccounts, invoices, schoolYears, sections, guardianStudents, enrollmentOverrides, coachAssignments, staffProfiles } from '../schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { logAudit } from '../services/audit.service.js';
import { createNotification } from '../services/notification.service.js';

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

    // Attach coach assignments (with coach user details) to each student
    if (myStudents.length > 0) {
      const allCoachRows = await db.select({
        studentId: coachAssignments.studentId,
        coachType: coachAssignments.coachType,
        coachFirstName: users.firstName,
        coachLastName: users.lastName,
        coachTitle: staffProfiles.title,
      }).from(coachAssignments)
        .innerJoin(users, eq(coachAssignments.coachUserId, users.id))
        .leftJoin(staffProfiles, eq(coachAssignments.coachUserId, staffProfiles.userId))
        .where(eq(coachAssignments.isActive, true));

      const studentIdSet = new Set(myStudents.map(s => s.id));
      const coachMap = {};
      for (const row of allCoachRows) {
        if (!studentIdSet.has(row.studentId)) continue;
        if (!coachMap[row.studentId]) coachMap[row.studentId] = [];
        coachMap[row.studentId].push({
          coachType: row.coachType,
          coachFirstName: row.coachFirstName,
          coachLastName: row.coachLastName,
          coachTitle: row.coachTitle,
        });
      }
      for (const s of myStudents) {
        s.coaches = coachMap[s.id] || [];
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
      billingCycleOverride: enrollments.billingCycleOverride,
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
      billingCycle: e.billingCycleOverride || e.programBillingCycle,
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

// GET /api/enrollments/:id — single enrollment (parent: must own it; admin: any)
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid enrollment ID' });

    const [row] = await db.select({
      id: enrollments.id,
      studentId: enrollments.studentId,
      programId: enrollments.programId,
      sectionId: enrollments.sectionId,
      schoolYearId: enrollments.schoolYearId,
      status: enrollments.status,
      startDate: enrollments.startDate,
      endDate: enrollments.endDate,
      createdAt: enrollments.createdAt,
      programName: programs.name,
      programBillingCycle: programs.billingCycle,
      programTuition: programs.tuitionAmount,
      studentFirstName: students.firstName,
      studentLastName: students.lastName,
    }).from(enrollments)
      .leftJoin(programs, eq(enrollments.programId, programs.id))
      .leftJoin(students, eq(enrollments.studentId, students.id))
      .where(eq(enrollments.id, id));

    if (!row) return res.status(404).json({ success: false, error: 'Enrollment not found' });

    // Parent can only view their own students' enrollments
    if (req.user.role === 'parent') {
      const [link] = await db.select().from(guardianStudents).where(
        and(eq(guardianStudents.guardianUserId, req.user.id), eq(guardianStudents.studentId, row.studentId))
      );
      if (!link) return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    res.json({ success: true, enrollment: row });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.patch('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status, sectionId, startDate, billingCycleOverride } = req.body;
    const updateData = {};
    if (status !== undefined) updateData.status = status;
    if (sectionId !== undefined) updateData.sectionId = sectionId ? parseInt(sectionId) : null;
    if (startDate !== undefined) updateData.startDate = startDate || null;
    if (billingCycleOverride !== undefined) updateData.billingCycleOverride = billingCycleOverride || null;

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

// PATCH /api/enrollments/:id/invoice — update the invoice linked to this enrollment
router.patch('/:id/invoice', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const enrollmentId = parseInt(req.params.id);
    if (isNaN(enrollmentId)) return res.status(400).json({ success: false, error: 'Invalid enrollment ID' });

    const { description, amount, dueDate, paidDate } = req.body;

    let [invoice] = await db.select().from(invoices).where(eq(invoices.enrollmentId, enrollmentId));

    // If no invoice exists, create one linked to the parent's billing account
    if (!invoice) {
      const [enrollment] = await db.select().from(enrollments).where(eq(enrollments.id, enrollmentId));
      if (!enrollment) return res.status(404).json({ success: false, error: 'Enrollment not found' });

      // Find parent via guardian link on the student
      const [guardianLink] = await db.select().from(guardianStudents)
        .where(eq(guardianStudents.studentId, enrollment.studentId));
      const parentUserId = guardianLink?.guardianUserId || null;

      let billingAccountId = null;
      if (parentUserId) {
        let [billingAccount] = await db.select().from(billingAccounts)
          .where(eq(billingAccounts.parentUserId, parentUserId));
        if (!billingAccount) {
          [billingAccount] = await db.insert(billingAccounts).values({ parentUserId }).returning();
        }
        billingAccountId = billingAccount.id;
      }

      if (!billingAccountId) {
        return res.status(400).json({ success: false, error: 'Cannot create invoice: no parent billing account found for this student' });
      }

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);
      [invoice] = await db.insert(invoices).values({
        billingAccountId,
        enrollmentId,
        description: description || 'Tuition',
        amount: amount ? String(amount) : '0',
        dueDate: dueDate.toISOString().split('T')[0],
      }).returning();
    }

    const updateData = {};
    if (description !== undefined) updateData.description = description;
    if (amount !== undefined) updateData.amount = String(amount);
    if (dueDate !== undefined) updateData.dueDate = dueDate || null;
    if (paidDate !== undefined) updateData.paidDate = paidDate || null;

    if (Object.keys(updateData).length === 0) {
      return res.status(200).json({ success: true, invoice });
    }

    const [updated] = await db.update(invoices).set(updateData).where(eq(invoices.id, invoice.id)).returning();

    await logAudit({
      userId: req.user.id,
      action: 'update',
      entityType: 'invoice',
      entityId: invoice.id,
      details: { enrollmentId, ...updateData },
      ipAddress: req.ip,
    });

    res.json({ success: true, invoice: updated });
  } catch (err) {
    console.error('Update invoice error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Override routes ───────────────────────────────────────────────────────────

// GET /api/enrollments/:id/overrides — list all overrides for an enrollment
router.get('/:id/overrides', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const enrollmentId = parseInt(req.params.id);
    if (isNaN(enrollmentId)) return res.status(400).json({ success: false, error: 'Invalid enrollment ID' });

    const rows = await db.select({
      id: enrollmentOverrides.id,
      enrollmentId: enrollmentOverrides.enrollmentId,
      overrideType: enrollmentOverrides.overrideType,
      reason: enrollmentOverrides.reason,
      amountWaivedCents: enrollmentOverrides.amountWaivedCents,
      amountDeferredCents: enrollmentOverrides.amountDeferredCents,
      amountDueNowCents: enrollmentOverrides.amountDueNowCents,
      effectiveStartAt: enrollmentOverrides.effectiveStartAt,
      effectiveEndAt: enrollmentOverrides.effectiveEndAt,
      isActive: enrollmentOverrides.isActive,
      approvedByUserId: enrollmentOverrides.approvedByUserId,
      approvedByName: enrollmentOverrides.approvedByName,
      approvedAt: enrollmentOverrides.approvedAt,
      revokedAt: enrollmentOverrides.revokedAt,
      revokeReason: enrollmentOverrides.revokeReason,
      notes: enrollmentOverrides.notes,
      createdAt: enrollmentOverrides.createdAt,
      approverFirstName: users.firstName,
      approverLastName: users.lastName,
    }).from(enrollmentOverrides)
      .leftJoin(users, eq(enrollmentOverrides.approvedByUserId, users.id))
      .where(eq(enrollmentOverrides.enrollmentId, enrollmentId))
      .orderBy(desc(enrollmentOverrides.createdAt));

    const overrides = rows.map(o => ({
      ...o,
      approvedByName: o.approvedByName ||
        (o.approverFirstName ? `${o.approverFirstName} ${o.approverLastName || ''}`.trim() : 'Admin'),
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
    await db.update(enrollmentOverrides)
      .set({ isActive: false, revokedAt: new Date(), revokeReason: 'Superseded by new override' })
      .where(and(
        eq(enrollmentOverrides.enrollmentId, enrollmentId),
        eq(enrollmentOverrides.isActive, true)
      ));

    // Insert the new override record
    const [newOverride] = await db.insert(enrollmentOverrides).values({
      enrollmentId,
      overrideType,
      reason: reason.trim(),
      amountWaivedCents: Number(amountWaivedCents),
      amountDeferredCents: Number(amountDeferredCents),
      amountDueNowCents: Number(amountDueNowCents),
      effectiveStartAt: effectiveStartAt || null,
      effectiveEndAt: effectiveEndAt || null,
      isActive: true,
      approvedByUserId: req.user.id,
      approvedByName: adminName,
      approvedAt: new Date(),
      notes: notes || null,
    }).returning();

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
      await db.update(invoices)
        .set({ status: 'waived' })
        .where(and(
          eq(invoices.enrollmentId, enrollmentId),
          ne(invoices.status, 'paid')
        ));
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

    // Fetch override to get enrollmentId
    const [override] = await db.select().from(enrollmentOverrides)
      .where(eq(enrollmentOverrides.id, overrideId));
    if (!override) return res.status(404).json({ success: false, error: 'Override not found' });
    if (!override.isActive) return res.status(400).json({ success: false, error: 'Override is already revoked' });

    // Deactivate the override
    await db.update(enrollmentOverrides)
      .set({ isActive: false, revokedAt: new Date(), revokeReason: revokeReason.trim() })
      .where(eq(enrollmentOverrides.id, overrideId));

    // Revert enrollment to pending_payment
    await db.update(enrollments)
      .set({ status: 'pending_payment' })
      .where(eq(enrollments.id, override.enrollmentId));

    // Re-open waived invoices if any
    await db.update(invoices)
      .set({ status: 'pending' })
      .where(and(
        eq(invoices.enrollmentId, override.enrollmentId),
        eq(invoices.status, 'waived')
      ));

    await logAudit({
      userId: req.user.id,
      action: 'override_revoke',
      entityType: 'enrollment',
      entityId: override.enrollmentId,
      details: { overrideId, revokeReason },
      ipAddress: req.ip,
    });

    // Notify the parent that payment is now required
    try {
      const [enrollment] = await db.select({ studentId: enrollments.studentId })
        .from(enrollments).where(eq(enrollments.id, override.enrollmentId));
      if (enrollment) {
        const [guardianLink] = await db.select({ guardianUserId: guardianStudents.guardianUserId })
          .from(guardianStudents).where(eq(guardianStudents.studentId, enrollment.studentId));
        if (guardianLink) {
          await createNotification({
            userId: guardianLink.guardianUserId,
            type: 'payment_required',
            title: 'Payment now required',
            body: revokeReason
              ? `Your enrollment override has been revoked: ${revokeReason}. Payment is now required to keep your enrollment active.`
              : 'Your enrollment override has been revoked. Payment is now required to keep your enrollment active.',
            link: '/parent/payments',
          });
        }
      }
    } catch (notifyErr) {
      console.warn('[revoke-override] notification failed (non-fatal):', notifyErr.message);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Revoke override error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
