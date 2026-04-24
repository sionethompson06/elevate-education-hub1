/**
 * Rule-based lesson plan generator.
 *
 * Takes a single CCSS standard and produces a structured LessonPlan. No AI
 * calls — all text is assembled from templates chosen by subject, grade band,
 * and keyword cues extracted from the standard's text, domain, and cluster.
 *
 * Math standards → problem-solving, modeling, and practice activities.
 * ELA-Literacy standards → reading, writing, and discussion activities.
 */

import type { LessonPlan, StandardInput } from "@/types/lesson-plan";

// ── helpers ───────────────────────────────────────────────────────────────────

const isMath = (s: StandardInput): boolean => /math/i.test(s.subject);
const isELA = (s: StandardInput): boolean => /ela|english|literacy/i.test(s.subject);

const gradeLabel = (g: string): string => {
  if (!g) return "";
  if (g === "K") return "Kindergarten";
  if (g === "HS") return "High School";
  if (g === "K-12") return "K–12";
  return `Grade ${g}`;
};

const shortStandardCode = (code: string): string =>
  (code || "")
    .replace(/^CCSS\.(Math\.Content|Math\.Practice|ELA-Literacy)\./, "")
    .replace(/^CCSS\./, "");

const gradeBand = (g: string): "K-2" | "3-5" | "6-8" | "HS" => {
  if (g === "K" || g === "1" || g === "2") return "K-2";
  if (g === "3" || g === "4" || g === "5") return "3-5";
  if (g === "6" || g === "7" || g === "8") return "6-8";
  return "HS";
};

/** Pull a concise objective phrase from the raw standard text. */
const trimObjective = (text: string): string => {
  if (!text) return "";
  const firstSentence = text.split(/(?<=[.!?])\s+/)[0] ?? text;
  return firstSentence.trim().replace(/[.!?]+$/, "");
};

/** Pull likely academic vocabulary from standard/domain/cluster text. */
function extractVocabulary(s: StandardInput): string[] {
  const text = `${s.standard_text} ${s.domain} ${s.cluster}`.toLowerCase();
  const mathTerms = [
    "addend", "area", "angle", "circumference", "coefficient", "coordinate",
    "decimal", "denominator", "difference", "dividend", "divisor", "equation",
    "equivalent", "expression", "factor", "fraction", "function", "inequality",
    "integer", "linear", "multiple", "numerator", "perimeter", "polygon",
    "polynomial", "probability", "product", "quadratic", "quotient", "radius",
    "ratio", "rational", "remainder", "slope", "sum", "variable", "vertex",
    "volume",
  ];
  const elaTerms = [
    "analyze", "argument", "author", "character", "claim", "cite", "compare",
    "contrast", "context", "dialogue", "evidence", "figurative", "inference",
    "main idea", "metaphor", "narrator", "paraphrase", "perspective", "plot",
    "point of view", "protagonist", "setting", "simile", "summarize", "symbol",
    "theme", "thesis", "tone", "vocabulary",
  ];
  const pool = isMath(s) ? mathTerms : elaTerms;
  const found = pool.filter((t) => text.includes(t));
  if (found.length >= 3) return found.slice(0, 6);
  // fallback: seed from domain / cluster words
  const fallback = [s.domain, s.cluster]
    .filter(Boolean)
    .flatMap((str) => str.split(/[,;:/()]|\s+and\s+/))
    .map((w) => w.trim())
    .filter((w) => w.length > 3 && w.length < 40);
  return [...new Set([...found, ...fallback])].slice(0, 5);
}

// ── section builders ──────────────────────────────────────────────────────────

function buildTitle(s: StandardInput): string {
  const code = s.short_code || shortStandardCode(s.standard_code);
  const topic = s.cluster || s.domain || (isMath(s) ? "Math Skill" : "Literacy Skill");
  return `${code} — ${topic}`;
}

function buildObjective(s: StandardInput): string {
  const action = trimObjective(s.standard_text);
  if (!action) return `Students will demonstrate mastery of ${s.domain || "the standard"}.`;
  return `Students will be able to ${action.charAt(0).toLowerCase()}${action.slice(1)}.`;
}

function buildSuccessCriteria(s: StandardInput): string[] {
  const topic = (s.cluster || s.domain || "today's skill").toLowerCase();
  if (isMath(s)) {
    return [
      `I can explain the key concept of ${topic} in my own words.`,
      `I can solve problems that apply ${topic}.`,
      `I can justify my reasoning using mathematical language.`,
      `I can check my work and identify mistakes.`,
    ];
  }
  if (isELA(s)) {
    return [
      `I can identify the key idea behind ${topic} in a text.`,
      `I can cite specific evidence from the text to support my thinking.`,
      `I can discuss my ideas clearly with peers.`,
      `I can write a response that applies ${topic}.`,
    ];
  }
  return [
    `I can describe what ${topic} means.`,
    `I can apply ${topic} in practice.`,
    `I can reflect on my work and ask questions.`,
  ];
}

