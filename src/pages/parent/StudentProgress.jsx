import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/api/apiClient";
import { Users, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import KPIBar from "@/components/gradebook/KPIBar";
import LessonRow from "@/components/gradebook/LessonRow";
import LessonDetailPanel from "@/components/gradebook/LessonDetailPanel";

export default function ParentStudentProgress() {
  const { user } = useAuth();
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [selectedLesson, setSelectedLesson] = useState(null);

  const { data: myData = { students: [] } } = useQuery({
    queryKey: ["parent-my-students", user?.id],
    queryFn: () => apiGet("/enrollments/my-students"),
    enabled: !!user?.id,
  });

  const students = myData.students || [];
  const activeStudentId = selectedStudentId || (students[0]?.id ?? null);
  const activeStudent = students.find(s => s.id === activeStudentId);

  const { data: progressData, isLoading, refetch } = useQuery({
    queryKey: ["parent-student-progress", activeStudentId],
    queryFn: () => apiGet(`/progress/student/${activeStudentId}`),
    enabled: !!activeStudentId,
  });

  // Map real API data to lesson format that LessonRow expects
  const assignments = progressData?.assignments || [];
  const submissions = progressData?.submissions || [];
  const grades = progressData?.grades || {};

  const submissionMap = {};
  for (const s of submissions) submissionMap[s.assignmentId] = s;

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

  const incomplete = lessons.filter(l => l.status === "incomplete");
  const complete = lessons.filter(l => l.status === "complete");

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <p className="text-sm text-slate-500 mb-1">Parent Portal</p>
        <h1 className="text-3xl font-bold text-[#1a3c5e]">Student Progress</h1>
      </div>

      {students.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {students.map(s => (
            <button
              key={s.id}
              onClick={() => setSelectedStudentId(s.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border-2 ${
                activeStudentId === s.id
                  ? "border-[#1a3c5e] bg-[#1a3c5e] text-white"
                  : "border-slate-200 text-slate-700 hover:border-[#1a3c5e]"
              }`}
            >
              <Users className="w-4 h-4" /> {s.firstName} {s.lastName}
            </button>
          ))}
        </div>
      )}

      {activeStudent && (
        <p className="text-sm font-semibold text-slate-600 flex items-center gap-2">
          <Users className="w-4 h-4" /> Viewing: {activeStudent.firstName} {activeStudent.lastName}
          {activeStudent.grade && <span className="text-slate-400 font-normal">· Grade {activeStudent.grade}</span>}
        </p>
      )}

      {kpis && <KPIBar kpis={kpis} />}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-4 border-slate-200 border-t-[#1a3c5e] rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          {incomplete.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Incomplete / In Progress ({incomplete.length})</h2>
              <Card>
                <CardContent className="p-0">
                  {incomplete.map(l => <LessonRow key={l.id} lesson={l} onClick={() => setSelectedLesson(l)} />)}
                </CardContent>
              </Card>
            </div>
          )}
          {complete.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Completed ({complete.length})</h2>
              <Card>
                <CardContent className="p-0">
                  {complete.map(l => <LessonRow key={l.id} lesson={l} onClick={() => setSelectedLesson(l)} />)}
                </CardContent>
              </Card>
            </div>
          )}
          {lessons.length === 0 && !isLoading && (
            <Card>
              <CardContent className="py-12 text-center">
                <TrendingUp className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-400">No assignments found yet.</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {selectedLesson && (
        <LessonDetailPanel
          lesson={selectedLesson}
          readOnly={true}
          onClose={() => setSelectedLesson(null)}
          onUpdated={() => { refetch(); setSelectedLesson(null); }}
        />
      )}
    </div>
  );
}
