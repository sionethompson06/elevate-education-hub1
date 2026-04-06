import { Router } from 'express';
import { eq, desc, and } from 'drizzle-orm';

import db from '../db-postgres.js';
import { applications, users, students, guardianStudents } from '../schema.js';
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

    // Sequential queries — neon-http driver does not support transactions
    await db.update(applications).set({ status: 'accepted' }).where(eq(applications.id, id));

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

    await logAudit({
      userId: req.user.id,
      action: 'update',
      entityType: 'application',
      entityId: id,
      details: { status: 'accepted', parentUserId: parentUser.id, studentId: studentRecord.id },
      ipAddress: req.ip,
    });

    await createNotification({
      userId: parentUser.id,
      type: 'application_accepted',
      title: 'Application accepted',
      body: `${studentRecord.firstName}'s application has been accepted! You can now log in and enroll.`,
      link: '/hub/parent',
    });

    const [acceptedApp] = await db.select().from(applications).where(eq(applications.id, id));
    res.json({
      success: true,
      application: formatApp(acceptedApp),
      parentUser: { id: parentUser.id, email: parentUser.email },
      student: { id: studentRecord.id, firstName: studentRecord.firstName, lastName: studentRecord.lastName },
    });
  } catch (err) {
    console.error('Approve application error:', err);
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