function buildMaterials(s: StandardInput): string[] {
  const base = [
    "Lesson slides or anchor chart",
    "Student notebooks and pencils",
    "Dry-erase boards or sticky notes for quick checks",
  ];
  if (isMath(s)) {
    const band = gradeBand(s.grade);
    const bandTools =
      band === "K-2"
        ? ["Counters, base-ten blocks, or ten frames", "Number line"]
        : band === "3-5"
          ? ["Fraction tiles or bars", "Grid paper", "Number line"]
          : band === "6-8"
            ? ["Graph paper", "Rulers", "Calculators"]
            : ["Graphing calculators or Desmos", "Printed practice problem set"];
    return [...base, ...bandTools, "Exit ticket copies"];
  }
  if (isELA(s)) {
    return [
      ...base,
      "Grade-appropriate mentor text or passage",
      "Graphic organizer / annotation guide",
      "Writing paper or digital doc",
      "Exit ticket copies",
    ];
  }
  return [...base, "Task cards", "Exit ticket copies"];
}

function buildWarmUp(s: StandardInput): string {
  const topic = s.cluster || s.domain;
  if (isMath(s)) {
    return [
      `Open with a 5-minute number talk or quick fluency routine tied to ${topic}.`,
      `Display one warm-up problem; students solve silently, then share strategies with a partner.`,
      `Highlight 1–2 student strategies on the board to surface prior thinking.`,
    ].join(" ");
  }
  if (isELA(s)) {
    return [
      `Show a short passage, image, or quote connected to ${topic}.`,
      `Ask students to turn-and-talk: "What do you notice? What do you wonder?"`,
      `Chart responses to activate prior knowledge before the mini-lesson.`,
    ].join(" ");
  }
  return `Open with a quick discussion prompt or "Do Now" connected to ${topic} to activate prior knowledge.`;
}

function buildDirectInstruction(s: StandardInput): string {
  const code = s.short_code || shortStandardCode(s.standard_code);
  const text = trimObjective(s.standard_text);
  if (isMath(s)) {
    return [
      `State the learning target: "${text}." (Standard ${code})`,
      `Model one worked example using think-alouds. Use visual representations (diagram, model, or graph) alongside the symbolic work.`,
      `Make the reasoning explicit: "I notice… I know… So I'll try…"`,
      `Introduce precise vocabulary and write each term on the anchor chart with a student-friendly definition.`,
    ].join(" ");
  }
  if (isELA(s)) {
    return [
      `State the learning target: "${text}." (Standard ${code})`,
      `Use a short mentor text to model the strategy. Think aloud as you annotate: "Here I see… this tells me… so I'll…"`,
      `Anchor the strategy on chart paper with a clear name, when to use it, and the steps.`,
      `Invite students to notice and name what you did before moving into practice.`,
    ].join(" ");
  }
  return `Directly model the skill with a clear example and think-aloud, anchoring key vocabulary on the chart.`;
}

function buildGuidedPractice(s: StandardInput): string {
  if (isMath(s)) {
    return [
      `Work 2–3 problems together: teacher sets up, students solve on whiteboards, class debriefs.`,
      `Use partner talk between each problem. Monitor for misconceptions and re-teach quickly.`,
      `Gradually reduce scaffolds; by the last problem, students lead the reasoning.`,
    ].join(" ");
  }
  if (isELA(s)) {
    return [
      `Read a short shared passage aloud. Pause to ask targeted text-dependent questions.`,
      `Students work in pairs to annotate a second passage using the same strategy modeled above.`,
      `Bring the class together to share findings and cite specific evidence.`,
    ].join(" ");
  }
  return `Provide a shared example. Students try each step in pairs and share out before moving on.`;
}

function buildIndependentPractice(s: StandardInput): string {
  if (isMath(s)) {
    return [
      `Students complete a tiered problem set (4–6 problems) ranging from fluency to application and one modeling/"justify your reasoning" task.`,
      `Encourage showing work with a model, equation, and written explanation.`,
      `Teacher confers 1:1 or in small groups with students flagged in the warm-up.`,
    ].join(" ");
  }
  if (isELA(s)) {
    return [
      `Students apply the strategy independently to a new passage or writing task.`,
      `Provide a graphic organizer for capturing evidence, annotations, or drafting.`,
      `Teacher pulls a small group for a strategy re-teach while the rest work independently.`,
    ].join(" ");
  }
  return `Students apply the skill independently to a new task of similar complexity.`;
}

