import { Router } from 'express';
import OpenAI from 'openai';
import { requireAuth } from '../middleware/auth.js';
import { getOpenAIModelForTask, getOpenAITemperatureForTask } from '../lib/openai-config.js';

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

// ── Full-lesson enhancement ────────────────────────────────────────────────────

const LESSON_SYSTEM_MESSAGE = [
  'You are an expert K-12 curriculum developer, instructional coach, and experienced classroom teacher.',
  '',
  'TASK: Enhance an entire lesson plan to curriculum-developer quality — practical, classroom-ready, and immediately usable.',
  '',
  'STRICT RULES:',
  '• Respond with ONLY a valid JSON object — no explanation, no markdown, no code fences.',
  '• Return a COMPLETE lesson plan with ALL fields populated.',
  '• Keep standardCode, standardText, subject, grade, domain, cluster, and title EXACTLY as provided.',
  '• Generate ACTUAL content — real examples, problems, questions, answer keys, prompts. Never use placeholders or say "teacher creates".',
  '• Every example, question, and strategy must be specific to the standard and grade level.',
  '• Write in direct, teacher-friendly language — practical and immediately usable.',
  '• Do NOT wrap the result in any outer key — return the flat lesson plan object.',
].join('\n');

function buildLessonEnhancementPrompt(lessonPlan, selectedStandard) {
  const subject = (selectedStandard.subject || lessonPlan.subject || '').toLowerCase();
  const isMath = subject.includes('math');
  const isELA  = subject.includes('ela') || subject.includes('english') || subject.includes('literacy') || subject.includes('reading') || subject.includes('writing');

  const currentSupports = lessonPlan.studentSupports
    ? JSON.stringify(lessonPlan.studentSupports, null, 2)
    : 'null';

  const lines = [
    `Enhance this lesson plan to curriculum-developer quality.`,
    ``,
    `Standard : ${selectedStandard.standard_code || lessonPlan.standardCode}`,
    `Text     : ${selectedStandard.standard_text  || lessonPlan.standardText}`,
    `Subject  : ${selectedStandard.subject || lessonPlan.subject}  |  Grade: ${selectedStandard.grade || lessonPlan.grade}`,
    `Domain   : ${selectedStandard.domain   || lessonPlan.domain}`,
    `Cluster  : ${selectedStandard.cluster  || lessonPlan.cluster}`,
    ``,
    `Current lesson to build from:`,
    `  Title    : ${lessonPlan.title}`,
    `  Objective: ${lessonPlan.objective || '(not yet written)'}`,
    `  Warm-Up  : ${(lessonPlan.warmUp || '').slice(0, 150) || '(not yet written)'}`,
    ``,
  ];

  if (isMath) {
    lines.push(
      `MATH REQUIREMENTS:`,
      `• Direct Instruction: Include step-by-step worked example with teacher think-aloud, a visual/model suggestion, and one common misconception + teacher move to address it.`,
      `• Guided Practice: Include 3 problems with full answers (worked solutions).`,
      `• Independent Practice: Include 4-5 problems students solve alone; list answer key in Teacher Notes.`,
      `• Assessment questions: mix of word problems, multiple choice, and short answer — all with answer keys.`,
      ``,
    );
  } else if (isELA) {
    lines.push(
      `ELA / LITERACY REQUIREMENTS:`,
      `• Direct Instruction: Include teacher modeling language ("Watch me as I…", "I notice…") and a short original passage (2-4 paragraphs, age-appropriate, created by you — not from any copyrighted source).`,
      `• Guided Practice: Include 3 text-dependent questions with sample answers and a discussion prompt.`,
      `• Independent Practice: Include a writing prompt with sample student response or success criteria.`,
      `• Assessment questions: text-dependent comprehension + short constructed response — all with answer keys.`,
      ``,
    );
  }

  lines.push(
    `ALL-SUBJECT REQUIREMENTS:`,
    `• Warm-Up: Include the exact prompt/problem the teacher says AND the expected student response.`,
    `• Success Criteria: 3-4 "I can…" statements.`,
    `• Materials: List every actual material (handouts, manipulatives, texts, slides, tools).`,
    `• Checks for Understanding: 3-4 specific strategies with the exact question or prompt the teacher uses.`,
    `• Exit Ticket: 2 questions students answer at the end — include answer key.`,
    `• Teacher Notes: pacing tips, one key misconception, and differentiation reminder.`,
    `• Student Supports: Improve all five sections (el, sped, idea, intervention, advanced) to be grade- and standard-specific.`,
    `• Resource Suggestions: 2-3 search-based suggestions (YouTube, Khan Academy, or teacher resource).`,
    ``,
    `Current student supports (preserve and improve):`,
    currentSupports,
    ``,
    `Return a JSON object with EXACTLY these top-level keys (no extras, no missing):`,
    `title, standardCode, standardText, subject, grade, domain, cluster,`,
    `objective, successCriteria, vocabulary, materials,`,
    `warmUp, directInstruction, guidedPractice, independentPractice, differentiation,`,
    `checksForUnderstanding, assessment, assessmentQuestions, exitTicket, exitTicketQuestions,`,
    `teacherNotes, studentSupports, resourceSuggestions`,
    ``,
    `assessmentQuestions / exitTicketQuestions item shape:`,
    `  { "question": "...", "type": "multiple_choice|short_answer|word_problem", "choices": ["A","B","C","D"], "answer": "..." }`,
    `  (choices only for multiple_choice; teacherNotes optional string for teacher-only context)`,
    ``,
    `studentSupports shape:`,
    `  { "el": { "languageObjective": "", "vocabularySupports": [], "sentenceFrames": [], "oralLanguageSupports": [], "accessStrategies": [] },`,
    `    "sped": { "accommodations": [], "modifications": [], "scaffolds": [], "processingSupports": [] },`,
    `    "idea": { "accessConsiderations": [], "universalDesignSupports": [], "progressMonitoringIdeas": [] },`,
    `    "intervention": { "reteachStrategies": [], "simplifiedTasks": [], "guidedPracticeSupports": [] },`,
    `    "advanced": { "extensions": [], "higherOrderQuestions": [], "independentChallenges": [] } }`,
    ``,
    `resourceSuggestions shape:`,
    `  [{ "type": "video_search", "provider": "YouTube", "searchQuery": "...", "purpose": "..." }]`,
  );

  return lines.join('\n');
}

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
 * Calls OpenAI (model from OPENAI_MODEL_FAST env var) to generate enhanced support content.
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
      model: getOpenAIModelForTask('support_enhancement'),
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_MESSAGE },
        { role: 'user',   content: buildPrompt(lessonPlan, selectedStandard, supportType) },
      ],
      temperature: getOpenAITemperatureForTask('support_enhancement'),
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

