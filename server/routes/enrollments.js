import { Router } from 'express';
import { eq, desc, and } from 'drizzle-orm';
import db from '../db-postgres.js';
import { enrollments, programs, students, users, billingAccounts, invoices, schoolYears, sections, guardianStudents } from '../schema.js';
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
        studentFirstName: students.firstName,
        studentLastName: students.lastName,
      }).from(enrollments)
        .leftJoin(programs, eq(enrollments.programId, programs.id))
        .leftJoin(students, eq(enrollments.studentId, students.id))
        .where(eq(enrollments.studentId, sid));
      myEnrollments.push(...enrs);
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

export default router;