function buildDifferentiation(s: StandardInput): string {
  const ell = isMath(s)
    ? "Pre-teach vocabulary with visuals. Provide sentence frames (e.g., \"I know ___ because ___.\"). Allow native-language thinking."
    : "Pre-teach key vocabulary with images. Provide sentence stems for discussion and writing. Pair with a supportive partner.";
  const sped = isMath(s)
    ? "Offer concrete manipulatives. Reduce problem count and chunk multi-step tasks. Provide a worked-example reference sheet."
    : "Chunk the text with headings or numbered sections. Provide audio support and a visual anchor of the strategy.";
  const advanced = isMath(s)
    ? "Offer a stretch task: create your own problem, find multiple solution paths, or explain why a common error is incorrect."
    : "Offer a deeper prompt: compare across two texts, defend a counter-claim, or revise writing for stronger evidence.";
  return [
    `ELL: ${ell}`,
    `SPED / 504: ${sped}`,
    `Advanced Learners: ${advanced}`,
  ].join("\n\n");
}

function buildChecksForUnderstanding(s: StandardInput): string[] {
  if (isMath(s)) {
    return [
      "Thumbs up / sideways / down after the modeled example.",
      "Mid-lesson whiteboard check: solve one problem and hold it up.",
      "Cold-call a student to justify a peer's strategy in their own words.",
      "Observation: circulate during guided practice and note 3 students to follow up with.",
    ];
  }
  if (isELA(s)) {
    return [
      "Turn-and-talk after modeling: \"What did I just do? Why?\"",
      "Quick write (2 minutes): apply the strategy to one sentence or paragraph.",
      "Cold-call for text-based evidence during guided reading.",
      "Observation: note annotations during independent reading.",
    ];
  }
  return [
    "Quick poll after modeling.",
    "Partner share and report-out.",
    "Exit slip connected to today's target.",
  ];
}

function buildAssessment(s: StandardInput): string {
  if (isMath(s)) {
    return `Formative: score the independent practice problem set for accuracy and clarity of reasoning. Rubric dimensions: correct answer, appropriate strategy, clear explanation.`;
  }
  if (isELA(s)) {
    return `Formative: collect the written response. Rubric dimensions: strategy applied correctly, evidence cited from the text, clear and organized writing.`;
  }
  return `Formative: collect student work and score against the success criteria.`;
}

function buildExitTicket(s: StandardInput): string {
  const code = s.short_code || shortStandardCode(s.standard_code);
  if (isMath(s)) {
    return [
      `1. Solve one problem that directly applies ${code}.`,
      `2. In one sentence, explain the strategy you used.`,
      `3. Rate your confidence 1–4 on today's learning target.`,
    ].join("\n");
  }
  if (isELA(s)) {
    return [
      `1. In 2–3 sentences, apply today's strategy to the exit-ticket passage.`,
      `2. Cite one piece of evidence that supports your thinking.`,
      `3. Rate your confidence 1–4 on today's learning target.`,
    ].join("\n");
  }
  return [
    `1. What is one thing you learned today?`,
    `2. Apply it to one new example.`,
    `3. Rate your confidence 1–4.`,
  ].join("\n");
}

function buildTeacherNotes(s: StandardInput): string {
  const band = gradeBand(s.grade);
  const pacing =
    band === "K-2"
      ? "Keep each block short (5–7 min). Plan for movement."
      : band === "3-5"
        ? "Aim for ~10 min mini-lesson, ~20 min work time, ~5 min share."
        : band === "6-8"
          ? "Mini-lesson 10–12 min, guided 10 min, independent 20 min, close 5 min."
          : "Mini-lesson 10–15 min, guided 15 min, independent 20–25 min, close 5 min.";
  const watch = isMath(s)
    ? "Watch for students who get the right answer but can't justify it — their understanding may be surface-level."
    : "Watch for students who retell the text instead of analyzing it — push them back to the specific evidence.";
  return [
    `Grade band: ${gradeLabel(s.grade)} (${band}). ${pacing}`,
    `Common pitfall: ${watch}`,
    `If time runs short, cut independent practice first; preserve the modeled example and guided practice.`,
    `Follow-up: plan a spiral review within the next 3–5 lessons.`,
  ].join("\n");
}

// ── public API ────────────────────────────────────────────────────────────────

/**
 * Generate a complete LessonPlan from a single CCSS standard.
 * All text is deterministic — no network calls.
 */
