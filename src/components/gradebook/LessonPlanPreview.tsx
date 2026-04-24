import { useState } from "react";
import {
  BookOpen,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Plus,
  Sparkles,
  X,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";
import type { LessonPlan, LessonQuestion, QuestionType, StudentSupports } from "@/types/lesson-plan";
import { lessonPlanToMarkdown, questionsToMarkdown } from "@/lib/lesson-builder";
import { apiPost } from "@/api/apiClient";
import { mergeAIEnhancedSupports } from "@/lib/lesson-ai-ready";

interface Props {
  plan: LessonPlan;
  onChange: (next: LessonPlan) => void;
  onReset?: () => void;
}

function gradeLabel(g: string): string {
  if (!g) return "";
  if (g === "K") return "Kindergarten";
  if (g === "HS") return "High School";
  if (g === "K-12") return "K–12";
  return `Grade ${g}`;
}

const inputCls =
  "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30";
const textareaCls = `${inputCls} min-h-[90px] resize-y leading-relaxed`;

function EditableList({
  items,
  onChange,
  placeholder,
}: {
  items: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex gap-2 items-start">
          <textarea
            className={`${inputCls} min-h-[42px] resize-y`}
            value={item}
            onChange={(e) =>
              onChange(items.map((it, j) => (j === i ? e.target.value : it)))
            }
            rows={1}
          />
          <button
            type="button"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            className="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 shrink-0"
            title="Remove"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, ""])}
        className="inline-flex items-center gap-1 text-xs font-semibold text-[#1a3c5e] hover:text-blue-700"
      >
        <Plus className="w-3.5 h-3.5" />
        {placeholder}
      </button>
    </div>
  );
}

const QUESTION_TYPES: QuestionType[] = [
  "word_problem",
  "multiple_choice",
  "short_answer",
];

