import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, Info, Loader2, Save, CheckCircle, Users, BookMarked } from "lucide-react";
import StandardsPicker from "./StandardsPicker";
import LessonPlanPreview from "./LessonPlanPreview";
import { getAllStandards } from "@/lib/standards";
import { generateLessonPlan } from "@/lib/lesson-builder";
import { apiGet, apiPost, apiPatch } from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";
import type { LessonPlan, StandardInput } from "@/types/lesson-plan";

interface Props {
  /** Optional hint used to pre-filter the standards picker (e.g. "Math"). */
  lessonSubject?: string;
  /** Pre-load a saved lesson plan (from the Lesson Library). */
  initialPlan?: LessonPlan;
  /** ID of the saved lesson being edited — passed when loading from library. */
  savedLessonId?: number;
}

type AnyStandard = Record<string, unknown> & { standard_code?: string; code?: string };

interface QueueStudent {
  student_id: number;
  student_name: string;
  assignment_id: number;
  kpis?: { intervention?: boolean };
}

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

/**
 * Map the standards-dataset subject value to the subject enum used throughout
 * the gradebook UI (CreateLessonModal, LessonRow, filters).
 */
function subjectForLesson(standardSubject: string): string {
  if (/ela|literacy|english/i.test(standardSubject)) return "English";
  if (/math/i.test(standardSubject)) return "Math";
  return standardSubject || "General";
}

