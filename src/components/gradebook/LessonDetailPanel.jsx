import { useState, useEffect, useMemo } from "react";
import { apiPatch } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { X, CheckCircle, Circle, Loader2, BookMarked, Sparkles } from "lucide-react";
import LessonStatusBadge from "./LessonStatusBadge";
import { format } from "date-fns";
import { useAuth } from "@/lib/AuthContext";
import { getAllStandards } from "@/lib/standards";
import { parseLessonPlanInstructions } from "@/lib/lesson-builder";

function shortCode(code) {
  return code
    .replace(/^CCSS\.(Math\.Content|Math\.Practice|ELA-Literacy)\./, "")
    .replace(/^CCSS\./, "");
}

function PlanSection({ title, children }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
        {title}
      </p>
      <div className="text-sm text-slate-700 leading-relaxed">{children}</div>
    </div>
  );
}

function PlanList({ items }) {
  if (!items?.length) return <p className="text-sm text-slate-400 italic">—</p>;
  return (
    <ul className="list-disc list-inside space-y-0.5 text-sm text-slate-700 marker:text-slate-400">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  );
}

function PlanBody({ text }) {
  if (!text?.trim()) return <p className="text-sm text-slate-400 italic">—</p>;
  return <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{text}</p>;
}

function QuestionBlock({ questions, showAnswers }) {
  if (!questions?.length) return <p className="text-sm text-slate-400 italic">—</p>;
  return (
    <ol className="space-y-3 list-none pl-0">
      {questions.map((q, i) => (
        <li key={i} className="border border-slate-200 rounded-lg bg-white px-3 py-2.5">
          <div className="flex items-start gap-2">
            <span className="text-xs font-semibold text-slate-400 shrink-0 mt-0.5">
              {i + 1}.
            </span>
            <div className="flex-1 min-w-0 space-y-1.5">
              <p className="text-sm text-slate-800 leading-snug">{q.question}</p>
              <span className="inline-block text-[10px] font-semibold uppercase tracking-wide text-slate-500 bg-slate-100 rounded px-1.5 py-0.5">
                {q.type.replace("_", " ")}
              </span>
              {q.type === "multiple_choice" && q.choices?.length > 0 && (
                <ul className="mt-1 space-y-0.5">
                  {q.choices.map((c, j) => (
                    <li key={j} className="text-sm text-slate-700 flex gap-2">
                      <span className="font-mono text-slate-400 shrink-0">
                        {String.fromCharCode(65 + j)}.
                      </span>
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              )}
              {showAnswers && q.answer && (
                <div className="mt-1.5 bg-green-50 border border-green-200 rounded px-2 py-1">
                  <p className="text-[10px] font-semibold text-green-700 uppercase tracking-wide">
                    Answer / Rubric
                  </p>
                  <p className="text-xs text-green-900 mt-0.5 whitespace-pre-wrap">{q.answer}</p>
                </div>
              )}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

export default function LessonDetailPanel({ lesson, onClose, onUpdated, readOnly = false }) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [comment, setComment] = useState("");
  const [pointsEarned, setPointsEarned] = useState(lesson.points_earned ?? "");
  const [error, setError] = useState(null);

  const changeStatus = async (new_status) => {
    if (user.role === 'admin' && !comment.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await apiPatch(`/gradebook/lessons/${lesson.id}`, {
        new_status,
        points_earned: pointsEarned !== "" ? Number(pointsEarned) : undefined,
      });
      onUpdated();
    } catch (err) {
      setError(err.message || "Failed to update lesson");
    } finally {
      setSaving(false);
    }
  };

  const isAdmin = user?.role === 'admin';
  const isStudent = user?.role === 'student';
  const isCoach = ['academic_coach'].includes(user?.role);

  // Detect structured LessonPlan JSON stored by the lesson builder
  const lessonPlan = useMemo(
    () => parseLessonPlanInstructions(lesson.instructions),
    [lesson.instructions],
  );
  const isTeacher = user?.role === 'admin' || user?.role === 'academic_coach';
  const [showAnswers, setShowAnswers] = useState(false);

  // Load standards text for any linked codes
  const [standardsMap, setStandardsMap] = useState({});
  useEffect(() => {
    const codes = lesson.standards_codes ?? [];
    if (!codes.length) return;
    getAllStandards().then(all => {
      const map = {};
      for (const s of all) {
        const c = s.standard_code ?? s.code;
        if (c) map[c] = s;
      }
      setStandardsMap(map);
    }).catch(() => {});
  }, [lesson.standards_codes]);

  const linkedStandards = useMemo(
    () => (lesson.standards_codes ?? []).map(code => {
      const s = standardsMap[code] ?? {};
      return {
        code,
        short: s.short_code ?? shortCode(code),
        text: s.standard_text ?? s.text ?? "",
      };
    }),
    [lesson.standards_codes, standardsMap],
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="font-bold text-[#1a3c5e] text-lg">{lesson.title}</h2>
            <div className="flex items-center gap-2 mt-1">
              <LessonStatusBadge status={lesson.status} />
              {lesson.subject && <span className="text-xs text-slate-500">{lesson.subject}</span>}
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100"><X className="w-5 h-5 text-slate-500" /></button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {lessonPlan ? (
            <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-4 space-y-4">
              <div className="flex items-center gap-1.5 text-[#1a3c5e]">
                <Sparkles className="w-4 h-4" />
                <p className="text-xs font-semibold uppercase tracking-wide">Lesson Plan</p>
              </div>

              <PlanSection title="Learning Objective">
                <PlanBody text={lessonPlan.objective} />
              </PlanSection>

              <PlanSection title="Success Criteria">
                <PlanList items={lessonPlan.successCriteria} />
              </PlanSection>

              <PlanSection title="Academic Vocabulary">
                <PlanList items={lessonPlan.vocabulary} />
              </PlanSection>

              <PlanSection title="Materials">
                <PlanList items={lessonPlan.materials} />
              </PlanSection>

              <PlanSection title="Warm-Up / Hook">
                <PlanBody text={lessonPlan.warmUp} />
              </PlanSection>

              <PlanSection title="Direct Instruction">
                <PlanBody text={lessonPlan.directInstruction} />
              </PlanSection>

              <PlanSection title="Guided Practice">
                <PlanBody text={lessonPlan.guidedPractice} />
              </PlanSection>

              <PlanSection title="Independent Practice">
                <PlanBody text={lessonPlan.independentPractice} />
              </PlanSection>

              <PlanSection title="Differentiation">
                <PlanBody text={lessonPlan.differentiation} />
              </PlanSection>

              <PlanSection title="Checks for Understanding">
                <PlanList items={lessonPlan.checksForUnderstanding} />
              </PlanSection>

              {isTeacher && (lessonPlan.assessmentQuestions?.length > 0 || lessonPlan.exitTicketQuestions?.length > 0) && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowAnswers((v) => !v)}
                    className={`text-[11px] font-semibold px-2.5 py-1 rounded border ${
                      showAnswers
                        ? "border-green-200 bg-green-50 text-green-800"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {showAnswers ? "Hide answers" : "Show answers"}
                  </button>
                </div>
              )}

              <PlanSection title="Assessment">
                <PlanBody text={lessonPlan.assessment} />
                {lessonPlan.assessmentQuestions?.length > 0 && (
                  <div className="mt-3">
                    <QuestionBlock
                      questions={lessonPlan.assessmentQuestions}
                      showAnswers={isTeacher && showAnswers}
                    />
                  </div>
                )}
              </PlanSection>

              <PlanSection title="Exit Ticket">
                <PlanBody text={lessonPlan.exitTicket} />
                {lessonPlan.exitTicketQuestions?.length > 0 && (
                  <div className="mt-3">
                    <QuestionBlock
                      questions={lessonPlan.exitTicketQuestions}
                      showAnswers={isTeacher && showAnswers}
                    />
                  </div>
                )}
              </PlanSection>

              {lessonPlan.teacherNotes?.trim() && (user?.role === 'admin' || user?.role === 'academic_coach') && (
                <PlanSection title="Teacher Notes">
                  <PlanBody text={lessonPlan.teacherNotes} />
                </PlanSection>
              )}
            </div>
          ) : (
            lesson.instructions && (
              <div className="bg-blue-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">Instructions</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{lesson.instructions}</p>
              </div>
            )
          )}

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-slate-400">Assigned</span><br />
              <span className="font-medium">{lesson.assigned_at ? format(new Date(lesson.assigned_at), "MMM d, yyyy") : "—"}</span>
            </div>
            <div>
              <span className="text-slate-400">Due</span><br />
              <span className="font-medium">{lesson.due_at ? format(new Date(lesson.due_at), "MMM d, yyyy h:mm a") : "—"}</span>
            </div>
            <div>
              <span className="text-slate-400">Points Possible</span><br />
              <span className="font-medium">{lesson.points_possible ?? "—"}</span>
            </div>
            <div>
              <span className="text-slate-400">Points Earned</span><br />
              <span className="font-medium">{lesson.points_earned ?? "—"}</span>
            </div>
            {lesson.completed_at && (
              <div>
                <span className="text-slate-400">Completed</span><br />
                <span className="font-medium text-green-700">{format(new Date(lesson.completed_at), "MMM d, h:mm a")}</span>
              </div>
            )}
          </div>

          {linkedStandards.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <BookMarked className="w-3.5 h-3.5" /> Standards
              </p>
              <div className="space-y-1.5">
                {linkedStandards.map(s => (
                  <div key={s.code} className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                    <span className="text-[10px] font-mono font-bold text-[#1a3c5e] shrink-0 mt-0.5">
                      {s.short}
                    </span>
                    <span className="text-xs text-slate-700 leading-snug">
                      {s.text || s.code}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!readOnly && (
            <div className="space-y-3">
              {(isAdmin || isCoach) && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Points Earned</label>
                  <input
                    type="number" min="0" max={lesson.points_possible}
                    className="w-32 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
                    value={pointsEarned}
                    onChange={e => setPointsEarned(e.target.value)}
                  />
                </div>
              )}
              {isAdmin && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Admin Correction Comment *</label>
                  <textarea
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30 min-h-[60px]"
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    placeholder="Required for admin corrections…"
                  />
                </div>
              )}
              {isStudent && (
                <p className="text-xs text-slate-400">Click below to mark this lesson complete when you've finished it.</p>
              )}
              {error && <p className="text-sm text-red-500">{error}</p>}
              <div className="flex gap-3">
                {lesson.status !== 'complete' && (
                  <Button
                    size="sm"
                    className="bg-green-700 hover:bg-green-800"
                    disabled={saving || (isAdmin && !comment.trim())}
                    onClick={() => changeStatus('complete')}
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-1" />}
                    Mark Complete
                  </Button>
                )}
                {lesson.status !== 'incomplete' && !isStudent && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-yellow-700 border-yellow-200 hover:bg-yellow-50"
                    disabled={saving || (isAdmin && !comment.trim())}
                    onClick={() => changeStatus('incomplete')}
                  >
                    <Circle className="w-4 h-4 mr-1" />
                    Mark Incomplete
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
