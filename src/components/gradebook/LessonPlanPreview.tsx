import { useState } from "react";
import {
  BookOpen,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Plus,
  X,
} from "lucide-react";
import type { LessonPlan } from "@/types/lesson-plan";
import { lessonPlanToMarkdown } from "@/lib/lesson-builder";

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
  const [copied, setCopied] = useState(false);

  const update = <K extends keyof LessonPlan>(key: K, value: LessonPlan[K]) => {
    onChange({ ...plan, [key]: value });
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(lessonPlanToMarkdown(plan));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // no-op — clipboard unavailable in some contexts
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-[#1a3c5e]">
          <BookOpen className="w-5 h-5" />
          <h3 className="font-bold text-base">Generated Lesson Plan</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-green-600" /> Copied
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" /> Copy
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
        <textarea
          className={textareaCls}
          value={plan.assessment}
          onChange={(e) => update("assessment", e.target.value)}
        />
      </Section>

      <Section title="Exit Ticket">
        <textarea
          className={textareaCls}
          value={plan.exitTicket}
          onChange={(e) => update("exitTicket", e.target.value)}
        />
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