function QuestionEditor({
  question,
  index,
  showAnswers,
  onChange,
  onRemove,
}: {
  question: LessonQuestion;
  index: number;
  showAnswers: boolean;
  onChange: (next: LessonQuestion) => void;
  onRemove: () => void;
}) {
  const update = <K extends keyof LessonQuestion>(key: K, value: LessonQuestion[K]) =>
    onChange({ ...question, [key]: value });

  return (
    <div className="border border-slate-200 rounded-xl p-3 space-y-2 bg-white">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-[#1a3c5e]">
          Question {index + 1}
        </span>
        <div className="flex items-center gap-2">
          <select
            value={question.type}
            onChange={(e) => {
              const nextType = e.target.value as QuestionType;
              if (nextType === "multiple_choice" && !question.choices?.length) {
                onChange({ ...question, type: nextType, choices: ["", "", "", ""] });
              } else if (nextType !== "multiple_choice") {
                const { choices: _drop, ...rest } = question;
                onChange({ ...rest, type: nextType });
              } else {
                update("type", nextType);
              }
            }}
            className="text-[11px] font-medium border border-slate-200 rounded-md px-2 py-0.5 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-[#1a3c5e]/30"
          >
            {QUESTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace("_", " ")}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onRemove}
            className="p-1 text-slate-400 hover:text-red-500 rounded hover:bg-red-50"
            title="Remove question"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <textarea
        className={`${inputCls} min-h-[60px] resize-y`}
        value={question.question}
        onChange={(e) => update("question", e.target.value)}
        placeholder="Question prompt…"
      />

      {question.type === "multiple_choice" && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
            Choices
          </p>
          {(question.choices ?? []).map((choice, i) => (
            <div key={i} className="flex gap-2 items-start">
              <span className="text-xs font-mono font-bold text-slate-400 mt-2 w-4 shrink-0">
                {String.fromCharCode(65 + i)}.
              </span>
              <input
                className={inputCls}
                value={choice}
                onChange={(e) =>
                  update(
                    "choices",
                    (question.choices ?? []).map((c, j) => (j === i ? e.target.value : c)),
                  )
                }
              />
              <button
                type="button"
                onClick={() =>
                  update("choices", (question.choices ?? []).filter((_, j) => j !== i))
                }
                className="p-1.5 text-slate-400 hover:text-red-500 rounded hover:bg-red-50 shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => update("choices", [...(question.choices ?? []), ""])}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1a3c5e] hover:text-blue-700"
          >
            <Plus className="w-3 h-3" /> Add choice
          </button>
        </div>
      )}

      {showAnswers ? (
        <div>
          <p className="text-[11px] font-semibold text-green-700 uppercase tracking-wide mb-1">
            Answer / Rubric
          </p>
          <textarea
            className={`${inputCls} min-h-[44px] resize-y border-green-200 bg-green-50/30`}
            value={question.answer}
            onChange={(e) => update("answer", e.target.value)}
          />
        </div>
      ) : (
        <p className="text-[11px] text-slate-400 italic">
          Answer hidden — toggle "Show Answers" to edit.
        </p>
      )}
    </div>
  );
}

function QuestionList({
  questions,
  showAnswers,
  onChange,
}: {
  questions: LessonQuestion[];
  showAnswers: boolean;
  onChange: (next: LessonQuestion[]) => void;
}) {
  const emptyQuestion = (): LessonQuestion => ({
    question: "",
    type: "short_answer",
    answer: "",
  });
  return (
    <div className="space-y-2">
      {questions.length === 0 && (
        <p className="text-sm text-slate-400 italic">No questions yet.</p>
      )}
      {questions.map((q, i) => (
        <QuestionEditor
          key={i}
          question={q}
          index={i}
          showAnswers={showAnswers}
          onChange={(next) => onChange(questions.map((x, j) => (j === i ? next : x)))}
          onRemove={() => onChange(questions.filter((_, j) => j !== i))}
        />
      ))}
      <button
        type="button"
        onClick={() => onChange([...questions, emptyQuestion()])}
        className="inline-flex items-center gap-1 text-xs font-semibold text-[#1a3c5e] hover:text-blue-700"
      >
        <Plus className="w-3.5 h-3.5" /> Add question
      </button>
    </div>
  );
}

type SupportField =
  | { key: string; label: string; type: "text" }
  | { key: string; label: string; type: "list"; addLabel: string };

function SupportBlock({
  label,
  badge,
  fields,
  data,
  onChange,
  copyKey,
  copied,
  onCopy,
  supportType,
  onAIEnhance,
  aiLoading,
  aiError,
}: {
  label: string;
  badge: string;
  fields: SupportField[];
  data: Record<string, string | string[]>;
  onChange: (next: Record<string, string | string[]>) => void;
  copyKey: string;
  copied: string | null;
  onCopy: (text: string, key: string) => void;
  supportType: keyof StudentSupports;
  onAIEnhance: (type: keyof StudentSupports) => Promise<void>;
  aiLoading: boolean;
  aiError: string | null;
}) {
  const [open, setOpen] = useState(false);

  const buildText = (): string => {
    const lines: string[] = [`## ${label}`, ""];
    for (const f of fields) {
      const v = data[f.key];
      lines.push(`### ${f.label}`);
      if (typeof v === "string") {
        if (v) lines.push(v);
      } else if (Array.isArray(v)) {
        for (const it of v as string[]) lines.push(`- ${it}`);
      }
      lines.push("");
    }
    return lines.join("\n").trimEnd();
  };

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-slate-50">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
        >
          <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${badge}`}>
            {label}
          </span>
          {open
            ? <ChevronUp className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            : <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
        </button>
        <button
          type="button"
          onClick={() => onCopy(buildText(), copyKey)}
          className="ml-2 shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-[#1a3c5e]"
          title={`Copy ${label} supports`}
        >
          {copied === copyKey
            ? <><Check className="w-3 h-3 text-green-600" /> Copied</>
            : <Copy className="w-3 h-3" />}
        </button>
      </div>
      {open && (
        <div className="p-3 space-y-3">
          {fields.map((f) => {
            const value = data[f.key] ?? (f.type === "list" ? [] : "");
            return (
              <div key={f.key}>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  {f.label}
                </p>
                {f.type === "text" ? (
                  <textarea
                    className={textareaCls}
                    value={typeof value === "string" ? value : ""}
                    onChange={(e) => onChange({ ...data, [f.key]: e.target.value })}
                  />
                ) : (
                  <EditableList
                    items={Array.isArray(value) ? (value as string[]) : []}
                    onChange={(next) => onChange({ ...data, [f.key]: next })}
                    placeholder={f.addLabel}
                  />
                )}
              </div>
            );
          })}

          <div className="pt-2 border-t border-slate-100 space-y-2">
            <button
              type="button"
              onClick={() => onAIEnhance(supportType)}
              disabled={aiLoading}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-dashed border-slate-300 text-slate-500 hover:border-[#1a3c5e] hover:text-[#1a3c5e] hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-wait"
            >
              {aiLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Improving with AI…
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Improve {label} with AI
                </>
              )}
            </button>
            {aiError && (
              <p className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 leading-snug">
                {aiError}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-left"
      >
        <span className="text-sm font-semibold text-[#1a3c5e]">{title}</span>
        {open ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>
      {open && <div className="p-4 space-y-2">{children}</div>}
    </div>
  );
}

export default function LessonPlanPreview({ plan, onChange, onReset }: Props) {
  const [copied, setCopied] = useState<string | null>(null);
  const [showAnswers, setShowAnswers] = useState(false);
  const [aiLoadingType, setAiLoadingType] = useState<keyof StudentSupports | null>(null);
  const [aiError, setAiError] = useState<{ type: keyof StudentSupports; message: string } | null>(null);
  const [aiSuccess, setAiSuccess] = useState<string | null>(null);

  const update = <K extends keyof LessonPlan>(key: K, value: LessonPlan[K]) => {
    onChange({ ...plan, [key]: value });
  };

  const handleAIEnhance = async (supportType: keyof StudentSupports) => {
    setAiLoadingType(supportType);
    setAiError(null);
    setAiSuccess(null);
    try {
      const selectedStandard = {
        standard_code: plan.standardCode,
        standard_text: plan.standardText,
        subject: plan.subject,
        grade: plan.grade,
        domain: plan.domain,
        cluster: plan.cluster,
      };
      const res = await apiPost("/lesson-ai/enhance-supports", {
        lessonPlan: plan,
        selectedStandard,
        supportType,
      });
      if (!res?.enhancedSupports) {
        throw new Error("No enhancement data returned from server.");
      }
      const merged = mergeAIEnhancedSupports(plan, {
        [supportType]: res.enhancedSupports,
      });
      onChange(merged);
      setAiSuccess(`${supportType.toUpperCase()} supports enhanced. Review and edit below, then save.`);
      setTimeout(() => setAiSuccess(null), 6000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Enhancement failed. Please try again.";
      console.error("[lesson-ai] enhance-supports error:", message, err);
      setAiError({ type: supportType, message });
    } finally {
      setAiLoadingType(null);
    }
  };

  const copyText = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 2000);
    } catch {
      // clipboard unavailable in some contexts
    }
  };

  const handleCopyFull = () => copyText(lessonPlanToMarkdown(plan), "full");
  const handleCopyAssessment = () =>
    copyText(
      questionsToMarkdown(plan.assessmentQuestions, {
        includeAnswers: showAnswers,
        heading: "Assessment Questions",
      }),
      "assessment",
    );
  const handleCopyExitTicket = () =>
    copyText(
      questionsToMarkdown(plan.exitTicketQuestions, {
        includeAnswers: showAnswers,
        heading: "Exit Ticket",
      }),
      "exit",
    );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-[#1a3c5e]">
          <BookOpen className="w-5 h-5" />
          <h3 className="font-bold text-base">Generated Lesson Plan</h3>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowAnswers((v) => !v)}
            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border ${
              showAnswers
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
            title="Toggle answer visibility for assessment and exit ticket questions"
          >
            {showAnswers ? (
              <>
                <EyeOff className="w-3.5 h-3.5" /> Hide Answers
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5" /> Show Answers
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleCopyFull}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            {copied === "full" ? (
              <>
                <Check className="w-3.5 h-3.5 text-green-600" /> Copied
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" /> Copy Full Plan
              </>
            )}
          </button>
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              Start Over
            </button>
          )}
        </div>
      </div>

      {/* AI global status banner */}
      {aiLoadingType && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 text-sm text-blue-800">
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          Enhancing <strong className="capitalize">{aiLoadingType}</strong> supports with AI…
        </div>
      )}
      {aiSuccess && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 text-sm text-green-800">
          <Check className="w-4 h-4 shrink-0" />
          {aiSuccess}
        </div>
      )}
      {aiError && (
        <div className="flex items-center justify-between gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm text-red-700">
          <span><strong>AI enhancement failed:</strong> {aiError.message}</span>
          <button type="button" onClick={() => setAiError(null)} className="shrink-0 text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Title + Standard reference */}
      <Section title="Lesson Title & Standard" defaultOpen={true}>
        <label className="block">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Lesson Title
          </span>
          <input
            className={inputCls}
            value={plan.title}
            onChange={(e) => update("title", e.target.value)}
          />
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
              Subject
            </p>
            <p className="text-slate-800">{plan.subject}</p>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
              Grade
            </p>
            <p className="text-slate-800">{gradeLabel(plan.grade)}</p>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
              Standard
            </p>
            <p className="text-slate-800 font-mono text-xs break-all">
              {plan.standardCode}
            </p>
          </div>
        </div>
        <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-slate-700 leading-snug">
          <span className="font-semibold text-[#1a3c5e]">
            {plan.domain}
            {plan.cluster ? ` · ${plan.cluster}` : ""}
          </span>
          <p className="mt-1">{plan.standardText}</p>
        </div>
      </Section>

      <Section title="Learning Objective">
        <textarea
          className={textareaCls}
          value={plan.objective}
          onChange={(e) => update("objective", e.target.value)}
        />
      </Section>

      <Section title="Success Criteria">
        <EditableList
          items={plan.successCriteria}
          onChange={(next) => update("successCriteria", next)}
          placeholder="Add success criterion"
        />
      </Section>

      <Section title="Academic Vocabulary">
        <EditableList
          items={plan.vocabulary}
          onChange={(next) => update("vocabulary", next)}
          placeholder="Add vocabulary term"
        />
      </Section>

      <Section title="Materials">
        <EditableList
          items={plan.materials}
          onChange={(next) => update("materials", next)}
          placeholder="Add material"
        />
      </Section>

      <Section title="Warm-Up / Hook">
        <textarea
          className={textareaCls}
          value={plan.warmUp}
          onChange={(e) => update("warmUp", e.target.value)}
        />
      </Section>

      <Section title="Direct Instruction">
        <textarea
          className={textareaCls}
          value={plan.directInstruction}
          onChange={(e) => update("directInstruction", e.target.value)}
        />
      </Section>

      <Section title="Guided Practice">
        <textarea
          className={textareaCls}
          value={plan.guidedPractice}
          onChange={(e) => update("guidedPractice", e.target.value)}
        />
      </Section>

      <Section title="Independent Practice">
        <textarea
          className={textareaCls}
          value={plan.independentPractice}
          onChange={(e) => update("independentPractice", e.target.value)}
        />
      </Section>

      <Section title="Differentiation (ELL / SPED / Advanced)">
        <textarea
          className={`${textareaCls} min-h-[140px]`}
          value={plan.differentiation}
          onChange={(e) => update("differentiation", e.target.value)}
        />
      </Section>

      <Section title="Checks for Understanding">
        <EditableList
          items={plan.checksForUnderstanding}
          onChange={(next) => update("checksForUnderstanding", next)}
          placeholder="Add check"
        />
      </Section>

      <Section title="Assessment">
        <label className="block">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Assessment overview
          </span>
          <textarea
            className={textareaCls}
            value={plan.assessment}
            onChange={(e) => update("assessment", e.target.value)}
          />
        </label>

        <div className="flex items-center justify-between mt-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Assessment questions ({plan.assessmentQuestions.length})
          </p>
          <button
            type="button"
            onClick={handleCopyAssessment}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-[#1a3c5e]"
          >
            {copied === "assessment" ? (
              <>
                <Check className="w-3 h-3 text-green-600" /> Copied
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" /> Copy assessment
                {showAnswers ? " (with answers)" : ""}
              </>
            )}
          </button>
        </div>
        <QuestionList
          questions={plan.assessmentQuestions}
          showAnswers={showAnswers}
          onChange={(next) => update("assessmentQuestions", next)}
        />
      </Section>

      <Section title="Exit Ticket">
        <label className="block">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Exit ticket overview
          </span>
          <textarea
            className={textareaCls}
            value={plan.exitTicket}
            onChange={(e) => update("exitTicket", e.target.value)}
          />
        </label>

        <div className="flex items-center justify-between mt-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Exit ticket questions ({plan.exitTicketQuestions.length})
          </p>
          <button
            type="button"
            onClick={handleCopyExitTicket}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-[#1a3c5e]"
          >
            {copied === "exit" ? (
              <>
                <Check className="w-3 h-3 text-green-600" /> Copied
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" /> Copy exit ticket
                {showAnswers ? " (with answers)" : ""}
              </>
            )}
          </button>
        </div>
        <QuestionList
          questions={plan.exitTicketQuestions}
          showAnswers={showAnswers}
          onChange={(next) => update("exitTicketQuestions", next)}
        />
      </Section>

      <Section title="Student Supports" defaultOpen={false}>
        {!plan.studentSupports ? (
          <p className="text-sm text-slate-400 italic">
            Student supports are included in lesson plans generated with the current version.
          </p>
        ) : (
          <div className="space-y-2">
            <SupportBlock
              label="EL / ELL"
              badge="bg-purple-100 text-purple-800"
              fields={[
                { key: "languageObjective", label: "Language Objective", type: "text" },
                { key: "vocabularySupports", label: "Vocabulary Supports", type: "list", addLabel: "Add vocabulary support" },
                { key: "sentenceFrames", label: "Sentence Frames", type: "list", addLabel: "Add sentence frame" },
                { key: "oralLanguageSupports", label: "Oral Language Supports", type: "list", addLabel: "Add oral support" },
                { key: "accessStrategies", label: "Access Strategies", type: "list", addLabel: "Add access strategy" },
              ]}
              data={plan.studentSupports.el as unknown as Record<string, string | string[]>}
              onChange={(next) =>
                update("studentSupports", {
                  ...plan.studentSupports!,
                  el: next as unknown as StudentSupports["el"],
                })
              }
              copyKey="supports-el"
              copied={copied}
              onCopy={copyText}
              supportType="el"
              onAIEnhance={handleAIEnhance}
              aiLoading={aiLoadingType === "el"}
              aiError={aiError?.type === "el" ? aiError.message : null}
            />
            <SupportBlock
              label="SPED / 504"
              badge="bg-blue-100 text-blue-800"
              fields={[
                { key: "accommodations", label: "Accommodations", type: "list", addLabel: "Add accommodation" },
                { key: "modifications", label: "Modifications", type: "list", addLabel: "Add modification" },
                { key: "scaffolds", label: "Scaffolds", type: "list", addLabel: "Add scaffold" },
                { key: "processingSupports", label: "Processing Supports", type: "list", addLabel: "Add processing support" },
              ]}
              data={plan.studentSupports.sped as unknown as Record<string, string | string[]>}
              onChange={(next) =>
                update("studentSupports", {
                  ...plan.studentSupports!,
                  sped: next as unknown as StudentSupports["sped"],
                })
              }
              copyKey="supports-sped"
              copied={copied}
              onCopy={copyText}
              supportType="sped"
              onAIEnhance={handleAIEnhance}
              aiLoading={aiLoadingType === "sped"}
              aiError={aiError?.type === "sped" ? aiError.message : null}
            />
            <SupportBlock
              label="IDEA Access"
              badge="bg-teal-100 text-teal-800"
              fields={[
                { key: "accessConsiderations", label: "Access Considerations", type: "list", addLabel: "Add consideration" },
                { key: "universalDesignSupports", label: "UDL Supports", type: "list", addLabel: "Add UDL support" },
                { key: "progressMonitoringIdeas", label: "Progress Monitoring", type: "list", addLabel: "Add monitoring idea" },
              ]}
              data={plan.studentSupports.idea as unknown as Record<string, string | string[]>}
              onChange={(next) =>
                update("studentSupports", {
                  ...plan.studentSupports!,
                  idea: next as unknown as StudentSupports["idea"],
                })
              }
              copyKey="supports-idea"
              copied={copied}
              onCopy={copyText}
              supportType="idea"
              onAIEnhance={handleAIEnhance}
              aiLoading={aiLoadingType === "idea"}
              aiError={aiError?.type === "idea" ? aiError.message : null}
            />
            <SupportBlock
              label="Intervention"
              badge="bg-amber-100 text-amber-800"
              fields={[
                { key: "reteachStrategies", label: "Reteach Strategies", type: "list", addLabel: "Add reteach strategy" },
                { key: "simplifiedTasks", label: "Simplified Tasks", type: "list", addLabel: "Add simplified task" },
                { key: "guidedPracticeSupports", label: "Guided Practice Supports", type: "list", addLabel: "Add guided practice support" },
              ]}
              data={plan.studentSupports.intervention as unknown as Record<string, string | string[]>}
              onChange={(next) =>
                update("studentSupports", {
                  ...plan.studentSupports!,
                  intervention: next as unknown as StudentSupports["intervention"],
                })
              }
              copyKey="supports-intervention"
              copied={copied}
              onCopy={copyText}
              supportType="intervention"
              onAIEnhance={handleAIEnhance}
              aiLoading={aiLoadingType === "intervention"}
              aiError={aiError?.type === "intervention" ? aiError.message : null}
            />
            <SupportBlock
              label="Advanced Learners"
              badge="bg-emerald-100 text-emerald-800"
              fields={[
                { key: "extensions", label: "Extensions", type: "list", addLabel: "Add extension" },
                { key: "higherOrderQuestions", label: "Higher-Order Questions", type: "list", addLabel: "Add question" },
                { key: "independentChallenges", label: "Independent Challenges", type: "list", addLabel: "Add challenge" },
              ]}
              data={plan.studentSupports.advanced as unknown as Record<string, string | string[]>}
              onChange={(next) =>
                update("studentSupports", {
                  ...plan.studentSupports!,
                  advanced: next as unknown as StudentSupports["advanced"],
                })
              }
              copyKey="supports-advanced"
              copied={copied}
              onCopy={copyText}
              supportType="advanced"
              onAIEnhance={handleAIEnhance}
              aiLoading={aiLoadingType === "advanced"}
              aiError={aiError?.type === "advanced" ? aiError.message : null}
            />
          </div>
        )}
      </Section>

      <Section title="Teacher Notes" defaultOpen={false}>
        <textarea
          className={`${textareaCls} min-h-[120px]`}
          value={plan.teacherNotes}
          onChange={(e) => update("teacherNotes", e.target.value)}
        />
      </Section>
    </div>
  );
}
