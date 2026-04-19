import { useState } from "react";
import { apiPatch } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { X, CheckCircle, Circle, Loader2 } from "lucide-react";
import LessonStatusBadge from "./LessonStatusBadge";
import { format } from "date-fns";
import { useAuth } from "@/lib/AuthContext";

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
          {lesson.instructions && (
            <div className="bg-blue-50 rounded-xl p-4">
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">Instructions</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{lesson.instructions}</p>
            </div>
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
