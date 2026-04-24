import { Router } from 'express';
import OpenAI from 'openai';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// ── Constants ──────────────────────────────────────────────────────────────────

const VALID_SUPPORT_TYPES = ['el', 'sped', 'idea', 'intervention', 'advanced'];

const SUPPORT_LABELS = {
  el:           'English Language Learners (EL / ELL)',
  sped:         'Special Education (SPED / 504)',
  idea:         'IDEA / Universal Design for Learning',
  intervention: 'Intervention / Tier 2–3 Students',
  advanced:     'Advanced Learners / Extensions',
};

// Keys the AI must return for each support type (mirrors StudentSupports interface)
const SUPPORT_SHAPE_KEYS = {
  el:           ['languageObjective', 'vocabularySupports', 'sentenceFrames', 'oralLanguageSupports', 'accessStrategies'],
  sped:         ['accommodations', 'modifications', 'scaffolds', 'processingSupports'],
  idea:         ['accessConsiderations', 'universalDesignSupports', 'progressMonitoringIdeas'],
  intervention: ['reteachStrategies', 'simplifiedTasks', 'guidedPracticeSupports'],
  advanced:     ['extensions', 'higherOrderQuestions', 'independentChallenges'],
};

// ── Prompt builder (mirrors buildSupportEnhancementPrompt from lesson-ai-ready.ts) ──

function buildPrompt(lessonPlan, selectedStandard, supportType) {
  const label           = SUPPORT_LABELS[supportType];
  const existingSection = lessonPlan.studentSupports?.[supportType] ?? null;
  const vocab           = Array.isArray(lessonPlan.vocabulary)
    ? lessonPlan.vocabulary.join(', ')
    : '—';

  const lines = [
    `The teacher is working on a lesson plan for the following CCSS standard:`,
    `  Standard : ${selectedStandard.standard_code || lessonPlan.standardCode}`,
    `  Text     : ${selectedStandard.standard_text  || lessonPlan.standardText}`,
    `  Subject  : ${selectedStandard.subject || lessonPlan.subject}  |  Grade: ${selectedStandard.grade || lessonPlan.grade}`,
    `  Domain   : ${selectedStandard.domain   || lessonPlan.domain}`,
    `  Cluster  : ${selectedStandard.cluster  || lessonPlan.cluster}`,
    ``,
    `Learning objective : ${lessonPlan.objective}`,
    `Key vocabulary     : ${vocab}`,
  ];

  if (lessonPlan.assessmentQuestions?.length) {
    lines.push(`Assessment         : ${lessonPlan.assessmentQuestions.length} question(s) — ${lessonPlan.assessment || ''}`);
  }
  if (lessonPlan.exitTicketQuestions?.length) {
    lines.push(`Exit ticket        : ${lessonPlan.exitTicketQuestions.length} question(s) — ${lessonPlan.exitTicket || ''}`);
  }

  lines.push(
    ``,
    `Enhance the student support plan for: ${label}`,
    ``,
    `Current support content:`,
    JSON.stringify(existingSection, null, 2),
    ``,
    `Expected JSON keys for this section: ${SUPPORT_SHAPE_KEYS[supportType].join(', ')}`,
    ``,
    `Return ONLY a flat JSON object with exactly those keys.`,
    `Make every item specific, grade-appropriate, and tied to this standard.`,
    `Avoid generic advice. Prioritize practical, classroom-ready strategies.`,
  );

  return lines.join('\n');
}

const SYSTEM_MESSAGE = [
  'You are an expert K-12 curriculum designer and instructional coach specialising in differentiated instruction.',
  '',
  'TASK: Enhance ONE student support section of a teacher\'s lesson plan.',
  '',
  'STRICT RULES:',
  '• Respond with ONLY a valid JSON object — no explanation, no markdown, no code fences.',
  '• Use the exact key names listed in the user message. Do NOT add or remove keys.',
  '• String fields must remain strings. Array fields must remain arrays of strings.',
  '• Every strategy must be directly tied to the specific standard supplied.',
  '• Use teacher-friendly, classroom-ready language — no jargon or generic filler.',
  '• Do NOT alter the lesson objective, lesson title, or any other part of the plan.',
  '• Do NOT wrap the result in an outer key like "el" or "supports" — return the flat object.',
].join('\n');

