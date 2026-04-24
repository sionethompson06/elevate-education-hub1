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

import type { LessonPlan, LessonQuestion, StandardInput, StudentSupports } from "@/types/lesson-plan";

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

// ── question builders ────────────────────────────────────────────────────────

/**
 * Small deterministic RNG keyed off the standard code so each standard gets
 * stable, repeatable numbers in its word problems.
 */
function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
function rng(seed: number): () => number {
  let x = seed || 1;
  return () => {
    x = (x * 1664525 + 1013904223) >>> 0;
    return x / 0x100000000;
  };
}
const pickInt = (r: () => number, lo: number, hi: number) =>
  Math.floor(r() * (hi - lo + 1)) + lo;
const pick = <T,>(r: () => number, arr: T[]): T => arr[Math.floor(r() * arr.length)];

function mathFocus(s: StandardInput): "add" | "subtract" | "multiply" | "divide" | "fractions" | "geometry" | "ratios" | "functions" | "general" {
  const t = `${s.standard_text} ${s.domain} ${s.cluster}`.toLowerCase();
  // Use word boundaries so e.g. "operations" doesn't match /ratio/.
  if (/\b(fraction|numerator|denominator)/.test(t)) return "fractions";
  if (/\b(area|perimeter|volume|angle|triangle|shape|geometr)/.test(t)) return "geometry";
  if (/\b(multipl|product|times)/.test(t)) return "multiply";
  if (/\b(divid|quotient|share equally)/.test(t)) return "divide";
  if (/\b(ratio|proportion|rate|percent)/.test(t)) return "ratios";
  if (/\b(function|linear|quadratic|exponential|graph)/.test(t)) return "functions";
  if (/\b(subtract|difference|take away|less than)/.test(t)) return "subtract";
  if (/\b(add|sum|total|combined)/.test(t)) return "add";
  return "general";
}

function elaFocus(s: StandardInput): "comprehension" | "writing" | "vocabulary" | "speaking" | "general" {
  const t = `${s.standard_text} ${s.domain} ${s.cluster}`.toLowerCase();
  if (/\b(writ|compose|draft|essay|argument|narrative)/.test(t)) return "writing";
  if (/\b(vocab|meaning of|word|phrase)/.test(t)) return "vocabulary";
  if (/\b(discuss|speak|listen|present|collaborat)/.test(t)) return "speaking";
  if (/\b(read|comprehen|infer|main idea|theme|summariz|analyze)/.test(t)) return "comprehension";
  return "general";
}