// ── POST /enhance-lesson ───────────────────────────────────────────────────────

const LESSON_ARRAY_FIELDS = [
  'successCriteria', 'vocabulary', 'materials', 'checksForUnderstanding',
  'assessmentQuestions', 'exitTicketQuestions',
];

const LESSON_REQUIRED_STRINGS = [
  'objective', 'warmUp', 'directInstruction', 'guidedPractice',
  'independentPractice', 'assessment', 'exitTicket', 'teacherNotes',
];

router.post('/enhance-lesson', requireAuth, async (req, res) => {
  const { lessonPlan, selectedStandard } = req.body;

  if (!lessonPlan || typeof lessonPlan !== 'object' || Array.isArray(lessonPlan)) {
    return res.status(400).json({ success: false, error: 'lessonPlan must be an object.' });
  }
  if (typeof lessonPlan.standardCode !== 'string' || !lessonPlan.standardCode) {
    return res.status(400).json({ success: false, error: 'lessonPlan.standardCode is required.' });
  }
  if (!selectedStandard || typeof selectedStandard !== 'object') {
    return res.status(400).json({ success: false, error: 'selectedStandard must be an object.' });
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error('[lesson-ai] OPENAI_API_KEY is not set. NODE_ENV=%s VERCEL=%s', process.env.NODE_ENV, process.env.VERCEL ?? 'unset');
    return res.status(500).json({
      success: false,
      error: 'OPENAI_API_KEY is not configured on the server. In Vercel: Settings → Environment Variables → ensure OPENAI_API_KEY is set for the Production environment, then redeploy.',
    });
  }

  console.log(
    `[lesson-ai] enhance-lesson | standard=${selectedStandard.standard_code || lessonPlan.standardCode} | user=${req.user?.id}`,
  );

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: getOpenAIModelForTask('full_lesson_enhancement'),
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: LESSON_SYSTEM_MESSAGE },
        { role: 'user',   content: buildLessonEnhancementPrompt(lessonPlan, selectedStandard) },
      ],
      temperature: getOpenAITemperatureForTask('full_lesson_enhancement'),
      max_tokens: 4000,
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) throw new Error('OpenAI returned an empty response.');

    let enhanced;
    try {
      enhanced = JSON.parse(raw);
    } catch {
      console.error('[lesson-ai] enhance-lesson JSON parse failed. Raw:', raw?.slice(0, 300));
      throw new Error('AI returned malformed JSON. Please try again.');
    }

    if (!enhanced || typeof enhanced !== 'object' || Array.isArray(enhanced)) {
      throw new Error('AI returned an unexpected data shape. Please try again.');
    }

    // Always lock standard-identity fields to the originals
    enhanced.standardCode = lessonPlan.standardCode;
    enhanced.standardText = lessonPlan.standardText;
    enhanced.subject      = lessonPlan.subject;
    enhanced.grade        = lessonPlan.grade;
    enhanced.domain       = lessonPlan.domain;
    enhanced.cluster      = lessonPlan.cluster;
    enhanced.title        = (typeof enhanced.title === 'string' && enhanced.title) ? enhanced.title : lessonPlan.title;

    // Fallback: if AI omitted a required string field, keep the original
    for (const f of LESSON_REQUIRED_STRINGS) {
      if (typeof enhanced[f] !== 'string' || !enhanced[f]) enhanced[f] = lessonPlan[f] || '';
    }

    // Fallback: if AI omitted a required array field, keep the original
    for (const f of LESSON_ARRAY_FIELDS) {
      if (!Array.isArray(enhanced[f])) enhanced[f] = Array.isArray(lessonPlan[f]) ? lessonPlan[f] : [];
    }

    // resourceSuggestions is optional — default to empty array if missing
    if (!Array.isArray(enhanced.resourceSuggestions)) enhanced.resourceSuggestions = [];

    // Log missing keys as warnings
    const ALL_EXPECTED = [...LESSON_REQUIRED_STRINGS, ...LESSON_ARRAY_FIELDS, 'title', 'objective', 'differentiation', 'studentSupports', 'resourceSuggestions'];
    const missing = ALL_EXPECTED.filter(k => !(k in enhanced));
    if (missing.length) {
      console.warn(`[lesson-ai] enhance-lesson response missing keys: ${missing.join(', ')}`);
    }

    return res.json({ success: true, enhancedLesson: enhanced, source: 'ai' });

  } catch (err) {
    console.error('[lesson-ai] enhance-lesson error:', err.message);
    return res.status(500).json({
      success: false,
      error: err.message || 'AI lesson enhancement failed. Please try again.',
    });
  }
});

export default router;
