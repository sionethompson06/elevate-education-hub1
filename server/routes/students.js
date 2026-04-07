import { Router } from 'express';
import { eq, desc, and } from 'drizzle-orm';
import db from '../db-postgres.js';
import { students, guardianStudents, emergencyContacts, users, studentMedicalInfo } from '../schema.js';
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

// ── Parent-facing student management routes ───────────────────────────────────

// Helper: verify that the requesting parent is linked to the student
async function assertParentOwnsStudent(parentUserId, studentId) {
  const [link] = await db.select().from(guardianStudents)
    .where(and(
      eq(guardianStudents.guardianUserId, parentUserId),
      eq(guardianStudents.studentId, studentId)
    ));
  return !!link;
}

// PATCH /api/students/:id/my-student — parent can edit basic info of their own student
router.patch('/:id/my-student', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid student ID' });

    // Admin can edit anyone; parents check ownership
    if (req.user.role !== 'admin') {
      const owns = await assertParentOwnsStudent(req.user.id, id);
      if (!owns) return res.status(403).json({ success: false, error: 'Not authorized to edit this student' });
    }

    const { firstName, lastName, dateOfBirth, grade } = req.body;
    const updateData = {};
    if (firstName !== undefined) updateData.firstName = firstName.trim();
    if (lastName !== undefined) updateData.lastName = lastName.trim();
    if (dateOfBirth !== undefined) updateData.dateOfBirth = dateOfBirth || null;
    if (grade !== undefined) updateData.grade = grade || null;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    const [updated] = await db.update(students).set(updateData).where(eq(students.id, id)).returning();
    if (!updated) return res.status(404).json({ success: false, error: 'Student not found' });

    await logAudit({ userId: req.user.id, action: 'update', entityType: 'student', entityId: id, details: updateData, ipAddress: req.ip });
    res.json({ success: true, student: updated });
  } catch (err) {
    console.error('Update my-student error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/students/:id/emergency-contacts — parent can list (admin also fine)
router.get('/:id/emergency-contacts', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (req.user.role !== 'admin') {
      const owns = await assertParentOwnsStudent(req.user.id, id);
      if (!owns) return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    const contacts = await db.select().from(emergencyContacts)
      .where(eq(emergencyContacts.studentId, id))
      .orderBy(emergencyContacts.priorityOrder);
    res.json({ success: true, emergencyContacts: contacts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/students/:id/emergency-contacts/:contactId — parent can update a contact
router.patch('/:id/emergency-contacts/:contactId', requireAuth, async (req, res) => {
  try {
    const studentId = parseInt(req.params.id);
    const contactId = parseInt(req.params.contactId);
    if (req.user.role !== 'admin') {
      const owns = await assertParentOwnsStudent(req.user.id, studentId);
      if (!owns) return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    const { name, relationship, phone, isAuthorizedPickup, priorityOrder } = req.body;
    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (relationship !== undefined) updateData.relationship = relationship;
    if (phone !== undefined) updateData.phone = phone.trim();
    if (isAuthorizedPickup !== undefined) updateData.isAuthorizedPickup = isAuthorizedPickup;
    if (priorityOrder !== undefined) updateData.priorityOrder = parseInt(priorityOrder);

    if (Object.keys(updateData).length === 0) return res.status(400).json({ success: false, error: 'No fields to update' });
    const [updated] = await db.update(emergencyContacts).set(updateData)
      .where(and(eq(emergencyContacts.id, contactId), eq(emergencyContacts.studentId, studentId)))
      .returning();
    if (!updated) return res.status(404).json({ success: false, error: 'Contact not found' });
    res.json({ success: true, emergencyContact: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/students/:id/emergency-contacts/:contactId — parent can remove a contact
router.delete('/:id/emergency-contacts/:contactId', requireAuth, async (req, res) => {
  try {
    const studentId = parseInt(req.params.id);
    const contactId = parseInt(req.params.contactId);
    if (req.user.role !== 'admin') {
      const owns = await assertParentOwnsStudent(req.user.id, studentId);
      if (!owns) return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    await db.delete(emergencyContacts)
      .where(and(eq(emergencyContacts.id, contactId), eq(emergencyContacts.studentId, studentId)));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/students/:id/guardians — parent can view all guardians linked to a student
router.get('/:id/guardians', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (req.user.role !== 'admin') {
      const owns = await assertParentOwnsStudent(req.user.id, id);
      if (!owns) return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    const guardians = await db.select({
      id: guardianStudents.id,
      guardianUserId: guardianStudents.guardianUserId,
      relationship: guardianStudents.relationship,
      isPrimary: guardianStudents.isPrimary,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
    }).from(guardianStudents)
      .innerJoin(users, eq(guardianStudents.guardianUserId, users.id))
      .where(eq(guardianStudents.studentId, id));
    res.json({ success: true, guardians });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/students/:id/medical-info — parent can view medical info
router.get('/:id/medical-info', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (req.user.role !== 'admin') {
      const owns = await assertParentOwnsStudent(req.user.id, id);
      if (!owns) return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    const [info] = await db.select().from(studentMedicalInfo).where(eq(studentMedicalInfo.studentId, id));
    res.json({ success: true, medicalInfo: info || null });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/students/:id/medical-info — parent can create or update medical info (upsert)
router.put('/:id/medical-info', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (req.user.role !== 'admin') {
      const owns = await assertParentOwnsStudent(req.user.id, id);
      if (!owns) return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    const { allergies, medications, medicalConditions, doctorName, doctorPhone, insuranceCarrier, insurancePolicyNumber, notes } = req.body;

    const values = {
      studentId: id,
      allergies: allergies || null,
      medications: medications || null,
      medicalConditions: medicalConditions || null,
      doctorName: doctorName || null,
      doctorPhone: doctorPhone || null,
      insuranceCarrier: insuranceCarrier || null,
      insurancePolicyNumber: insurancePolicyNumber || null,
      notes: notes || null,
      updatedAt: new Date(),
    };

    const [existing] = await db.select().from(studentMedicalInfo).where(eq(studentMedicalInfo.studentId, id));
    let result;
    if (existing) {
      [result] = await db.update(studentMedicalInfo).set(values).where(eq(studentMedicalInfo.studentId, id)).returning();
    } else {
      [result] = await db.insert(studentMedicalInfo).values(values).returning();
    }

    await logAudit({ userId: req.user.id, action: 'upsert', entityType: 'student_medical_info', entityId: id, ipAddress: req.ip });
    res.json({ success: true, medicalInfo: result });
  } catch (err) {
    console.error('Medical info upsert error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /:id/emergency-contacts — admin or parent owner can add a contact
router.post('/:id/emergency-contacts', requireAuth, async (req, res) => {
  try {
    const studentId = parseInt(req.params.id);
    if (req.user.role !== 'admin') {
      const owns = await assertParentOwnsStudent(req.user.id, studentId);
      if (!owns) return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    const { name, relationship, phone, isAuthorizedPickup, priorityOrder } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ success: false, error: 'Name and phone are required' });
    }
    const [contact] = await db.insert(emergencyContacts).values({
      studentId,
      name: name.trim(),
      relationship: relationship || 'other',
      phone: phone.trim(),
      isAuthorizedPickup: isAuthorizedPickup || false,
      priorityOrder: priorityOrder ? parseInt(priorityOrder) : 1,
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