// ── Route ──────────────────────────────────────────────────────────────────────

/**
 * POST /api/lesson-ai/enhance-supports
 *
 * Accepts lessonPlan, selectedStandard, and supportType.
 * Calls OpenAI gpt-4o-mini to generate enhanced support content.
 * Returns { success, supportType, enhancedSupports, source: 'ai' }.
 *
 * Requires OPENAI_API_KEY environment variable.
 */
router.post('/enhance-supports', requireAuth, async (req, res) => {
  const { lessonPlan, selectedStandard, supportType } = req.body;

  // ── Validation ──────────────────────────────────────────────────────────────
  if (!lessonPlan || typeof lessonPlan !== 'object' || Array.isArray(lessonPlan)) {
    return res.status(400).json({ success: false, error: 'lessonPlan must be an object.' });
  }
  if (typeof lessonPlan.standardCode !== 'string' || !lessonPlan.standardCode) {
    return res.status(400).json({ success: false, error: 'lessonPlan.standardCode is required.' });
  }
  if (!selectedStandard || typeof selectedStandard !== 'object') {
    return res.status(400).json({ success: false, error: 'selectedStandard must be an object.' });
  }
  if (typeof selectedStandard.standard_code !== 'string' || !selectedStandard.standard_code) {
    return res.status(400).json({ success: false, error: 'selectedStandard.standard_code is required.' });
  }
  if (!VALID_SUPPORT_TYPES.includes(supportType)) {
    return res.status(400).json({
      success: false,
      error: `supportType must be one of: ${VALID_SUPPORT_TYPES.join(', ')}.`,
    });
  }

  // ── API key guard ────────────────────────────────────────────────────────────
  if (!process.env.OPENAI_API_KEY) {
    console.error('[lesson-ai] OPENAI_API_KEY is not set. NODE_ENV=%s VERCEL=%s', process.env.NODE_ENV, process.env.VERCEL ?? 'unset');
    return res.status(500).json({
      success: false,
      error: 'OPENAI_API_KEY is not configured on the server. In Vercel: Settings → Environment Variables → ensure OPENAI_API_KEY is set for the Production environment, then redeploy.',
    });
  }

  console.log(
    `[lesson-ai] enhance-supports | type=${supportType} | standard=${selectedStandard.standard_code} | user=${req.user?.id}`,
  );

  // ── OpenAI call ──────────────────────────────────────────────────────────────
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_MESSAGE },
        { role: 'user',   content: buildPrompt(lessonPlan, selectedStandard, supportType) },
      ],
      temperature: 0.7,
      max_tokens: 1200,
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) throw new Error('OpenAI returned an empty response.');

    let enhancedSupports;
    try {
      enhancedSupports = JSON.parse(raw);
    } catch {
      console.error('[lesson-ai] JSON parse failed. Raw:', raw?.slice(0, 300));
      throw new Error('AI returned malformed JSON. Please try again.');
    }

    if (!enhancedSupports || typeof enhancedSupports !== 'object' || Array.isArray(enhancedSupports)) {
      throw new Error('AI returned an unexpected data shape. Please try again.');
    }

    // Log missing keys as warnings — non-fatal, frontend tolerates partial data
    const missing = SUPPORT_SHAPE_KEYS[supportType].filter(k => !(k in enhancedSupports));
    if (missing.length) {
      console.warn(`[lesson-ai] AI response missing keys for ${supportType}: ${missing.join(', ')}`);
    }

    return res.json({
      success: true,
      supportType,
      enhancedSupports,
      source: 'ai',
    });

  } catch (err) {
    console.error('[lesson-ai] error:', err.message);
    return res.status(500).json({
      success: false,
      error: err.message || 'AI enhancement failed. Please try again.',
    });
  }
});

export default router;
