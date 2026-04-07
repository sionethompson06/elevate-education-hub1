import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/api/apiClient";
import { BookOpen, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import KPIBar from "@/components/gradebook/KPIBar";
import LessonRow from "@/components/gradebook/LessonRow";
import LessonDetailPanel from "@/components/gradebook/LessonDetailPanel";

export default function StudentGradebook({ studentId, studentName }) {
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState("incomplete");

  const { data, isLoading } = useQuery({
    queryKey: ["parent-progress", studentId],
    queryFn: () => apiGet(`/progress/student/${studentId}`),
    enabled: !!studentId,
  });

  const assignments = data?.assignments || [];
  const submissions = data?.submissions || [];
  const grades = data?.grades || {};

  // Build submission lookup by assignmentId
  const submissionMap = {};
  for (const s of submissions) submissionMap[s.assignmentId] = s;

  // Map real assignments + submissions → lesson format that LessonRow expects
  const lessons = assignments.map(a => {
    const sub = submissionMap[a.id];
    return {
      id: a.id,
      title: a.title,
      subject: grades[a.sectionId]?.sectionName || a.category || "",
      due_at: a.dueDate || null,
      status: sub != null && sub.score !== null && sub.score !== undefined ? "complete" : "incomplete",
      points_possible: a.maxScore,
      points_earned: sub?.score ?? null,
    };
  });

  const now = new Date();
  const completedLessons = lessons.filter(l => l.status === "complete");
  const incompleteLessons = lessons.filter(l => l.status === "incomplete");

  const kpis = lessons.length > 0 ? {
    completed_count: completedLessons.length,
    incomplete_count: incompleteLessons.length,
    overdue_count: incompleteLessons.filter(l => l.due_at && new Date(l.due_at) < now).length,
    due_today_count: incompleteLessons.filter(l => l.due_at && new Date(l.due_at).toDateString() === now.toDateString()).length,
    upcoming_7d_count: incompleteLessons.filter(l => {
      if (!l.due_at) return false;
      const due = new Date(l.due_at);
      const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      return due > now && due <= sevenDays;
    }).length,
    overall_completion_rate: completedLessons.length / lessons.length,
    intervention: completedLessons.length / lessons.length < 0.5 && incompleteLessons.length > 3,
    due_this_week_count: null,
    completed_this_week_count: null,
    on_time_due_this_week_count: null,
    weekly_completion_rate: null,
  } : null;

  const filtered = tab === "all" ? lessons : lessons.filter(l => l.status === tab);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-700">{studentName}'s Gradebook</h2>

      {kpis && <KPIBar kpis={kpis} showIntervention={false} />}

      {kpis?.intervention && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Attention needed: {studentName} has overdue or incomplete assignments. Consider contacting their coach.
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base text-slate-700 flex items-center gap-2">
              <BookOpen className="w-4 h-4" /> Assignments
            </CardTitle>
            <div className="flex gap-1">
              {["all", "incomplete", "complete"].map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-colors ${tab === t ? "bg-[#1a3c5e] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-6"><div className="w-5 h-5 border-4 border-slate-200 border-t-[#1a3c5e] rounded-full animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">No assignments found.</p>
          ) : (
            <div>
              {filtered.map(l => (
                <LessonRow key={l.id} lesson={l} onClick={() => setSelected(l)} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selected && (
        <LessonDetailPanel
          lesson={selected}
          readOnly={true}
          onClose={() => setSelected(null)}
          onUpdated={() => setSelected(null)}
        />
      )}
    </div>
  );
}