export function generateLessonPlan(standard: StandardInput): LessonPlan {
  if (!standard || !standard.standard_code) {
    throw new Error("generateLessonPlan: a standard with a standard_code is required");
  }

  return {
    title: buildTitle(standard),
    standardCode: standard.standard_code,
    standardText: standard.standard_text,
    subject: standard.subject,
    grade: standard.grade,
    domain: standard.domain,
    cluster: standard.cluster,
    objective: buildObjective(standard),
    successCriteria: buildSuccessCriteria(standard),
    vocabulary: extractVocabulary(standard),
    materials: buildMaterials(standard),
    warmUp: buildWarmUp(standard),
    directInstruction: buildDirectInstruction(standard),
    guidedPractice: buildGuidedPractice(standard),
    independentPractice: buildIndependentPractice(standard),
    differentiation: buildDifferentiation(standard),
    checksForUnderstanding: buildChecksForUnderstanding(standard),
    assessment: buildAssessment(standard),
    exitTicket: buildExitTicket(standard),
    teacherNotes: buildTeacherNotes(standard),
  };
}

/**
 * Parse a `lesson_assignments.instructions` string into a LessonPlan if it
 * looks like one. Returns `null` for plain-text instructions, invalid JSON,
 * or JSON that is missing required LessonPlan fields. Safe to call on any
 * string — never throws.
 */
export function parseLessonPlanInstructions(
  instructions: string | null | undefined,
): LessonPlan | null {
  if (!instructions) return null;
  const trimmed = instructions.trim();
  if (!trimmed.startsWith("{")) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;

  const p = parsed as Record<string, unknown>;
  const looksLikePlan =
    typeof p.title === "string" &&
    typeof p.objective === "string" &&
    typeof p.standardCode === "string" &&
    Array.isArray(p.successCriteria) &&
    typeof p.warmUp === "string" &&
    typeof p.directInstruction === "string";

  if (!looksLikePlan) return null;

  // Tolerate missing/extra fields — coerce arrays and strings so the renderer
  // never needs to guard.
  const asString = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);
  const asStringArray = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

  return {
    title: asString(p.title),
    standardCode: asString(p.standardCode),
    standardText: asString(p.standardText),
    subject: asString(p.subject),
    grade: asString(p.grade),
    domain: asString(p.domain),
    cluster: asString(p.cluster),
    objective: asString(p.objective),
    successCriteria: asStringArray(p.successCriteria),
    vocabulary: asStringArray(p.vocabulary),
    materials: asStringArray(p.materials),
    warmUp: asString(p.warmUp),
    directInstruction: asString(p.directInstruction),
    guidedPractice: asString(p.guidedPractice),
    independentPractice: asString(p.independentPractice),
    differentiation: asString(p.differentiation),
    checksForUnderstanding: asStringArray(p.checksForUnderstanding),
    assessment: asString(p.assessment),
    exitTicket: asString(p.exitTicket),
    teacherNotes: asString(p.teacherNotes),
  };
}

/**
 * Serialize a LessonPlan to a readable Markdown string suitable for storing in
 * `lesson_assignments.instructions` or copying to clipboard.
 */
export function lessonPlanToMarkdown(plan: LessonPlan): string {
  const list = (items: string[]): string => items.map((it) => `- ${it}`).join("\n");
  return [
    `# ${plan.title}`,
    ``,
    `**Standard:** ${plan.standardCode} — ${plan.standardText}`,
    `**Subject:** ${plan.subject}  **Grade:** ${gradeLabel(plan.grade)}`,
    plan.domain ? `**Domain:** ${plan.domain}` : "",
    plan.cluster ? `**Cluster:** ${plan.cluster}` : "",
    ``,
    `## Learning Objective`,
    plan.objective,
    ``,
    `## Success Criteria`,
    list(plan.successCriteria),
    ``,
    `## Academic Vocabulary`,
    list(plan.vocabulary),
    ``,
    `## Materials`,
    list(plan.materials),
    ``,
    `## Warm-Up / Hook`,
    plan.warmUp,
    ``,
    `## Direct Instruction`,
    plan.directInstruction,
    ``,
    `## Guided Practice`,
    plan.guidedPractice,
    ``,
    `## Independent Practice`,
    plan.independentPractice,
    ``,
    `## Differentiation`,
    plan.differentiation,
    ``,
    `## Checks for Understanding`,
    list(plan.checksForUnderstanding),
    ``,
    `## Assessment`,
    plan.assessment,
    ``,
    `## Exit Ticket`,
    plan.exitTicket,
    ``,
    `## Teacher Notes`,
    plan.teacherNotes,
  ]
    .filter((l) => l !== "")
    .join("\n");
}
