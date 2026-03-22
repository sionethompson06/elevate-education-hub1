import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { BookOpen, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import KPIBar from "@/components/gradebook/KPIBar";
import LessonRow from "@/components/gradebook/LessonRow";
import LessonDetailPanel from "@/components/gradebook/LessonDetailPanel";

export default function StudentGradebook({ studentId, studentName }) {
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState("incomplete");

  const { data, isLoading } = useQuery({
    queryKey: ["parent-gradebook", studentId],
    queryFn: () => base44.functions.invoke("gradebook", {
      action: "get_lessons",
      student_id: studentId,
    }).then(r => r.data),
    enabled: !!studentId,
  });

  const lessons = data?.lessons || [];
  const kpis = data?.kpis;

  const filtered = tab === "all" ? lessons : lessons.filter(l => l.status === tab);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-700">{studentName}'s Gradebook</h2>

      {kpis && <KPIBar kpis={kpis} showIntervention={false} />}

      {kpis?.intervention && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Attention needed: {studentName} has overdue or incomplete lessons. Consider contacting their coach.
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base text-slate-700 flex items-center gap-2">
              <BookOpen className="w-4 h-4" /> Lessons
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
            <p className="text-sm text-slate-400 text-center py-6">No lessons found.</p>
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