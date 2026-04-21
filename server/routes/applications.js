import { Router } from 'express';
import { eq, desc, and } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { sendInviteEmail } from '../services/email.service.js';

import db from '../db-postgres.js';
import { applications, users, students, guardianStudents, enrollments, programs, billingAccounts, invoices, schoolYears } from '../schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { logAudit } from '../services/audit.service.js';
import { createNotification } from '../services/notification.service.js';

const router = Router();

router.post('/', async (req, res) => {
  try {
    const {
      parent_first_name, parent_last_name, email, phone,
      student_first_name, student_last_name, student_age, student_birth_date,
      student_grade, program_interest, sports_played, competition_level,
      essay, referral_source
    } = req.body;

    const [app] = await db.insert(applications).values({
      parentFirstName: parent_first_name || '',
      parentLastName: parent_last_name || '',
      email: email || '',
      phone: phone || '',
      studentFirstName: student_first_name || '',
      studentLastName: student_last_name || '',
      studentAge: student_age || '',
      studentBirthDate: student_birth_date || '',
      studentGrade: student_grade || '',
      programInterest: program_interest || '',
      sportsPlayed: sports_played || '',
      competitionLevel: competition_level || '',
      essay: essay || '',
      referralSource: referral_source || '',
    }).returning();

    await logAudit({
      userId: null,
      action: 'create',
      entityType: 'application',
      entityId: app.id,
      details: { email: email || '', studentName: `${student_first_name || ''} ${student_last_name || ''}` },
      ipAddress: req.ip,
    });

    const formatted = formatApp(app);
    res.json({ success: true, application: formatted });
  } catch (err) {
    console.error('Create application error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const apps = await db.select().from(applications).orderBy(desc(applications.createdAt));
    res.json({ success: true, applications: apps.map(formatApp) });
  } catch (err) {
    console.error('List applications error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.patch('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updateData = {};
    const fieldMap = {
      status: 'status',
      reviewer_notes: 'reviewerNotes',
      reviewerNotes: 'reviewerNotes',
      decision_notes: 'reviewerNotes',
      parent_first_name: 'parentFirstName',
      parent_last_name: 'parentLastName',
      email: 'email',
      phone: 'phone',
    };
    for (const [key, col] of Object.entries(fieldMap)) {
      if (req.body[key] !== undefined) updateData[col] = req.body[key];
    }
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ success: false, error: 'No valid fields to update' });
    }
    const [updated] = await db.update(applications).set(updateData).where(eq(applications.id, id)).returning();
    if (!updated) return res.status(404).json({ success: false, error: 'Application not found' });

    await logAudit({
      userId: req.user.id,
      action: 'update',
      entityType: 'application',
      entityId: id,
      details: updateData,
      ipAddress: req.ip,
    });

    res.json({ success: true, application: formatApp(updated) });
  } catch (err) {
    console.error('Update application error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(applications).where(eq(applications.id, id));
    await logAudit({
      userId: req.user.id,
      action: 'delete',
      entityType: 'application',
      entityId: id,
      ipAddress: req.ip,
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete application error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/approve', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [app] = await db.select().from(applications).where(eq(applications.id, id));
    if (!app) return res.status(404).json({ success: false, error: 'Application not found' });

    const { decision_notes, reviewed_by, programId } = req.body;

    // Sequential queries — neon-http driver does not support transactions
    await db.update(applications)
      .set({ status: 'approved', reviewerNotes: decision_notes || null })
      .where(eq(applications.id, id));

    let parentUser;
    const [existingUser] = await db.select().from(users).where(eq(users.email, app.email.toLowerCase().trim()));
    if (existingUser) {
      parentUser = existingUser;
    } else {
      [parentUser] = await db.insert(users).values({
        email: app.email.toLowerCase().trim(),
        role: 'parent',
        firstName: app.parentFirstName,
        lastName: app.parentLastName,
        status: 'active',
      }).returning();
    }

    let studentRecord;
    const [matchingStudent] = await db.select().from(students)
      .where(and(
        eq(students.firstName, app.studentFirstName),
        eq(students.lastName, app.studentLastName)
      ));

    if (matchingStudent) {
      studentRecord = matchingStudent;
    } else {
      [studentRecord] = await db.insert(students).values({
        firstName: app.studentFirstName,
        lastName: app.studentLastName,
        grade: app.studentGrade || null,
        dateOfBirth: app.studentBirthDate || null,
        status: 'intake',
      }).returning();
    }

    const existingLink = await db.select().from(guardianStudents)
      .where(and(
        eq(guardianStudents.guardianUserId, parentUser.id),
        eq(guardianStudents.studentId, studentRecord.id)
      ));
    if (existingLink.length === 0) {
      await db.insert(guardianStudents).values({
        guardianUserId: parentUser.id,
        studentId: studentRecord.id,
        relationship: 'parent',
        isPrimary: true,
      });
    }

    // Auto-create pending enrollment if program can be matched
    let autoEnrolledProgramId = null;
    try {
      let [currentYear] = await db.select().from(schoolYears).where(eq(schoolYears.isCurrent, true));
      if (!currentYear) {
        const now = new Date();
        [currentYear] = await db.insert(schoolYears).values({
          name: `${now.getFullYear()}-${now.getFullYear() + 1}`,
          startDate: `${now.getFullYear()}-08-01`,
          endDate: `${now.getFullYear() + 1}-06-30`,
          isCurrent: true,
        }).returning();
      }

      const allPrograms = await db.select().from(programs).where(eq(programs.status, 'active'));
      // Use explicitly selected programId if provided, otherwise match program_interest to a program.
      // Matching runs in priority order across ALL programs to prevent similar names (e.g.
      // "Virtual School 1-Day" vs "Virtual School 2-Days") from incorrectly matching each other.
      const normalise = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
      const matchedProgram = programId
        ? allPrograms.find(p => p.id === parseInt(programId))
        : (app.programInterest
            ? (() => {
                const interest = normalise(app.programInterest);
                // Phase 1: exact / near-exact substring match across all programs
                const exact = allPrograms.find(p => {
                  const pName = normalise(p.name);
                  return pName === interest || pName.includes(interest) || interest.includes(pName);
                });
                if (exact) return exact;
                // Phase 2: program type match
                const byType = allPrograms.find(p => {
                  const pType = normalise(p.type || '');
                  return pType && (pType === interest || interest.includes(pType));
                });
                if (byType) return byType;
                // Phase 3: keyword fallback — only words ≥ 2 chars (keeps "1", "2" for disambiguation)
                const interestWords = interest.split(' ').filter(w => w.length >= 2);
                return allPrograms.find(p => {
                  const pName = normalise(p.name);
                  return interestWords.every(w => pName.includes(w));
                }) || allPrograms.find(p => {
                  const pName = normalise(p.name);
                  return interestWords.some(w => w.length > 4 && pName.includes(w));
                });
              })()
            : null);

      if (matchedProgram) {
        autoEnrolledProgramId = matchedProgram.id;
        const [existingEnrollment] = await db.select().from(enrollments).where(
          and(
            eq(enrollments.studentId, studentRecord.id),
            eq(enrollments.programId, matchedProgram.id),
            eq(enrollments.schoolYearId, currentYear.id)
          )
        );
        if (!existingEnrollment) {
          const [newEnrollment] = await db.insert(enrollments).values({
            studentId: studentRecord.id,
            programId: matchedProgram.id,
            schoolYearId: currentYear.id,
            status: 'pending_payment',
            enrolledBy: req.user.id,
          }).returning();

          let [billingAccount] = await db.select().from(billingAccounts)
            .where(eq(billingAccounts.parentUserId, parentUser.id));
          if (!billingAccount) {
            [billingAccount] = await db.insert(billingAccounts).values({
              parentUserId: parentUser.id,
            }).returning();
          }

          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + 30);
          await db.insert(invoices).values({
            billingAccountId: billingAccount.id,
            enrollmentId: newEnrollment.id,
            description: `Tuition - ${matchedProgram.name}`,
            amount: matchedProgram.tuitionAmount,
            dueDate: dueDate.toISOString().split('T')[0],
          });
        } else {
          // Enrollment already existed — still report it as enrolled
          autoEnrolledProgramId = matchedProgram.id;
        }
      }
    } catch (enrollErr) {
      console.warn('[approve] auto-enrollment failed (non-fatal):', enrollErr.message);
      autoEnrolledProgramId = null;
    }

    // Auto-invite parent — generate token and send email
    let inviteUrl = null;
    try {
      const inviteToken = randomBytes(32).toString('hex');
      const inviteTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await db.update(users).set({ inviteToken, inviteTokenExpiry }).where(eq(users.id, parentUser.id));
      const baseUrl = (process.env.APP_URL || '').replace(/\/+$/, '') || `${req.protocol}://${req.get('host')}`;
      inviteUrl = `${baseUrl}/register?token=${inviteToken}`;
      await sendInviteEmail(parentUser.email, parentUser.firstName, inviteToken);
    } catch (inviteErr) {
      console.warn('[approve] invite send failed (non-fatal):', inviteErr.message);
    }

    await logAudit({
      userId: req.user.id,
      action: 'update',
      entityType: 'application',
      entityId: id,
      details: { status: 'approved', parentUserId: parentUser.id, studentId: studentRecord.id, reviewed_by: reviewed_by || req.user.email },
      ipAddress: req.ip,
    });

    await createNotification({
      userId: parentUser.id,
      type: 'application_approved',
      title: 'Application approved',
      body: `${studentRecord.firstName}'s application has been approved! Check your email to set up your account.`,
      link: '/parent/dashboard',
    });

    const [approvedApp] = await db.select().from(applications).where(eq(applications.id, id));
    res.json({
      success: true,
      application: formatApp(approvedApp),
      parentUser: { id: parentUser.id, email: parentUser.email },
      student: { id: studentRecord.id, firstName: studentRecord.firstName, lastName: studentRecord.lastName },
      inviteUrl,
      enrolledProgramId: autoEnrolledProgramId,
    });
  } catch (err) {
    console.error('Approve application error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/deny', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [app] = await db.select().from(applications).where(eq(applications.id, id));
    if (!app) return res.status(404).json({ success: false, error: 'Application not found' });
    if (app.status === 'denied') return res.status(400).json({ success: false, error: 'Application already denied' });

    const { decision_notes } = req.body;

    await db.update(applications)
      .set({ status: 'denied', reviewerNotes: decision_notes || null })
      .where(eq(applications.id, id));

    await logAudit({
      userId: req.user.id,
      action: 'update',
      entityType: 'application',
      entityId: id,
      details: { status: 'denied', reviewed_by: req.user.email },
      ipAddress: req.ip,
    });

    // Notify parent user if their account exists
    const [parentUser] = await db.select().from(users).where(eq(users.email, app.email.toLowerCase().trim()));
    if (parentUser) {
      await createNotification({
        userId: parentUser.id,
        type: 'application_denied',
        title: 'Application update',
        body: `We regret to inform you that ${app.studentFirstName}'s application was not approved at this time. Please contact us if you have questions.`,
        link: null,
      });
    }

    const [updatedApp] = await db.select().from(applications).where(eq(applications.id, id));
    res.json({ success: true, application: formatApp(updatedApp) });
  } catch (err) {
    console.error('Deny application error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

function formatApp(app) {
  return {
    id: app.id,
    parent_first_name: app.parentFirstName,
    parent_last_name: app.parentLastName,
    email: app.email,
    phone: app.phone,
    student_first_name: app.studentFirstName,
    student_last_name: app.studentLastName,
    student_age: app.studentAge,
    student_birth_date: app.studentBirthDate,
    student_grade: app.studentGrade,
    program_interest: app.programInterest,
    sports_played: app.sportsPlayed,
    competition_level: app.competitionLevel,
    essay: app.essay,
    referral_source: app.referralSource,
    status: app.status,
    reviewer_notes: app.reviewerNotes,
    created_date: app.createdAt?.toISOString(),
  };
}

export default router;