function buildMathWordProblem(s: StandardInput, r: () => number, variant: number): LessonQuestion {
  const focus = mathFocus(s);
  const band = gradeBand(s.grade);
  const namePool = ["Maya", "Andre", "Priya", "Leo", "Jada", "Marco", "Sofia", "Omar"];
  const name = pick(r, namePool);

  if (focus === "add" || (focus === "general" && band === "K-2")) {
    const a = pickInt(r, 3, 12 + (band === "K-2" ? 0 : 40));
    const b = pickInt(r, 2, 8 + (band === "K-2" ? 0 : 30));
    return {
      question: `${name} read ${a} pages yesterday and ${b} pages today. How many pages did ${name} read in total?`,
      type: "word_problem",
      answer: `${a + b} pages`,
    };
  }
  if (focus === "subtract") {
    const a = pickInt(r, 12, 60);
    const b = pickInt(r, 3, Math.max(4, a - 3));
    return {
      question: `${name} had ${a} stickers and gave ${b} to a friend. How many stickers does ${name} have now?`,
      type: "word_problem",
      answer: `${a - b} stickers`,
    };
  }
  if (focus === "multiply" || (focus === "general" && band === "3-5")) {
    const rows = pickInt(r, 3, 8);
    const per = pickInt(r, 4, 9);
    return {
      question: `${name} is arranging chairs into ${rows} equal rows with ${per} chairs in each row. How many chairs are there in all?`,
      type: "word_problem",
      answer: `${rows * per} chairs`,
    };
  }
  if (focus === "divide") {
    const per = pickInt(r, 3, 7);
    const groups = pickInt(r, 3, 8);
    const total = per * groups;
    return {
      question: `${name} has ${total} marbles to share equally into ${groups} bags. How many marbles go in each bag?`,
      type: "word_problem",
      answer: `${per} marbles per bag`,
    };
  }
  if (focus === "fractions") {
    const d = pick(r, [4, 6, 8]);
    const a = pickInt(r, 1, d - 2);
    const b = pickInt(r, 1, d - a);
    return {
      question: `${name} ate ${a}/${d} of a pizza and a friend ate ${b}/${d}. How much of the pizza did they eat together?`,
      type: "word_problem",
      answer: `${a + b}/${d}`,
    };
  }
  if (focus === "geometry") {
    if (variant === 0) {
      const l = pickInt(r, 4, 14);
      const w = pickInt(r, 3, 10);
      return {
        question: `A rectangular garden is ${l} feet long and ${w} feet wide. What is its area?`,
        type: "word_problem",
        answer: `${l * w} square feet`,
      };
    }
    const l = pickInt(r, 5, 18);
    const w = pickInt(r, 3, 12);
    return {
      question: `A rectangular poster is ${l} inches long and ${w} inches wide. What is its perimeter?`,
      type: "word_problem",
      answer: `${2 * (l + w)} inches`,
    };
  }
  if (focus === "ratios" || (focus === "general" && band === "6-8")) {
    const a = pick(r, [2, 3, 4, 5]);
    const b = pick(r, [3, 4, 5, 6]);
    const mult = pickInt(r, 3, 8);
    return {
      question: `A recipe uses ${a} cups of flour for every ${b} cups of sugar. If ${name} uses ${b * mult} cups of sugar, how many cups of flour are needed?`,
      type: "word_problem",
      answer: `${a * mult} cups of flour`,
    };
  }
  if (focus === "functions" || (focus === "general" && band === "HS")) {
    const m = pickInt(r, 2, 9);
    const b = pickInt(r, 5, 50);
    const x = pickInt(r, 3, 12);
    return {
      question: `A gym charges a $${b} sign-up fee plus $${m} per month. Write an equation for the total cost C after m months, then find C when m = ${x}.`,
      type: "word_problem",
      answer: `C = ${m}m + ${b}; at m = ${x}, C = $${m * x + b}`,
    };
  }
  const a = pickInt(r, 20, 80);
  const b = pickInt(r, 10, a - 5);
  return {
    question: `${name} collected ${a} cans for recycling and donated ${b} to a drive. How many cans does ${name} have left?`,
    type: "word_problem",
    answer: `${a - b} cans`,
  };
}

function buildMathMC(s: StandardInput, r: () => number): LessonQuestion {
  const focus = mathFocus(s);
  if (focus === "fractions") {
    const correct = "3/4";
    return {
      question: "Which fraction is equivalent to 6/8?",
      type: "multiple_choice",
      choices: ["1/2", "2/3", correct, "4/6"],
      answer: correct,
    };
  }
  if (focus === "geometry") {
    return {
      question: "A rectangle has a length of 8 cm and a width of 5 cm. What is its area?",
      type: "multiple_choice",
      choices: ["13 cm²", "26 cm²", "40 cm²", "80 cm²"],
      answer: "40 cm²",
    };
  }
  if (focus === "ratios") {
    return {
      question: "If 3 apples cost $1.50, what is the unit cost of one apple?",
      type: "multiple_choice",
      choices: ["$0.40", "$0.45", "$0.50", "$0.75"],
      answer: "$0.50",
    };
  }
  if (focus === "functions") {
    return {
      question: "Which expression is equivalent to 2(x + 5)?",
      type: "multiple_choice",
      choices: ["2x + 5", "2x + 10", "x + 10", "2x + 7"],
      answer: "2x + 10",
    };
  }
  if (focus === "multiply") {
    const a = pickInt(r, 4, 9);
    const b = pickInt(r, 4, 9);
    const correct = `${a * b}`;
    const distractors = [String(a + b), String(a * b - a), String(a * b + a)];
    return {
      question: `What is ${a} × ${b}?`,
      type: "multiple_choice",
      choices: [...distractors, correct].sort(() => r() - 0.5),
      answer: correct,
    };
  }
  const a = pickInt(r, 10, 40);
  const b = pickInt(r, 5, 25);
  const correct = `${a + b}`;
  return {
    question: `What is ${a} + ${b}?`,
    type: "multiple_choice",
    choices: [String(a + b - 2), correct, String(a + b + 5), String(a * 2)].sort(() => r() - 0.5),
    answer: correct,
  };
}

