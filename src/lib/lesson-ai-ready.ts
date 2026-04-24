/**
 * AI-ready architecture for lesson plan enhancement.
 *
 * All functions are pure data transformers — no network calls, no side effects.
 * When AI integration is added, pass the outputs of these helpers directly to
 * the model call and feed the response into mergeAIEnhancedSupports().
 */

import type { LessonPlan, LessonQuestion, StandardInput, StudentSupports } from "@/types/lesson-plan";

// ── private helpers ────────────────────────────────────────────────────────────

function gradeBandLabel(grade: string): string {
  if (grade === "K" || grade === "1" || grade === "2") return "K-2";
  if (grade === "3" || grade === "4" || grade === "5") return "3-5";
  if (grade === "6" || grade === "7" || grade === "8") return "6-8";
  return "HS";
}

// ── exported types ─────────────────────────────────────────────────────────────

/** Structured context object consumed by the AI layer. */
export interface LessonAIContext {
  standard: {
    code: string;
    text: string;
    subject: string;
    grade: string;
    gradeBand: string;
    domain: string;
    cluster: string;
  };
  lesson: {
    title: string;
    objective: string;
    vocabulary: string[];
    assessment: string;
    assessmentQuestions: LessonQuestion[];
    exitTicket: string;
    exitTicketQuestions: LessonQuestion[];
  };
  existingSupports: StudentSupports | undefined;
}

// ── public API ─────────────────────────────────────────────────────────────────

/**
 * Assembles everything an AI model needs to understand the lesson before
 * generating enhancements. Pass the returned object as system context.
 *
 * @example
 *   const ctx = buildLessonAIContext(plan, standard);
 *   // const response = await model.generate({ context: ctx, ... });
 */
export function buildLessonAIContext(
  lessonPlan: LessonPlan,
  selectedStandard: StandardInput,
): LessonAIContext {
  return {
    standard: {
      code: selectedStandard.standard_code,
      text: selectedStandard.standard_text,
      subject: selectedStandard.subject,
      grade: selectedStandard.grade,
      gradeBand: gradeBandLabel(selectedStandard.grade),
      domain: selectedStandard.domain,
      cluster: selectedStandard.cluster,
    },
    lesson: {
      title: lessonPlan.title,
      objective: lessonPlan.objective,
      vocabulary: lessonPlan.vocabulary,
      assessment: lessonPlan.assessment,
      assessmentQuestions: lessonPlan.assessmentQuestions,
      exitTicket: lessonPlan.exitTicket,
      exitTicketQuestions: lessonPlan.exitTicketQuestions,
    },
    existingSupports: lessonPlan.studentSupports,
  };
}

const SUPPORT_LABELS: Record<keyof StudentSupports, string> = {
  el: "English Language Learners (EL / ELL)",
  sped: "Special Education (SPED / 504)",
  idea: "IDEA / Universal Design for Learning",
  intervention: "Intervention / Tier 2–3 Students",
  advanced: "Advanced Learners / Extensions",
};

/**
 * Builds a ready-to-send prompt string for enhancing one student support
 * category. The returned string is passed directly to the model.
 *
 * The model should return a JSON object with the same keys as the existing
 * section — feed its response into mergeAIEnhancedSupports().
 *
 * @example
 *   const prompt = buildSupportEnhancementPrompt(plan, "el");
 *   // const raw = await model.generate(prompt);
 *   // const updated = mergeAIEnhancedSupports(plan, { el: JSON.parse(raw) });
 */
export function buildSupportEnhancementPrompt(
  lessonPlan: LessonPlan,
  supportType: keyof StudentSupports,
): string {
  const label = SUPPORT_LABELS[supportType];
  const existingSection = lessonPlan.studentSupports?.[supportType] ?? null;

  return [
    `You are an experienced curriculum designer and instructional coach.`,
    ``,
    `The teacher is working on a lesson plan for the following CCSS standard:`,
    `  Standard : ${lessonPlan.standardCode}`,
    `  Text     : ${lessonPlan.standardText}`,
    `  Subject  : ${lessonPlan.subject}  |  Grade: ${lessonPlan.grade}`,
    `  Domain   : ${lessonPlan.domain}`,
    `  Cluster  : ${lessonPlan.cluster}`,
    ``,
    `Learning objective: ${lessonPlan.objective}`,
    `Key vocabulary    : ${lessonPlan.vocabulary.join(", ") || "—"}`,
    lessonPlan.assessmentQuestions?.length
      ? `Assessment        : ${lessonPlan.assessmentQuestions.length} question(s) — ${lessonPlan.assessment}`
      : "",
    lessonPlan.exitTicketQuestions?.length
      ? `Exit ticket       : ${lessonPlan.exitTicketQuestions.length} question(s) — ${lessonPlan.exitTicket}`
      : "",
    ``,
    `Please enhance the student support plan for: ${label}`,
    ``,
    `The existing support content is:`,
    JSON.stringify(existingSection, null, 2),
    ``,
    `Return a JSON object with the same keys shown above.`,
    `Make every item specific, grade-appropriate, and directly tied to this standard.`,
    `Avoid generic advice. Prioritize practical, ready-to-use classroom actions.`,
  ].join("\n");
}

/**
 * Merges AI-generated support sections back into an existing lesson plan.
 * Only the keys present in enhancedSupports are overwritten; all other
 * plan fields and support sections are preserved unchanged.
 *
 * @example
 *   // const raw = await model.generate(prompt);
 *   // const enhanced: Partial<StudentSupports> = { el: JSON.parse(raw) };
 *   const updatedPlan = mergeAIEnhancedSupports(plan, enhanced);
 */
export function mergeAIEnhancedSupports(
  existingLessonPlan: LessonPlan,
  enhancedSupports: Partial<StudentSupports>,
): LessonPlan {
  return {
    ...existingLessonPlan,
    studentSupports: {
      ...existingLessonPlan.studentSupports,
      ...enhancedSupports,
    } as StudentSupports,
  };
}
