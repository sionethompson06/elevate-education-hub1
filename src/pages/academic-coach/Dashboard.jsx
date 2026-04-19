import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet } from "@/api/apiClient";
import { Plus, Users, AlertTriangle, BookOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import KPIBar from "@/components/gradebook/KPIBar";
import LessonRow from "@/components/gradebook/LessonRow";
import LessonDetailPanel from "@/components/gradebook/LessonDetailPanel";
import CreateLessonModal from "@/components/gradebook/CreateLessonModal";

const SUBJECTS = ["all", "Math", "English", "Science", "History", "Reading", "Writing", "PE", "General"];

export default function AcademicCoachDashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [subject, setSubject] = useState("all");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  const { data: queueData, isLoading: queueLoading } = useQuery({
    queryKey: ["coach-queue", user?.id],
    queryFn: () => apiGet("/gradebook/queue"),
    enabled: !!user,
  });

  const { data: lessonsData, isLoading: lessonsLoading, refetch } = useQuery({
    queryKey: ["coach-lessons", user?.id, selectedStudent, subject],
    queryFn: () => {
      const params = new URLSearchParams();
      if (selectedStudent) params.set("student_id", selectedStudent);
      if (subject !== "all") params.set("subject", subject);
      const qs = params.toString();
      return apiGet(`/gradebook/lessons${qs ? "?" + qs : ""}`);
    },
    enabled: !!user,
  });

  const queue = queueData?.queue || [];
  const lessons = lessonsData?.lessons || [];
  const kpis = lessonsData?.kpis;

  const handleUpdated = () => {
    refetch();
    qc.invalidateQueries({ queryKey: ["coach-queue"] });
    setSelectedLesson(null);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="inline-block px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold mb-2">
            Academic Coach
          </div>
          <h1 className="text-3xl font-bold text-[#1a3c5e]">
            Coach {user?.lastName || user?.last_name || "Dashboard"}
          </h1>
        </div>
        <Button className="bg-[#1a3c5e] hover:bg-[#0d2540]" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-2" /> Assign Lesson
        </Button>
      </div>

      {kpis && <KPIBar kpis={kpis} />}

      <div className="grid lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-slate-700 flex items-center gap-2">
              <Users className="w-4 h-4" /> My Students
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {queueLoading ? (
              <div className="flex justify-center py-6"><div className="w-5 h-5 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin" /></div>
            ) : queue.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">No students assigned.</p>
            ) : (
              <div className="divide-y">
                <button
                  onClick={() => setSelectedStudent(null)}
                  className={`w-full text-left px-4 py-3 text-sm transition-colors ${!selectedStudent ? "bg-[#1a3c5e] text-white" : "hover:bg-slate-50 text-slate-700"}`}
                >
                  All Students ({queue.length})
                </button>
                {queue.map(s => (
                  <button
                    key={s.student_id}
                    onClick={() => setSelectedStudent(s.student_id)}
                    className={`w-full text-left px-4 py-3 transition-colors ${selectedStudent === s.student_id ? "bg-[#1a3c5e] text-white" : "hover:bg-slate-50"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm font-medium ${selectedStudent === s.student_id ? "text-white" : "text-slate-800"}`}>
                        {s.student_name}
                      </span>
                      {s.kpis?.intervention && <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                    </div>
                    <div className={`text-xs mt-0.5 ${selectedStudent === s.student_id ? "text-slate-300" : "text-slate-400"}`}>
                      {s.kpis?.overdue_count > 0 && `${s.kpis.overdue_count} overdue · `}
                      {s.kpis?.incomplete_count} incomplete
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base text-slate-700 flex items-center gap-2">
                <BookOpen className="w-4 h-4" /> Lessons
              </CardTitle>
              <div className="flex gap-1 flex-wrap">
                {SUBJECTS.map(s => (
                  <button
                    key={s}
                    onClick={() => setSubject(s)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors capitalize ${subject === s ? "bg-[#1a3c5e] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {lessonsLoading ? (
              <div className="flex justify-center py-8"><div className="w-5 h-5 border-4 border-slate-200 border-t-[#1a3c5e] rounded-full animate-spin" /></div>
            ) : lessons.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">No lessons found.</p>
            ) : (
              <div className="max-h-[500px] overflow-y-auto">
                {lessons.map(l => (
                  <LessonRow key={l.id} lesson={l} onClick={() => setSelectedLesson(l)} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {showCreate && (
        <CreateLessonModal
          assignedStudents={queue}
          onClose={() => setShowCreate(false)}
          onSuccess={() => { setShowCreate(false); handleUpdated(); }}
        />
      )}
      {selectedLesson && (
        <LessonDetailPanel
          lesson={selectedLesson}
          readOnly={false}
          onClose={() => setSelectedLesson(null)}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  );
}