export default function LessonBuilder({ lessonSubject = "", initialPlan, savedLessonId }: Props) {
  const { user } = useAuth();
  const canSave = user?.role === "admin" || user?.role === "academic_coach";

  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [plan, setPlan] = useState<LessonPlan | null>(initialPlan ?? null);
  const [allStandards, setAllStandards] = useState<AnyStandard[]>([]);
  const [loadingStandards, setLoadingStandards] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Assign-to-students save state
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
  const [dueAt, setDueAt] = useState<string>("");
  const [pointsPossible, setPointsPossible] = useState<string>("10");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // Save-to-library state
  const [libraryCurrentId, setLibraryCurrentId] = useState<number | undefined>(savedLessonId);
  const [savingLibrary, setSavingLibrary] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [librarySaved, setLibrarySaved] = useState(false);

  useEffect(() => {
    setLoadingStandards(true);
    getAllStandards()
      .then((data: AnyStandard[]) => setAllStandards(data))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoadingStandards(false));
  }, []);

  // Fetch assignable students for admins / academic coaches
  const { data: queueData, isLoading: queueLoading } = useQuery({
    queryKey: ["coach-queue", user?.id],
    queryFn: () => apiGet("/gradebook/queue"),
    enabled: !!canSave && !!plan,
  });
  const queue: QueueStudent[] = queueData?.queue ?? [];

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
    setSaveSuccess(null);
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
  };

  const handleReset = () => {
    setPlan(null);
    setSelectedStudentIds([]);
    setSaveError(null);
    setSaveSuccess(null);
    setLibraryCurrentId(undefined);
    setLibraryError(null);
    setLibrarySaved(false);
  };

  // Pre-select the standard from an initialPlan so the picker reflects it
  useEffect(() => {
    if (initialPlan?.standardCode) {
      setSelectedCodes([initialPlan.standardCode]);
    }
  }, [initialPlan]);

  const handleSaveToLibrary = async () => {
    if (!plan) return;
    setSavingLibrary(true);
    setLibraryError(null);
    setLibrarySaved(false);
    try {
      const payload = {
        title: plan.title,
        subject: subjectForLesson(plan.subject),
        grade: plan.grade || "",
        standardCode: plan.standardCode || null,
        standardText: plan.standardText || null,
        planData: JSON.stringify(plan),
      };
      if (libraryCurrentId) {
        await apiPatch(`/saved-lessons/${libraryCurrentId}`, payload);
      } else {
        const res = await apiPost("/saved-lessons", payload);
        if (res?.lesson?.id) setLibraryCurrentId(res.lesson.id);
      }
      setLibrarySaved(true);
      setTimeout(() => setLibrarySaved(false), 3000);
    } catch (err) {
      setLibraryError((err as Error).message || "Failed to save to library.");
    } finally {
      setSavingLibrary(false);
    }
  };

  const toggleStudent = (id: number) =>
    setSelectedStudentIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );

  const handleSave = async () => {
    if (!plan) return;
    if (selectedStudentIds.length === 0) {
      setSaveError("Pick at least one student to assign this lesson to.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);
    try {
      const payload = {
        title: plan.title,
        subject: subjectForLesson(plan.subject),
        // Full lesson plan JSON lives in `instructions` so the lesson detail
        // panel / future renderer can rehydrate every section. Grade is not a
        // schema column, so it rides along inside this JSON blob.
        instructions: JSON.stringify(plan),
        standards_codes: [plan.standardCode],
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
        points_possible: Number(pointsPossible) || 10,
        student_ids: selectedStudentIds,
      };
      const res = await apiPost("/gradebook/lessons", payload);
      const count = Array.isArray(res?.lessons) ? res.lessons.length : selectedStudentIds.length;
      setSaveSuccess(
        `Saved lesson plan to ${count} student${count === 1 ? "" : "s"}.`,
      );
      setSelectedStudentIds([]);
    } catch (err) {
      setSaveError((err as Error).message || "Failed to save lesson.");
    } finally {
      setSaving(false);
    }
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
      <StandardsPicker
        lessonSubject={lessonSubject}
        value={selectedCodes}
        onChange={setSelectedCodes}
      />

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

      {plan && (
        <LessonPlanPreview plan={plan} onChange={setPlan} onReset={handleReset} />
      )}

      {canSave && (
        <div className="border border-slate-200 rounded-xl bg-white p-4 space-y-3">
          {!plan ? (
            <p className="text-sm text-slate-400 text-center py-3">
              Generate a lesson plan above to save it to your library or assign it to students.
            </p>
          ) : (
            <>
              {/* ── Save to Library ─────────────────────────────────────────── */}
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2 text-[#1a3c5e]">
                  <BookMarked className="w-4 h-4" />
                  <div>
                    <h3 className="font-semibold text-sm">Lesson Library</h3>
                    <p className="text-xs text-slate-500">Save as a reusable template for future use</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {librarySaved && (
                    <span className="inline-flex items-center gap-1 text-xs text-green-700 font-medium">
                      <CheckCircle className="w-3.5 h-3.5" /> Saved!
                    </span>
                  )}
                  {libraryError && (
                    <span className="text-xs text-red-600">{libraryError}</span>
                  )}
                  <button
                    type="button"
                    onClick={handleSaveToLibrary}
                    disabled={savingLibrary}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg border border-[#1a3c5e] text-[#1a3c5e] hover:bg-[#1a3c5e]/5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingLibrary ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                    ) : libraryCurrentId ? (
                      <><BookMarked className="w-4 h-4" /> Update in Library</>
                    ) : (
                      <><BookMarked className="w-4 h-4" /> Save to Library</>
                    )}
                  </button>
                </div>
              </div>

              {/* ── Assign to Students ──────────────────────────────────────── */}
              <div className="flex items-center gap-2 text-[#1a3c5e]">
                <Users className="w-4 h-4" />
                <h3 className="font-semibold text-sm">Assign to Students</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                    Due Date (optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={dueAt}
                    onChange={(e) => setDueAt(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                    Points Possible
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={pointsPossible}
                    onChange={(e) => setPointsPossible(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Assign to ({selectedStudentIds.length} selected)
                </label>
                {queueLoading ? (
                  <p className="text-xs text-slate-400 py-2">Loading students…</p>
                ) : queue.length === 0 ? (
                  <p className="text-xs text-slate-400 py-2">
                    No students assigned to you. Ask an admin to link students
                    to your coach profile.
                  </p>
                ) : (
                  <div className="max-h-44 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                    {queue.map((s) => (
                      <label
                        key={s.student_id}
                        className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={selectedStudentIds.includes(s.student_id)}
                          onChange={() => toggleStudent(s.student_id)}
                          className="rounded"
                        />
                        <span className="text-sm text-slate-800 flex-1">
                          {s.student_name}
                        </span>
                        {s.kpis?.intervention && (
                          <span className="text-[10px] font-semibold text-red-600">
                            ⚠ Intervention
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {saveError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
                  {saveError}
                </div>
              )}
              {saveSuccess && (
                <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-3 py-2 text-sm flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  {saveSuccess}
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || selectedStudentIds.length === 0 || queue.length === 0}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg bg-[#1a3c5e] text-white hover:bg-[#0d2540] disabled:bg-slate-300 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Saving…
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" /> Save Lesson
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