function buildMathSA(s: StandardInput): LessonQuestion {
  const topic = s.cluster || s.domain || "today's skill";
  return {
    question: `Explain the strategy you used to solve problem 1. Why does it work? Use words, numbers, or a drawing.`,
    type: "short_answer",
    answer: `Look for: clear description of the strategy, connection to ${topic.toLowerCase()}, and accurate reasoning.`,
  };
}

function buildElaComprehension(s: StandardInput): LessonQuestion {
  const focus = elaFocus(s);
  if (focus === "writing") {
    return {
      question: "Reread the mentor paragraph. What is the author's main claim, and what is one piece of evidence they use to support it?",
      type: "short_answer",
      answer: "Look for: accurate claim restated in the student's own words and one specific, text-based detail.",
    };
  }
  if (focus === "vocabulary") {
    return {
      question: "Choose one unfamiliar word from the passage. Use context clues to predict its meaning and explain how the surrounding sentence supports your prediction.",
      type: "short_answer",
      answer: "Look for: a reasonable prediction tied to specific context clues (definition, example, synonym, contrast).",
    };
  }
  return {
    question: "What is the main idea of the passage? Support your answer with one specific piece of evidence from the text.",
    type: "short_answer",
    answer: "Look for: a concise main idea (not a retelling) and one directly cited detail.",
  };
}

function buildElaVocabulary(s: StandardInput, vocab: string[]): LessonQuestion {
  const term = vocab[0] || "inference";
  const correctMap: Record<string, string> = {
    infer: "a conclusion drawn from evidence and reasoning",
    inference: "a conclusion drawn from evidence and reasoning",
    analyze: "to examine carefully to understand how parts work together",
    cite: "to quote or refer to as a source",
    claim: "a statement an author argues is true",
    theme: "a central message or lesson in a text",
    evidence: "details from a text that support a claim",
    metaphor: "a comparison that says one thing is another",
    simile: "a comparison using the word \"like\" or \"as\"",
    tone: "the author's attitude toward the subject",
  };
  const correct = correctMap[term.toLowerCase()] || "a central idea supported by evidence in the text";
  const distractors = [
    "a sentence that starts a paragraph",
    "a summary of the whole story",
    "the author's name or title",
  ];
  return {
    question: `In the context of the passage, which of these best defines "${term}"?`,
    type: "multiple_choice",
    choices: [distractors[0], correct, distractors[1], distractors[2]],
    answer: correct,
  };
}

function buildElaWriting(s: StandardInput): LessonQuestion {
  const focus = elaFocus(s);
  if (focus === "speaking") {
    return {
      question: "In 3–4 sentences, outline what you would say to a partner about the strategy from today's lesson. Include one text-based example.",
      type: "short_answer",
      answer: "Look for: clear statement of the strategy, one specific example from the text, and connected reasoning.",
    };
  }
  if (focus === "writing") {
    return {
      question: "Using today's strategy, write one well-developed paragraph that applies the skill to the passage. Include a clear topic sentence and at least one piece of text-based evidence.",
      type: "short_answer",
      answer: "Look for: topic sentence that states the focus, specific cited evidence, and explanation tying evidence to claim.",
    };
  }
  return {
    question: "Write a short response (3–5 sentences) that applies today's strategy to the passage. Cite at least one piece of evidence from the text.",
    type: "short_answer",
    answer: "Look for: direct application of the strategy, text-based evidence, and clear, organized writing.",
  };
}

