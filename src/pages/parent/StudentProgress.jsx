import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Users, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import KPIBar from "@/components/gradebook/KPIBar";
import LessonRow from "@/components/gradebook/LessonRow";
import LessonDetailPanel from "@/components/gradebook/LessonDetailPanel";

export default function ParentStudentProgress() {
  const { user } = useAuth();
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [selectedLesson, setSelectedLesson] = useState(null);

  const { data: parents = [] } = useQuery({
    queryKey: ["parent-record", user?.email],
    queryFn: () => base44.entities.Parent.filter({ user_email: user.email }),
    enabled: !!user?.email,
  });
  const parent = parents[0];
  const studentIds = parent?.student_ids || [];
  const activeStudentId = selectedStudentId || studentIds[0];

  const { data: students = [] } = useQuery({
    queryKey: ["parent-students", studentIds],
    queryFn: async () => {
      if (!studentIds.length) return [];
      const all = await Promise.all(studentIds.map(sid => base44.entities.Student.filter({ id: sid })));
      return all.flat();
    },
    enabled: studentIds.length > 0,
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["parent-lessons", activeStudentId],
    queryFn: () => base44.functions.invoke("gradebook", {
      action: "get_lessons",
      student_id: activeStudentId,
    }).then(r => r.data),
    enabled: !!activeStudentId,
  });

  const lessons = data?.lessons || [];
  const kpis = data?.kpis;
  const incomplete = lessons.filter(l => l.status === "incomplete");
  const complete = lessons.filter(l => l.status === "complete");

  const activeStudent = students.find(s => s.id === activeStudentId);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <p className="text-sm text-slate-500 mb-1">Parent Portal</p>
        <h1 className="text-3xl font-bold text-[#1a3c5e]">Student Progress</h1>
      </div>

      {/* Student selector */}
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
              <Users className="w-4 h-4" /> {s.full_name}
            </button>
          ))}
        </div>
      )}

      {activeStudent && (
        <p className="text-sm font-semibold text-slate-600 flex items-center gap-2">
          <Users className="w-4 h-4" /> Viewing: {activeStudent.full_name}
          {activeStudent.grade_level && <span className="text-slate-400 font-normal">· Grade {activeStudent.grade_level}</span>}
          {activeStudent.sport && <span className="text-slate-400 font-normal">· {activeStudent.sport}</span>}
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
          {lessons.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <TrendingUp className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-400">No lessons assigned yet.</p>
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