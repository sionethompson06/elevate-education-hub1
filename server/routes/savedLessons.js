import { Router } from 'express';
import { eq } from 'drizzle-orm';
import db from '../db-postgres.js';
import { savedLessonPlans } from '../schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
const canManage = requireRole('academic_coach', 'admin');

// GET /api/saved-lessons — list coach's saved lesson plans
// Query: ?subject=Math&grade=4&search=fractions
router.get('/', requireAuth, canManage, async (req, res) => {
  try {
    const { subject, grade, search } = req.query;

    let lessons = await db.select({
      id: savedLessonPlans.id,
      title: savedLessonPlans.title,
      subject: savedLessonPlans.subject,
      grade: savedLessonPlans.grade,
      standardCode: savedLessonPlans.standardCode,
      standardText: savedLessonPlans.standardText,
      createdAt: savedLessonPlans.createdAt,
      updatedAt: savedLessonPlans.updatedAt,
      // planData intentionally omitted from list to keep response small
    }).from(savedLessonPlans)
      .where(req.user.role === 'admin' ? undefined : eq(savedLessonPlans.coachUserId, req.user.id))
      .orderBy(savedLessonPlans.updatedAt);

    if (subject) lessons = lessons.filter(l => l.subject === subject);
    if (grade)   lessons = lessons.filter(l => l.grade === grade);
    if (search) {
      const q = search.toLowerCase();
      lessons = lessons.filter(l =>
        l.title.toLowerCase().includes(q) ||
        (l.standardCode || '').toLowerCase().includes(q) ||
        (l.standardText || '').toLowerCase().includes(q),
      );
    }

    return res.json({ lessons });
  } catch (err) {
    console.error('[saved-lessons] list error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/saved-lessons — save a new lesson plan to the library
router.post('/', requireAuth, canManage, async (req, res) => {
  try {
    const { title, subject, grade, standardCode, standardText, planData } = req.body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ success: false, error: 'title is required.' });
    }
    if (!planData || typeof planData !== 'string') {
      return res.status(400).json({ success: false, error: 'planData is required.' });
    }

    const [created] = await db.insert(savedLessonPlans).values({
      coachUserId: req.user.id,
      title: title.trim(),
      subject: subject || 'General',
      grade: grade || '',
      standardCode: standardCode || null,
      standardText: standardText || null,
      planData,
    }).returning();

    console.log(`[saved-lessons] coach=${req.user.id} saved lesson id=${created.id} "${created.title}"`);
    return res.status(201).json({ success: true, lesson: created });
  } catch (err) {
    console.error('[saved-lessons] create error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/saved-lessons/:id — fetch full plan data for loading into the builder
router.get('/:id', requireAuth, canManage, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [lesson] = await db.select().from(savedLessonPlans).where(eq(savedLessonPlans.id, id));
    if (!lesson) return res.status(404).json({ success: false, error: 'Lesson not found.' });
    if (req.user.role !== 'admin' && lesson.coachUserId !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Access denied.' });
    }
    return res.json({ lesson });
  } catch (err) {
    console.error('[saved-lessons] get error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/saved-lessons/:id — update saved plan (called when editing from the library)
router.patch('/:id', requireAuth, canManage, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [existing] = await db.select().from(savedLessonPlans).where(eq(savedLessonPlans.id, id));
    if (!existing) return res.status(404).json({ success: false, error: 'Lesson not found.' });
    if (req.user.role !== 'admin' && existing.coachUserId !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Access denied.' });
    }

    const { title, subject, grade, standardCode, standardText, planData } = req.body;
    const updates = { updatedAt: new Date() };
    if (title      !== undefined) updates.title       = title.trim();
    if (subject    !== undefined) updates.subject     = subject;
    if (grade      !== undefined) updates.grade       = grade;
    if (standardCode !== undefined) updates.standardCode = standardCode || null;
    if (standardText !== undefined) updates.standardText = standardText || null;
    if (planData   !== undefined) updates.planData    = planData;

    const [updated] = await db.update(savedLessonPlans)
      .set(updates)
      .where(eq(savedLessonPlans.id, id))
      .returning();

    return res.json({ success: true, lesson: updated });
  } catch (err) {
    console.error('[saved-lessons] update error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/saved-lessons/:id
router.delete('/:id', requireAuth, canManage, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [existing] = await db.select().from(savedLessonPlans).where(eq(savedLessonPlans.id, id));
    if (!existing) return res.status(404).json({ success: false, error: 'Lesson not found.' });
    if (req.user.role !== 'admin' && existing.coachUserId !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Access denied.' });
    }
    await db.delete(savedLessonPlans).where(eq(savedLessonPlans.id, id));
    return res.json({ success: true });
  } catch (err) {
    console.error('[saved-lessons] delete error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