function buildAssessmentQuestions(s: StandardInput): LessonQuestion[] {
  const r = rng(hashSeed(s.standard_code || s.short_code || "lesson"));
  if (isMath(s)) {
    return [
      buildMathWordProblem(s, r, 0),
      buildMathWordProblem(s, r, 1),
      buildMathMC(s, r),
      buildMathSA(s),
    ];
  }
  if (isELA(s)) {
    const vocab = extractVocabulary(s);
    return [
      buildElaComprehension(s),
      buildElaVocabulary(s, vocab),
      buildElaWriting(s),
    ];
  }
  return [buildMathSA(s)];
}

function buildExitTicketQuestions(s: StandardInput): LessonQuestion[] {
  const r = rng(hashSeed((s.standard_code || "") + ":exit"));
  if (isMath(s)) {
    return [
      buildMathWordProblem(s, r, 0),
      {
        question: "In one sentence, explain the strategy you used to solve the problem above.",
        type: "short_answer",
        answer: "Look for: a concise description of the strategy with correct mathematical reasoning.",
      },
    ];
  }
  if (isELA(s)) {
    return [
      {
        question: "Apply today's strategy to the exit-ticket passage in 2–3 sentences.",
        type: "short_answer",
        answer: "Look for: correct application of the strategy and clear writing.",
      },
      {
        question: "Cite one specific piece of evidence from the passage that supports your thinking.",
        type: "short_answer",
        answer: "Look for: a direct quote or paraphrase that supports the student's response.",
      },
    ];
  }
  return [
    {
      question: "In one sentence, describe what you learned today and how you would use it.",
      type: "short_answer",
      answer: "Look for: a clear, personal connection to today's learning target.",
    },
  ];
}

