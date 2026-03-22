import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { BookOpen, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import KPIBar from "@/components/gradebook/KPIBar";
import LessonRow from "@/components/gradebook/LessonRow";
import LessonDetailPanel from "@/components/gradebook/LessonDetailPanel";

const SUBJECTS = ["all", "Math", "English", "Science", "History", "Reading", "Writing", "PE", "General"];
const STATUS_TABS = ["all", "incomplete", "complete"];

export default function StudentProgress() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [subject, setSubject] = useState("all");
  const [statusTab, setStatusTab] = useState("all");
  const [selected, setSelected] = useState(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["student-progress", user?.id, subject],
    queryFn: () => base44.functions.invoke("gradebook", { action: "get_lessons", subject }).then(r => r.data),
    enabled: !!user,
  });

  const allLessons = data?.lessons || [];
  const kpis = data?.kpis;

  const filtered = allLessons.filter(l => statusTab === "all" || l.status === statusTab);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <p className="text-sm text-slate-500 mb-1">Student Portal</p>
        <h1 className="text-3xl font-bold text-[#1a3c5e]">My Progress & Lessons</h1>
        <p className="text-sm text-slate-400 mt-1">View all assigned lessons and mark them complete.</p>
      </div>

      {kpis && <KPIBar kpis={kpis} />}

      {kpis?.intervention && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          You have overdue or incomplete lessons. Please reach out to your academic coach.
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex gap-1 flex-wrap">
          {SUBJECTS.map(s => (
            <button
              key={s}
              onClick={() => setSubject(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${subject === s ? "bg-[#1a3c5e] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {STATUS_TABS.map(s => (
            <button
              key={s}
              onClick={() => setStatusTab(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${statusTab === s ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 text-slate-700">
            <BookOpen className="w-4 h-4 text-blue-500" /> Lessons ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <div className="w-5 h-5 border-4 border-slate-200 border-t-[#1a3c5e] rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center">
              <CheckCircle className="w-10 h-10 text-green-300 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">No lessons in this filter.</p>
            </div>
          ) : (
            filtered.map(l => <LessonRow key={l.id} lesson={l} onClick={() => setSelected(l)} />)
          )}
        </CardContent>
      </Card>

      {selected && (
        <LessonDetailPanel
          lesson={selected}
          readOnly={false}
          onClose={() => setSelected(null)}
          onUpdated={() => { refetch(); qc.invalidateQueries({ queryKey: ["student-lessons"] }); setSelected(null); }}
        />
      )}
    </div>
  );
}