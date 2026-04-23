import { Router } from 'express';
import { eq, desc, and, inArray } from 'drizzle-orm';
import db, { rawSql } from '../db-postgres.js';
import { assignments, assignmentSubmissions, sectionStudents, sections, students } from '../schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { getCoachSectionIds, isStudentInSection } from '../middleware/scope.js';
import { logAudit } from '../services/audit.service.js';
import { createNotification } from '../services/notification.service.js';

const router = Router();

router.get('/my-sections', requireAuth, async (req, res) => {
  try {
    const sectionIds = await getCoachSectionIds(req.user.id);
    if (sectionIds.length === 0) return res.json({ success: true, sections: [] });
    const result = await db.select().from(sections).where(inArray(sections.id, sectionIds));
    res.json({ success: true, sections: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/section/:sectionId', requireAuth, async (req, res) => {
  try {
    const sectionId = parseInt(req.params.sectionId);
    if (req.user.role !== 'admin') {
      const sectionIds = await getCoachSectionIds(req.user.id);
      if (!sectionIds.includes(sectionId)) {
        return res.status(403).json({ success: false, error: 'Not assigned to this section' });
      }
    }
    const result = await db.select().from(assignments)
      .where(eq(assignments.sectionId, sectionId))
      .orderBy(desc(assignments.createdAt));
    res.json({ success: true, assignments: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/section/:sectionId/roster', requireAuth, async (req, res) => {
  try {
    const sectionId = parseInt(req.params.sectionId);
    if (req.user.role !== 'admin') {
      const sectionIds = await getCoachSectionIds(req.user.id);
      if (!sectionIds.includes(sectionId)) {
        return res.status(403).json({ success: false, error: 'Not assigned to this section' });
      }
    }
    const roster = await db.select({
      id: sectionStudents.id,
      studentId: sectionStudents.studentId,
      firstName: students.firstName,
      lastName: students.lastName,
      grade: students.grade,
    }).from(sectionStudents)
      .innerJoin(students, eq(sectionStudents.studentId, students.id))
      .where(eq(sectionStudents.sectionId, sectionId));
    res.json({ success: true, students: roster });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { sectionId, title, description, maxScore, dueDate, category } = req.body;
    if (!sectionId || !title) {
      return res.status(400).json({ success: false, error: 'Section and title are required' });
    }

    if (req.user.role !== 'admin') {
      const sectionIds = await getCoachSectionIds(req.user.id);
      if (!sectionIds.includes(parseInt(sectionId))) {
        return res.status(403).json({ success: false, error: 'Not assigned to this section' });
      }
    }

    const [assignment] = await db.insert(assignments).values({
      sectionId: parseInt(sectionId),
      title: title.trim(),
      description: description || null,
      maxScore: maxScore ? parseInt(maxScore) : 100,
      dueDate: dueDate || null,
      category: category || 'general',
      createdBy: req.user.id,
    }).returning();

    await logAudit({
      userId: req.user.id,
      action: 'create',
      entityType: 'assignment',
      entityId: assignment.id,
      details: { sectionId, title },
      ipAddress: req.ip,
    });

    res.json({ success: true, assignment });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [existing] = await db.select().from(assignments).where(eq(assignments.id, id));
    if (!existing) return res.status(404).json({ success: false, error: 'Assignment not found' });

    if (req.user.role !== 'admin') {
      const sectionIds = await getCoachSectionIds(req.user.id);
      if (!sectionIds.includes(existing.sectionId)) {
        return res.status(403).json({ success: false, error: 'Not assigned to this section' });
      }
    }

    const { title, description, maxScore, dueDate, category, status } = req.body;
    const updateData = {};
    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description;
    if (maxScore !== undefined) updateData.maxScore = parseInt(maxScore);
    if (dueDate !== undefined) updateData.dueDate = dueDate;
    if (category !== undefined) updateData.category = category;
    if (status !== undefined) updateData.status = status;

    const [updated] = await db.update(assignments).set(updateData).where(eq(assignments.id, id)).returning();

    await logAudit({
      userId: req.user.id,
      action: 'update',
      entityType: 'assignment',
      entityId: id,
      details: updateData,
      ipAddress: req.ip,
    });

    res.json({ success: true, assignment: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [existing] = await db.select().from(assignments).where(eq(assignments.id, id));
    if (!existing) return res.status(404).json({ success: false, error: 'Assignment not found' });

    if (req.user.role !== 'admin') {
      const sectionIds = await getCoachSectionIds(req.user.id);
      if (!sectionIds.includes(existing.sectionId)) {
        return res.status(403).json({ success: false, error: 'Not assigned to this section' });
      }
    }

    await db.delete(assignmentSubmissions).where(eq(assignmentSubmissions.assignmentId, id));
    await db.delete(assignments).where(eq(assignments.id, id));

    await logAudit({
      userId: req.user.id,
      action: 'delete',
      entityType: 'assignment',
      entityId: id,
      ipAddress: req.ip,
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Student submit work for an assignment
router.post('/:id/submit', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ success: false, error: 'Only students can submit work' });
    }
    const assignmentId = parseInt(req.params.id);
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ success: false, error: 'Submission content is required' });

    const [assignment] = await db.select().from(assignments).where(eq(assignments.id, assignmentId));
    if (!assignment) return res.status(404).json({ success: false, error: 'Assignment not found' });

    const [studentRec] = await db.select().from(students).where(eq(students.userId, req.user.id));
    if (!studentRec) return res.status(400).json({ success: false, error: 'Student record not found' });

    const [existing] = await db.select().from(assignmentSubmissions)
      .where(and(eq(assignmentSubmissions.assignmentId, assignmentId), eq(assignmentSubmissions.studentId, studentRec.id)));

    let submission;
    if (existing) {
      [submission] = await db.update(assignmentSubmissions)
        .set({ submissionContent: content.trim(), submittedAt: new Date() })
        .where(eq(assignmentSubmissions.id, existing.id))
        .returning();
    } else {
      [submission] = await db.insert(assignmentSubmissions).values({
        assignmentId,
        studentId: studentRec.id,
        submissionContent: content.trim(),
        submittedAt: new Date(),
      }).returning();
    }

    await logAudit({
      userId: req.user.id,
      action: 'submit',
      entityType: 'assignment_submission',
      entityId: submission.id,
      details: { assignmentId },
      ipAddress: req.ip,
    });

    res.json({ success: true, submission });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Student get their own submissions
router.get('/my-submissions', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ success: false, error: 'Students only' });
    }
    const [studentRec] = await db.select().from(students).where(eq(students.userId, req.user.id));
    if (!studentRec) return res.json({ success: true, submissions: [] });

    const subs = await db.select({
      id: assignmentSubmissions.id,
      assignmentId: assignmentSubmissions.assignmentId,
      studentId: assignmentSubmissions.studentId,
      score: assignmentSubmissions.score,
      isMissing: assignmentSubmissions.isMissing,
      isLate: assignmentSubmissions.isLate,
      feedback: assignmentSubmissions.feedback,
      submissionContent: assignmentSubmissions.submissionContent,
      submittedAt: assignmentSubmissions.submittedAt,
      createdAt: assignmentSubmissions.createdAt,
      assignment_title: assignments.title,
      assignment_description: assignments.description,
      max_score: assignments.maxScore,
      due_date: assignments.dueDate,
    }).from(assignmentSubmissions)
      .innerJoin(assignments, eq(assignmentSubmissions.assignmentId, assignments.id))
      .where(eq(assignmentSubmissions.studentId, studentRec.id));
    res.json({ success: true, submissions: subs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id/submissions', requireAuth, async (req, res) => {
  try {
    const assignmentId = parseInt(req.params.id);
    const [assignment] = await db.select().from(assignments).where(eq(assignments.id, assignmentId));
    if (!assignment) return res.status(404).json({ success: false, error: 'Assignment not found' });

    if (req.user.role !== 'admin') {
      const sectionIds = await getCoachSectionIds(req.user.id);
      if (!sectionIds.includes(assignment.sectionId)) {
        return res.status(403).json({ success: false, error: 'Not assigned to this section' });
      }
    }

    const subs = await db.select({
      id: assignmentSubmissions.id,
      assignmentId: assignmentSubmissions.assignmentId,
      studentId: assignmentSubmissions.studentId,
      score: assignmentSubmissions.score,
      isMissing: assignmentSubmissions.isMissing,
      isLate: assignmentSubmissions.isLate,
      feedback: assignmentSubmissions.feedback,
      gradedBy: assignmentSubmissions.gradedBy,
      gradedAt: assignmentSubmissions.gradedAt,
      studentFirstName: students.firstName,
      studentLastName: students.lastName,
    }).from(assignmentSubmissions)
      .leftJoin(students, eq(assignmentSubmissions.studentId, students.id))
      .where(eq(assignmentSubmissions.assignmentId, assignmentId));

    res.json({ success: true, submissions: subs, assignment });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin grade override for a specific submission by ID
router.patch('/submissions/:id/grade', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const submissionId = parseInt(req.params.id);
    const { score, feedback } = req.body;
    const updateData = {
      gradedBy: req.user.id,
      gradedAt: new Date(),
    };
    if (score != null) updateData.score = Number(score);
    if (feedback !== undefined) updateData.feedback = feedback;

    const [updated] = await db.update(assignmentSubmissions)
      .set(updateData)
      .where(eq(assignmentSubmissions.id, submissionId))
      .returning();
    if (!updated) return res.status(404).json({ success: false, error: 'Submission not found' });

    await logAudit({
      userId: req.user.id,
      action: 'update',
      entityType: 'assignment_submission',
      entityId: submissionId,
      details: { score, feedback, note: 'admin_override' },
      ipAddress: req.ip,
    });

    res.json({ success: true, submission: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/grade', requireAuth, async (req, res) => {
  try {
    const assignmentId = parseInt(req.params.id);
    const { studentId, score, isMissing, isLate, feedback } = req.body;
    if (!studentId) return res.status(400).json({ success: false, error: 'Student ID is required' });

    const [assignment] = await db.select().from(assignments).where(eq(assignments.id, assignmentId));
    if (!assignment) return res.status(404).json({ success: false, error: 'Assignment not found' });

    if (req.user.role !== 'admin') {
      const sectionIds = await getCoachSectionIds(req.user.id);
      if (!sectionIds.includes(assignment.sectionId)) {
        return res.status(403).json({ success: false, error: 'Not assigned to this section' });
      }
    }

    if (!await isStudentInSection(parseInt(studentId), assignment.sectionId)) {
      return res.status(400).json({ success: false, error: 'Student is not in this section roster' });
    }

    const [existing] = await db.select().from(assignmentSubmissions)
      .where(and(
        eq(assignmentSubmissions.assignmentId, assignmentId),
        eq(assignmentSubmissions.studentId, parseInt(studentId))
      ));

    let submission;
    if (existing) {
      const updateData = { gradedBy: req.user.id, gradedAt: new Date() };
      if (score !== undefined) updateData.score = score !== null ? parseInt(score) : null;
      if (isMissing !== undefined) updateData.isMissing = isMissing;
      if (isLate !== undefined) updateData.isLate = isLate;
      if (feedback !== undefined) updateData.feedback = feedback;
      [submission] = await db.update(assignmentSubmissions).set(updateData)
        .where(eq(assignmentSubmissions.id, existing.id)).returning();

      await logAudit({
        userId: req.user.id,
        action: 'update',
        entityType: 'assignment_submission',
        entityId: existing.id,
        details: { assignmentId, studentId, score },
        ipAddress: req.ip,
      });
    } else {
      [submission] = await db.insert(assignmentSubmissions).values({
        assignmentId,
        studentId: parseInt(studentId),
        score: score !== undefined && score !== null ? parseInt(score) : null,
        isMissing: isMissing || false,
        isLate: isLate || false,
        feedback: feedback || null,
        gradedBy: req.user.id,
        gradedAt: new Date(),
      }).returning();

      await logAudit({
        userId: req.user.id,
        action: 'create',
        entityType: 'assignment_submission',
        entityId: submission.id,
        details: { assignmentId, studentId, score },
        ipAddress: req.ip,
      });
    }

    try {
      const [student] = await db.select().from(students).where(eq(students.id, parseInt(studentId)));
      if (student && student.userId) {
        await createNotification({
          userId: student.userId,
          type: 'assignment_graded',
          title: 'Assignment Graded',
          body: `Your assignment "${assignment.title}" has been graded${score !== undefined && score !== null ? ` — Score: ${score}` : ''}.`,
        });
      }
    } catch (notifErr) { console.error('Notification error:', notifErr); }

    res.json({ success: true, submission });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