function buildStudentSupports(s: StandardInput): StudentSupports {
  const band = gradeBand(s.grade);
  const topic = (s.cluster || s.domain || "today's skill").toLowerCase();
  const code = s.short_code || shortStandardCode(s.standard_code);

  if (isMath(s)) {
    const focus = mathFocus(s);
    const manipulative =
      band === "K-2"
        ? "counters, ten frames, or base-ten blocks"
        : band === "3-5"
          ? "fraction tiles, area models, or number lines"
          : band === "6-8"
            ? "algebra tiles, ratio tables, or graph paper"
            : "graphing calculator or dynamic geometry software";

    return {
      el: {
        languageObjective: `Students will explain their problem-solving process for ${topic} using precise math vocabulary in speaking and writing.`,
        vocabularySupports: [
          `Create a visual word wall for key ${topic} terms with diagrams and simple definitions.`,
          `Provide a bilingual math glossary with pictures and worked examples for high-frequency terms.`,
          `Use color-coding to connect vocabulary words to their symbolic counterparts in equations.`,
        ],
        sentenceFrames: [
          `"I solved this problem by ___, because ___.`,
          `"The answer is ___ because I know that ___.`,
          `"First I ___, then I ___, finally I ___.`,
          focus === "fractions"
            ? `"The fractions are equivalent because ___.`
            : focus === "geometry"
              ? `"The shape has ___, which means the ___ is ___.`
              : `"I noticed that ___, so I ___.`,
        ],
        oralLanguageSupports: [
          `Partner math talk: both partners must explain their strategy before recording any work.`,
          `Use think-alouds with posted sentence starters during guided practice.`,
          `Allow students to process in their home language before sharing in English.`,
        ],
        accessStrategies: [
          `Provide visual models (diagrams, arrays, number lines) alongside all symbolic notation.`,
          `Offer ${manipulative} as physical entry points into the concept.`,
          `Preview key vocabulary and the lesson goal the day before when possible.`,
        ],
      },
      sped: {
        accommodations: [
          `Allow extended time for independent practice (1.5× minimum).`,
          `Permit use of a calculator for computation-heavy steps — focus on the concept, not arithmetic.`,
          `Allow oral responses in place of written explanations.`,
        ],
        modifications: [
          `Reduce problem count: assign 2–3 targeted problems instead of the full set.`,
          `Use smaller, whole-number values first before introducing decimals or fractions.`,
          `Provide partially completed templates or fill-in-the-blank solution frames.`,
        ],
        scaffolds: [
          `Display a worked-example card showing every step for reference during practice.`,
          `Use a graphic organizer: "What I know / What I need to find / My work / My answer."`,
          `Keep an anchor chart with solution steps visible throughout all practice time.`,
        ],
        processingSupports: [
          `Chunk multi-step problems one step at a time with a teacher check-in before continuing.`,
          `Break the lesson into shorter blocks (5–7 min) with brief transitions between.`,
          `Provide written step-by-step directions alongside all oral instructions.`,
        ],
      },
      idea: {
        accessConsiderations: [
          `Offer multiple representations: visual, symbolic, and verbal for every concept.`,
          `Allow students to demonstrate understanding through drawing, modeling, or oral explanation.`,
          `Ensure all printed materials use clear fonts, ample spacing, and accessible formatting.`,
        ],
        universalDesignSupports: [
          `Provide digital materials with text-to-speech access.`,
          `Offer ${manipulative} as a permanent alternative to symbolic-only tasks.`,
          `Allow student choice in how to show work: drawing, table, equation, or explanation.`,
        ],
        progressMonitoringIdeas: [
          `Daily exit slip: one problem at the lesson target level, scored for accuracy and reasoning.`,
          `Skill-specific probe (2–3 items) aligned to ${code} at the start of the next class.`,
          `Anecdotal notes during guided practice — track which scaffolds are still needed.`,
        ],
      },
      intervention: {
        reteachStrategies: [
          `Use the Concrete–Representational–Abstract (CRA) sequence: ${manipulative} first, then diagrams, then symbols.`,
          `Anchor back to prerequisite skills before reintroducing ${topic}.`,
          `Use error analysis: show a common mistake and ask students to find and fix it before re-teaching.`,
        ],
        simplifiedTasks: [
          `Begin with single-step, context-free problems using small whole numbers (under 10).`,
          `Provide a step-by-step checklist students follow for each problem.`,
          `Offer a "starter" version of the practice set with guided cues before the regular problems.`,
        ],
        guidedPracticeSupports: [
          `Teacher models one problem; student mirrors the next step-by-step alongside the teacher.`,
          `Check in with intervention students every 3–4 minutes during independent work.`,
          `Pair with a structured partner who can explain — not just show — their thinking.`,
        ],
      },
      advanced: {
        extensions: [
          `Create an original problem that targets ${topic}, solve it, and write a justification.`,
          `Find two different solution strategies for the same problem; argue which is more efficient.`,
          focus === "functions" || focus === "ratios"
            ? `Connect ${topic} to a real-world dataset: collect data, model it, and interpret the result.`
            : `Write a brief "proof" explaining why the strategy always works — or find a case where it breaks down.`,
        ],
        higherOrderQuestions: [
          `"How would this problem change if you doubled one of the values? What stays the same? What changes?"`,
          `"Is this strategy always true? Can you find a counterexample, or prove it always holds?"`,
          focus === "geometry"
            ? `"How does changing one dimension affect area vs. perimeter? Are they proportional? Explain."`
            : `"Explain the connection between ${topic} and a concept you learned in a previous unit."`,
        ],
        independentChallenges: [
          `Open-ended modeling task: use ${topic} to solve a novel real-world scenario with no single correct answer.`,
          `Peer teaching: prepare a 2-minute explanation of today's strategy to teach to a partner.`,
          `Extension problem set: pull 2–3 items from the next grade band to preview upcoming complexity.`,
        ],
      },
    };
  }

  if (isELA(s)) {
    const focus = elaFocus(s);

    return {
      el: {
        languageObjective: `Students will use academic language to discuss and write about ${topic} using sentence frames and key vocabulary.`,
        vocabularySupports: [
          `Build a visual semantic map for 3–5 priority vocabulary terms before any reading begins.`,
          `Provide a bilingual glossary with images and sentence examples for key academic terms.`,
          `Use concept sorts (cut-up word cards with pictures) to build word ownership before the lesson.`,
        ],
        sentenceFrames: [
          `"The author claims ___ because ___.`,
          `"Based on the text, I think ___, and the evidence is ___.`,
          focus === "writing"
            ? `"My argument is ___. One reason is ___. The evidence is ___.`
            : focus === "speaking"
              ? `"I agree / disagree with ___ because ___.`
              : `"The main idea of this section is ___, supported by ___.`,
        ],
        oralLanguageSupports: [
          `Partner oral rehearsal: both partners summarize a paragraph before any written response.`,
          `Allow students to discuss ideas in their home language before drafting in English.`,
          `Post a discussion norms anchor chart with sentence starters for agreeing, disagreeing, and adding on.`,
        ],
        accessStrategies: [
          `Preview the text with images, titles, and headings to activate schema before reading.`,
          `Provide a graphic organizer that pre-structures the reading (main idea boxes, evidence slots).`,
          `Annotate a shared paragraph together before students annotate independently.`,
        ],
      },
      sped: {
        accommodations: [
          `Read the text aloud or provide an audio version for students with decoding challenges.`,
          `Allow oral responses (recorded or scribed) in place of written responses.`,
          `Allow extended time for reading and written responses (1.5× minimum).`,
        ],
        modifications: [
          `Use a shorter excerpt (1–2 paragraphs) before assigning the full passage.`,
          `Provide sentence-level response options before paragraph-level writing.`,
          `Pre-highlight the most important evidence so students focus on analysis, not location.`,
        ],
        scaffolds: [
          `Provide a graphic organizer with labeled boxes guiding the student's response.`,
          `Post an annotation anchor chart: circle vocabulary, underline evidence, box main idea.`,
          `Offer a writing frame with fill-in-the-blank sentence starters tied to the standard.`,
        ],
        processingSupports: [
          `Chunk the text with numbered paragraphs and "stop and think" questions between sections.`,
          `Separate "finding evidence" and "writing response" as two distinct tasks with a break between.`,
          `Check for comprehension after each paragraph with a brief oral check before continuing.`,
        ],
      },
      idea: {
        accessConsiderations: [
          `Offer multiple text formats: print, digital (text-to-speech), and audio versions per IEP.`,
          `Accept multiple response modalities: drawing, annotating, oral, or written per student need.`,
          `Adjust text complexity (Lexile) while keeping the content and standard rigorous.`,
        ],
        universalDesignSupports: [
          `Provide text-to-speech access for all digital reading materials.`,
          `Offer choice boards: students select how to demonstrate comprehension.`,
          `Build in structured partner talk before any individual written response.`,
        ],
        progressMonitoringIdeas: [
          `Daily exit slip: one text-based question at the lesson standard's level.`,
          `Annotation rubric: score student annotations on specificity, accuracy, and quantity of evidence.`,
          `Running record of which graphic organizer supports are still being used vs. faded.`,
        ],
      },
      intervention: {
        reteachStrategies: [
          `Re-read a shorter, simpler text and model the strategy with a think-aloud before the grade-level text.`,
          `Use explicit vocabulary instruction (teach → practice → apply) for the 2–3 hardest words before any reading.`,
          `Break the standard into micro-skills: e.g., for inference start with single sentences before full paragraphs.`,
        ],
        simplifiedTasks: [
          `Annotate one paragraph (not the full passage) applying the modeled strategy.`,
          `Use a modeled writing frame with sentence starters; fill in the frame before writing independently.`,
          `Answer scaffolded questions that build toward the standard (literal → inferential → evaluative).`,
        ],
        guidedPracticeSupports: [
          `Teacher think-aloud through the first paragraph; student annotates the second with teacher nearby.`,
          `Small-group close reading: 3–5 students, teacher facilitates line-by-line discussion.`,
          `Check in with the intervention group every 4–5 minutes during independent practice.`,
        ],
      },
      advanced: {
        extensions: [
          `Compare the strategy across two texts: same standard, different genre — what changes? What stays?`,
          `Write a counter-argument response: take the opposing position and defend it with equal evidence.`,
          focus === "writing"
            ? `Revise their writing using a mentor text as a model — identify three specific craft moves to borrow.`
            : `Analyze the author's craft: how does structure, diction, or syntax reinforce the main idea?`,
        ],
        higherOrderQuestions: [
          `"How would this text read differently if told from a different point of view? What would change — and what would stay the same?"`,
          `"What assumptions does the author make about the reader? How do you know?"`,
          focus === "writing"
            ? `"What counter-argument has the author not addressed? Why might they have left it out?"`
            : `"Evaluate the strength of the author's evidence. Is it sufficient? What is missing?"`,
        ],
        independentChallenges: [
          `Independent research: find two sources that support or challenge the text's main claim; write a synthesis paragraph.`,
          `Prepare for a Socratic seminar: generate 3 evaluative discussion questions and locate evidence for each.`,
          `Mentor text study: analyze how a professional author applies the same standard — identify 5 specific techniques.`,
        ],
      },
    };
  }

  // Generic fallback for other subjects
  return {
    el: {
      languageObjective: `Students will use academic language to discuss and apply ${topic}.`,
      vocabularySupports: [
        `Pre-teach key vocabulary with visual aids and simple definitions.`,
        `Provide sentence examples for each key term.`,
      ],
      sentenceFrames: [
        `"I learned that ___ because ___.`,
        `"This connects to ___ because ___.`,
      ],
      oralLanguageSupports: [
        `Partner discussions with sentence starters before any written response.`,
        `Allow home-language discussion before producing English output.`,
      ],
      accessStrategies: [
        `Provide visual representations alongside text instructions.`,
        `Preview key concepts before the lesson when possible.`,
      ],
    },
    sped: {
      accommodations: [
        `Extended time for all tasks.`,
        `Provide written directions alongside oral instructions.`,
      ],
      modifications: [
        `Fewer problems or a shorter task with the same core concept.`,
        `Provide a partially completed template.`,
      ],
      scaffolds: [
        `Anchor chart visible during all work time.`,
        `Worked example for reference.`,
      ],
      processingSupports: [
        `Break tasks into smaller steps with teacher checkpoints.`,
        `Allow extra think time and oral responses.`,
      ],
    },
    idea: {
      accessConsiderations: [
        `Multiple representation formats per IEP requirements.`,
        `Flexible response modalities.`,
      ],
      universalDesignSupports: [
        `Digital materials with text-to-speech.`,
        `Multiple means of engagement and expression.`,
      ],
      progressMonitoringIdeas: [
        `Exit slip after each lesson.`,
        `Anecdotal observation notes during guided practice.`,
      ],
    },
    intervention: {
      reteachStrategies: [
        `Reteach prerequisite skills before the lesson concept.`,
        `Use explicit, step-by-step modeling in a small group.`,
      ],
      simplifiedTasks: [
        `Begin with simpler, single-step tasks before building complexity.`,
        `Use scaffolded materials with guided cues.`,
      ],
      guidedPracticeSupports: [
        `Frequent teacher check-ins during independent practice.`,
        `Small-group guided practice before releasing to independent work.`,
      ],
    },
    advanced: {
      extensions: [
        `Create an original application of today's concept.`,
        `Find a real-world connection and present it to the class.`,
      ],
      higherOrderQuestions: [
        `"How would this change if one variable was different?"`,
        `"Is this always true? How would you prove it?"`,
      ],
      independentChallenges: [
        `Open-ended project connecting today's skill to a broader context.`,
        `Peer teaching role with a structured explanation.`,
      ],
    },
  };
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
    assessmentQuestions: buildAssessmentQuestions(standard),
    exitTicket: buildExitTicket(standard),
    exitTicketQuestions: buildExitTicketQuestions(standard),
    teacherNotes: buildTeacherNotes(standard),
    studentSupports: buildStudentSupports(standard),
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

  const asStudentSupports = (v: unknown): StudentSupports | undefined => {
    if (!v || typeof v !== "object") return undefined;
    const raw = v as Record<string, unknown>;
    if (!raw.el && !raw.sped && !raw.intervention && !raw.advanced) return undefined;
    const asObj = (x: unknown): Record<string, unknown> =>
      x && typeof x === "object" ? (x as Record<string, unknown>) : {};
    const el = asObj(raw.el);
    const sped = asObj(raw.sped);
    const idea = asObj(raw.idea);
    const intervention = asObj(raw.intervention);
    const advanced = asObj(raw.advanced);
    return {
      el: {
        languageObjective: asString(el.languageObjective),
        vocabularySupports: asStringArray(el.vocabularySupports),
        sentenceFrames: asStringArray(el.sentenceFrames),
        oralLanguageSupports: asStringArray(el.oralLanguageSupports),
        accessStrategies: asStringArray(el.accessStrategies),
      },
      sped: {
        accommodations: asStringArray(sped.accommodations),
        modifications: asStringArray(sped.modifications),
        scaffolds: asStringArray(sped.scaffolds),
        processingSupports: asStringArray(sped.processingSupports),
      },
      idea: {
        accessConsiderations: asStringArray(idea.accessConsiderations),
        universalDesignSupports: asStringArray(idea.universalDesignSupports),
        progressMonitoringIdeas: asStringArray(idea.progressMonitoringIdeas),
      },
      intervention: {
        reteachStrategies: asStringArray(intervention.reteachStrategies),
        simplifiedTasks: asStringArray(intervention.simplifiedTasks),
        guidedPracticeSupports: asStringArray(intervention.guidedPracticeSupports),
      },
      advanced: {
        extensions: asStringArray(advanced.extensions),
        higherOrderQuestions: asStringArray(advanced.higherOrderQuestions),
        independentChallenges: asStringArray(advanced.independentChallenges),
      },
    };
  };

  const asQuestions = (v: unknown): LessonQuestion[] => {
    if (!Array.isArray(v)) return [];
    const out: LessonQuestion[] = [];
    for (const raw of v) {
      if (!raw || typeof raw !== "object") continue;
      const q = raw as Record<string, unknown>;
      const type = q.type;
      if (type !== "multiple_choice" && type !== "short_answer" && type !== "word_problem") continue;
      const question = asString(q.question);
      const answer = asString(q.answer);
      if (!question) continue;
      const choices = Array.isArray(q.choices)
        ? q.choices.filter((c): c is string => typeof c === "string")
        : undefined;
      out.push({ question, type, answer, ...(choices ? { choices } : {}) });
    }
    return out;
  };

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
    assessmentQuestions: asQuestions(p.assessmentQuestions),
    exitTicket: asString(p.exitTicket),
    exitTicketQuestions: asQuestions(p.exitTicketQuestions),
    teacherNotes: asString(p.teacherNotes),
    studentSupports: asStudentSupports(p.studentSupports),
  };
}

