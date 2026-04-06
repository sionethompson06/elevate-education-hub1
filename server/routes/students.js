import { Router } from 'express';
import { eq, desc } from 'drizzle-orm';
import db from '../db-postgres.js';
import { students, guardianStudents, emergencyContacts, users } from '../schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { logAudit } from '../services/audit.service.js';

const router = Router();

router.get('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const allStudents = await db.select().from(students).orderBy(desc(students.createdAt));
    res.json({ success: true, students: allStudents });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/by-user/:userId', requireAuth, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    if (req.user.role !== 'admin' && req.user.id !== userId) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    const [student] = await db.select().from(students).where(eq(students.userId, userId));
    res.json({ success: true, student: student || null });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [student] = await db.select().from(students).where(eq(students.id, id));
    if (!student) return res.status(404).json({ success: false, error: 'Student not found' });

    const guardians = await db
      .select({
        id: guardianStudents.id,
        guardianUserId: guardianStudents.guardianUserId,
        relationship: guardianStudents.relationship,
        isPrimary: guardianStudents.isPrimary,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(guardianStudents)
      .innerJoin(users, eq(guardianStudents.guardianUserId, users.id))
      .where(eq(guardianStudents.studentId, id));

    const contacts = await db.select().from(emergencyContacts).where(eq(emergencyContacts.studentId, id));

    res.json({ success: true, student, guardians, emergencyContacts: contacts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Parent self-service: add their own child
router.post('/add-my-student', requireAuth, async (req, res) => {
  try {
    const { firstName, lastName, dateOfBirth, grade, sport, programInterest, notes } = req.body;
    if (!firstName || !lastName) {
      return res.status(400).json({ success: false, error: 'First and last name are required' });
    }
    const [student] = await db.insert(students).values({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      dateOfBirth: dateOfBirth || null,
      grade: grade || null,
      status: 'intake',
    }).returning();

    await db.insert(guardianStudents).values({
      guardianUserId: req.user.id,
      studentId: student.id,
      relationship: 'parent',
      isPrimary: true,
    });

    await logAudit({ userId: req.user.id, action: 'add_student', entityType: 'student', entityId: student.id, ipAddress: req.ip });
    res.json({ success: true, student });
  } catch (err) {
    console.error('Add student error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { firstName, lastName, dateOfBirth, grade, guardianUserId, relationship, emergencyContact } = req.body;
    if (!firstName || !lastName) {
      return res.status(400).json({ success: false, error: 'First and last name are required' });
    }

    const [student] = await db.insert(students).values({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      dateOfBirth: dateOfBirth || null,
      grade: grade || null,
    }).returning();

    if (guardianUserId) {
      await db.insert(guardianStudents).values({
        guardianUserId: parseInt(guardianUserId),
        studentId: student.id,
        relationship: relationship || 'parent',
        isPrimary: true,
      });
    }

    if (emergencyContact && emergencyContact.name && emergencyContact.phone) {
      await db.insert(emergencyContacts).values({
        studentId: student.id,
        name: emergencyContact.name,
        relationship: emergencyContact.relationship || 'parent',
        phone: emergencyContact.phone,
        isAuthorizedPickup: emergencyContact.isAuthorizedPickup || false,
      });
    }

    await logAudit({
      userId: req.user.id,
      action: 'create',
      entityType: 'student',
      entityId: student.id,
      details: { firstName, lastName, grade },
      ipAddress: req.ip,
    });

    res.json({ success: true, student });
  } catch (err) {
    console.error('Create student error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.patch('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { firstName, lastName, dateOfBirth, grade, status } = req.body;
    const updateData = {};
    if (firstName !== undefined) updateData.firstName = firstName.trim();
    if (lastName !== undefined) updateData.lastName = lastName.trim();
    if (dateOfBirth !== undefined) updateData.dateOfBirth = dateOfBirth;
    if (grade !== undefined) updateData.grade = grade;
    if (status !== undefined) updateData.status = status;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    const [updated] = await db.update(students).set(updateData).where(eq(students.id, id)).returning();
    if (!updated) return res.status(404).json({ success: false, error: 'Student not found' });

    await logAudit({
      userId: req.user.id,
      action: 'update',
      entityType: 'student',
      entityId: id,
      details: updateData,
      ipAddress: req.ip,
    });

    res.json({ success: true, student: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/guardians', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const studentId = parseInt(req.params.id);
    const { guardianUserId, relationship, isPrimary } = req.body;
    const [link] = await db.insert(guardianStudents).values({
      guardianUserId: parseInt(guardianUserId),
      studentId,
      relationship: relationship || 'parent',
      isPrimary: isPrimary !== undefined ? isPrimary : false,
    }).returning();

    await logAudit({
      userId: req.user.id,
      action: 'create',
      entityType: 'guardian_student',
      entityId: link.id,
      details: { guardianUserId, studentId, relationship },
      ipAddress: req.ip,
    });

    res.json({ success: true, guardianStudent: link });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/emergency-contacts', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const studentId = parseInt(req.params.id);
    const { name, relationship, phone, isAuthorizedPickup } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ success: false, error: 'Name and phone are required' });
    }
    const [contact] = await db.insert(emergencyContacts).values({
      studentId,
      name,
      relationship: relationship || 'other',
      phone,
      isAuthorizedPickup: isAuthorizedPickup || false,
    }).returning();

    await logAudit({
      userId: req.user.id,
      action: 'create',
      entityType: 'emergency_contact',
      entityId: contact.id,
      details: { studentId, name, phone },
      ipAddress: req.ip,
    });

    res.json({ success: true, emergencyContact: contact });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
