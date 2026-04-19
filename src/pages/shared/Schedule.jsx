import { useAuth } from "@/lib/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/api/apiClient";
import { Calendar, Activity, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";

const TYPE_COLORS = {
  strength: "bg-orange-100 text-orange-700",
  conditioning: "bg-blue-100 text-blue-700",
  skill: "bg-purple-100 text-purple-700",
  speed: "bg-green-100 text-green-700",
  recovery: "bg-slate-100 text-slate-600",
  general: "bg-slate-100 text-slate-600",
};

export default function Schedule() {
  const { user } = useAuth();

  const { data: student } = useQuery({
    queryKey: ["my-student", user?.id],
    queryFn: () => apiGet(`/students/by-user/${user.id}`).then(r => r.student),
    enabled: !!user?.id && (user?.role === "student" || user?.role === "parent"),
  });

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["schedule-logs", user?.id, student?.id],
    queryFn: async () => {
      if (user?.role === "student") {
        if (!student?.id) return [];
        return apiGet(`/training-logs/student/${student.id}`).then(r => r.logs || []);
      }
      if (user?.role === "academic_coach" || user?.role === "performance_coach") {
        const myStudents = await apiGet("/training-logs/my-students").then(r => r.students || []);
        if (!myStudents.length) return [];
        const all = await Promise.all(
          myStudents.slice(0, 10).map(s =>
            apiGet(`/training-logs/student/${s.id}`).then(r =>
              (r.logs || []).map(l => ({ ...l, studentName: `${s.firstName} ${s.lastName}` }))
            )
          )
        );
        return all.flat().sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      }
      return [];
    },
    enabled: !!user && (user?.role !== "student" || !!student?.id),
  });

  const grouped = logs.reduce((acc, l) => {
    const day = l.date?.slice(0, 10) || "unknown";
    if (!acc[day]) acc[day] = [];
    acc[day].push(l);
    return acc;
  }, {});

  const days = Object.keys(grouped).sort().reverse();

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <p className="text-sm text-slate-500 mb-1">Training</p>
        <h1 className="text-3xl font-bold text-[#1a3c5e]">Training History</h1>
        <p className="text-sm text-slate-400 mt-1">Past sessions and training logs.</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-4 border-slate-200 border-t-[#1a3c5e] rounded-full animate-spin" />
        </div>
      ) : days.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400">No training sessions logged yet.</p>
            <p className="text-xs text-slate-300 mt-1">Sessions will appear here once your coach logs them.</p>
          </CardContent>
        </Card>
      ) : (
        days.map(day => (
          <div key={day}>
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
              {day !== "unknown" ? format(new Date(day), "EEEE, MMMM d, yyyy") : "Unknown Date"}
            </p>
            <div className="space-y-3">
              {grouped[day].map(log => (
                <Card key={log.id} className="border border-slate-100">
                  <CardContent className="py-4 px-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border capitalize ${TYPE_COLORS[log.type] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
                            {log.type || "General"}
                          </span>
                        </div>
                        <p className="font-semibold text-slate-800">
                          {log.studentName ? `${log.studentName} — ` : ""}
                          {log.type ? log.type.charAt(0).toUpperCase() + log.type.slice(1) : "Training"} Session
                        </p>
                        <div className="flex items-center gap-4 mt-1 text-xs text-slate-500 flex-wrap">
                          {log.durationMinutes && (
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{log.durationMinutes} min</span>
                          )}
                          {log.notes && <span className="text-slate-400 truncate max-w-xs">{log.notes}</span>}
                        </div>
                      </div>
                      <Activity className="w-5 h-5 text-slate-300 shrink-0 mt-0.5" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