/**
 * Serialize a list of questions to a readable Markdown block. Answers are
 * included only when `includeAnswers` is true (teacher copy vs student copy).
 */
export function questionsToMarkdown(
  questions: LessonQuestion[],
  { includeAnswers = false, heading = "" }: { includeAnswers?: boolean; heading?: string } = {},
): string {
  if (!questions.length) return heading ? `## ${heading}\n\n_No questions generated._` : "";
  const out: string[] = [];
  if (heading) {
    out.push(`## ${heading}`);
    out.push("");
  }
  questions.forEach((q, i) => {
    out.push(`**${i + 1}.** (${q.type.replace("_", " ")}) ${q.question}`);
    if (q.choices?.length) {
      q.choices.forEach((c, j) => {
        const letter = String.fromCharCode(65 + j);
        out.push(`   ${letter}. ${c}`);
      });
    }
    if (includeAnswers) out.push(`   **Answer:** ${q.answer}`);
    out.push("");
  });
  return out.join("\n").trimEnd();
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
    questionsToMarkdown(plan.assessmentQuestions, { includeAnswers: true, heading: "Assessment Questions" }),
    ``,
    `## Exit Ticket`,
    plan.exitTicket,
    questionsToMarkdown(plan.exitTicketQuestions, { includeAnswers: true, heading: "Exit Ticket Questions" }),
    ``,
    `## Teacher Notes`,
    plan.teacherNotes,
  ]
    .filter((l) => l !== "")
    .join("\n");
}
