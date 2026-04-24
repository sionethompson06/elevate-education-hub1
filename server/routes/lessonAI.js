import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// ── Valid support types and their field shapes ─────────────────────────────────

const VALID_SUPPORT_TYPES = ['el', 'sped', 'idea', 'intervention', 'advanced'];

/**
 * Returns a mock-enhanced support section keyed by supportType.
 *
 * TO WIRE IN A REAL AI CALL:
 *   1. Import buildSupportEnhancementPrompt from the compiled frontend helpers,
 *      or duplicate its logic here.
 *   2. Call the AI SDK with the prompt string.
 *   3. Parse the JSON response and return it in place of this mock.
 *   4. Change source: 'mock' → source: 'ai' in the response.
 */
function buildMockEnhancedSupport(supportType, lessonPlan, selectedStandard) {
  const topic   = selectedStandard?.cluster  || lessonPlan?.cluster  || 'the topic';
  const code    = selectedStandard?.standard_code || lessonPlan?.standardCode || 'standard';
  const subject = selectedStandard?.subject  || lessonPlan?.subject  || 'the subject';

  const mocks = {
    el: {
      languageObjective: `[AI-enhanced] Students will use precise academic vocabulary to explain and apply ${topic} in ${subject} using structured sentence frames and peer discussion.`,
      vocabularySupports: [
        `Pre-teach the top 5 vocabulary terms from ${code} with visual diagrams and student-friendly definitions.`,
        `Pair each term with a visual anchor and a native-language cognate where available.`,
        `Create a student-facing word wall sorted by concept category, not alphabetically.`,
      ],
      sentenceFrames: [
        `"I know the answer is ___ because ___.`,
        `"This connects to ___ which relates to ___ because ___.`,
        `"I agree / disagree with ___ because the evidence shows ___.`,
      ],
      oralLanguageSupports: [
        `Structured think-pair-share before every written response — minimum 60 seconds.`,
        `Assign a language buddy who can bridge home language and academic English.`,
      ],
      accessStrategies: [
        `Provide a bilingual glossary specific to ${code} before the lesson.`,
        `Use color-coded sentence strips to model the target language structure.`,
      ],
    },

    sped: {
      accommodations: [
        `Extended time (1.5×) for all tasks tied to ${code}.`,
        `Preferential seating near direct instruction area.`,
        `Access to a graphic organizer aligned to the lesson structure.`,
      ],
      modifications: [
        `Reduce problem count to 2–3 high-priority items that directly address ${topic}.`,
        `Accept verbal or drawn responses as equivalents to written responses.`,
      ],
      scaffolds: [
        `Provide a worked-example reference card for every step of ${topic}.`,
        `Keep an anchor chart visible during all practice time showing key steps and vocabulary.`,
      ],
      processingSupports: [
        `Break ${topic} into discrete micro-steps with a teacher check-in at each.`,
        `Provide written instructions alongside all verbal directions.`,
      ],
    },

    idea: {
      accessConsiderations: [
        `Ensure all materials for ${code} are available in digital, print, and audio formats.`,
        `Accept flexible response modalities per each student's IEP.`,
      ],
      universalDesignSupports: [
        `Offer three engagement options for ${topic}: visual model, hands-on task, or written explanation.`,
        `Provide digital materials with text-to-speech compatibility.`,
      ],
      progressMonitoringIdeas: [
        `Exit slip after every ${code} lesson — one question at the target level.`,
        `Skill probe (3 items) at the start of the follow-up lesson.`,
      ],
    },

    intervention: {
      reteachStrategies: [
        `Use a CRA sequence specific to ${topic}: manipulative → diagram → symbolic.`,
        `Re-teach in a small group of 3–4 using a pared-down version of the direct instruction.`,
      ],
      simplifiedTasks: [
        `Single-step entry tasks for ${topic} before introducing multi-step complexity.`,
        `Provide a step-by-step checklist for each task type in ${code}.`,
      ],
      guidedPracticeSupports: [
        `Teacher-beside modeling: teacher solves step 1, student solves step 2 immediately after.`,
        `Check in every 3–4 minutes during independent practice; note which scaffold is still needed.`,
      ],
    },

    advanced: {
      extensions: [
        `Design an original problem that extends ${topic} to a real-world context and justify your approach.`,
        `Compare two solution strategies for efficiency — argue which is superior and why.`,
      ],
      higherOrderQuestions: [
        `"How would this change if we altered one constraint in ${code}? Prove your answer."`,
        `"Identify the hidden assumption in this approach. What breaks if that assumption is false?"`,
      ],
      independentChallenges: [
        `Open-ended modeling task: apply ${topic} to an unstructured real-world scenario with no single answer.`,
        `Peer-teach the strategy — explain the why, not just the how.`,
      ],
    },
  };

  return mocks[supportType] ?? {};
}

// ── Route ──────────────────────────────────────────────────────────────────────

/**
 * POST /api/lesson-ai/enhance-supports
 *
 * Accepts a lesson plan, a standard, and a support type.
 * Currently returns a mock response — no AI API called.
 *
 * To wire in a real AI call, replace the buildMockEnhancedSupport() block
 * with an AI SDK call using the prompt built by buildSupportEnhancementPrompt()
 * from src/lib/lesson-ai-ready.ts.
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

  // ── Log context (this is what will be passed to AI when wired) ──────────────
  console.log(
    `[lesson-ai] enhance-supports | type=${supportType} | standard=${selectedStandard.standard_code} | user=${req.user?.id}`,
  );

  // ── Mock response ────────────────────────────────────────────────────────────
  // Replace this block with a real AI SDK call:
  //   const prompt = buildSupportEnhancementPrompt(lessonPlan, supportType);
  //   const raw    = await aiClient.generate(prompt);
  //   const enhancedSupports = JSON.parse(raw);
  const enhancedSupports = buildMockEnhancedSupport(supportType, lessonPlan, selectedStandard);

  return res.json({
    success: true,
    supportType,
    enhancedSupports,
    source: 'mock', // → 'ai' once real call is wired
  });
});

export default router;
