import { useEffect, useMemo, useState } from "react";
import { Sparkles, Info, Loader2 } from "lucide-react";
import StandardsPicker from "./StandardsPicker";
import LessonPlanPreview from "./LessonPlanPreview";
import { getAllStandards } from "@/lib/standards";
import { generateLessonPlan } from "@/lib/lesson-builder";
import type { LessonPlan, StandardInput } from "@/types/lesson-plan";

interface Props {
  /** Optional hint used to pre-filter the standards picker (e.g. "Math"). */
  lessonSubject?: string;
}

type AnyStandard = Record<string, unknown> & { standard_code?: string; code?: string };

function toStandardInput(raw: AnyStandard): StandardInput {
  const standard_code = String(raw.standard_code ?? raw.code ?? "");
  return {
    standard_code,
    standard_text: String(raw.standard_text ?? raw.text ?? ""),
    subject: String(raw.subject ?? ""),
    grade: String(raw.grade ?? ""),
    domain: String(raw.domain ?? ""),
    cluster: String(raw.cluster ?? ""),
    short_code: raw.short_code as string | undefined,
    level: raw.level as string | undefined,
    course: (raw.course as string | null | undefined) ?? null,
  };
}

export default function LessonBuilder({ lessonSubject = "" }: Props) {
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [plan, setPlan] = useState<LessonPlan | null>(null);
  const [allStandards, setAllStandards] = useState<AnyStandard[]>([]);
  const [loadingStandards, setLoadingStandards] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load standards once so we can resolve a selected code into its full record.
  useEffect(() => {
    setLoadingStandards(true);
    getAllStandards()
      .then((data: AnyStandard[]) => setAllStandards(data))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoadingStandards(false));
  }, []);

  const selectedStandard = useMemo<StandardInput | null>(() => {
    if (selectedCodes.length !== 1) return null;
    const code = selectedCodes[0];
    const raw = allStandards.find(
      (s) => s.standard_code === code || s.code === code,
    );
    if (!raw) return null;
    return toStandardInput(raw);
  }, [selectedCodes, allStandards]);

  const canGenerate = selectedCodes.length === 1 && !!selectedStandard;

  const handleGenerate = () => {
    if (!selectedStandard) return;
    setGenerating(true);
    setError(null);
    try {
      // Synchronous, but give the UI a tick so the spinner can flash briefly
      // and React can unmount any stale preview before we mount a fresh one.
      setPlan(null);
      setTimeout(() => {
        try {
          const next = generateLessonPlan(selectedStandard);
          setPlan(next);
        } catch (err) {
          setError((err as Error).message || "Failed to generate lesson plan.");
        } finally {
          setGenerating(false);
        }
      }, 50);
    } catch (err) {
      setError((err as Error).message || "Failed to generate lesson plan.");
      setGenerating(false);
    }
  };

  const handleReset = () => {
    setPlan(null);
  };

  const helperText = (() => {
    if (selectedCodes.length === 0)
      return "Pick exactly one standard above to build a lesson plan.";
    if (selectedCodes.length > 1)
      return `You've selected ${selectedCodes.length} standards. The builder uses one standard — remove extras to continue.`;
    if (loadingStandards) return "Loading standard details…";
    if (!selectedStandard)
      return "Standard details are still loading — try again in a moment.";
    return "Ready to generate a lesson plan from this standard.";
  })();

  return (
    <div className="space-y-4">
      {/* Standards selector */}
      <StandardsPicker
        lessonSubject={lessonSubject}
        value={selectedCodes}
        onChange={setSelectedCodes}
      />

      {/* Inline Create-Lesson-Plan action */}
      <div className="border border-slate-200 rounded-xl bg-white p-4 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-xs text-slate-500 flex-1 min-w-[180px]">
          <Info className="w-4 h-4 text-slate-400 shrink-0" />
          <span>{helperText}</span>
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!canGenerate || generating}
          className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg bg-[#1a3c5e] text-white hover:bg-[#0d2540] disabled:bg-slate-300 disabled:cursor-not-allowed"
        >
          {generating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Generating…
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              {plan ? "Regenerate Lesson Plan" : "Create Lesson Plan"}
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Editable preview */}
      {plan && (
        <LessonPlanPreview plan={plan} onChange={setPlan} onReset={handleReset} />
      )}
    </div>
  );
}
