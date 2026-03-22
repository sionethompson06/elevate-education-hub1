import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { CheckCircle, XCircle, Clock, Calendar, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format, parseISO } from "date-fns";

const PROGRAM_TYPES = ["all", "academic", "homeschool", "athletic", "special_event"];
const PROGRAM_LABELS = { academic: "Academic", homeschool: "Homeschool", athletic: "Athletic", special_event: "Special Event" };
const STATUS_CONFIG = {
  present: { label: "Present", color: "bg-green-100 text-green-700", icon: CheckCircle },
  absent: { label: "Absent", color: "bg-red-100 text-red-700", icon: XCircle },
  excused: { label: "Excused", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  late: { label: "Late", color: "bg-orange-100 text-orange-700", icon: Clock },
};

export default function Attendance() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [programFilter, setProgramFilter] = useState("all");
  const [markingSession, setMarkingSession] = useState(null);
  const [attendanceStatus, setAttendanceStatus] = useState("present");
  const [saving, setSaving] = useState(false);

  const isCoachOrAdmin = ["academic_coach", "performance_coach", "admin"].includes(user?.role);

  const { data: sessions = [], isLoading, refetch } = useQuery({
    queryKey: ["attendance-sessions", user?.id, programFilter],
    queryFn: async () => {
      const filters = {};
      if (programFilter !== "all") filters.program_type = programFilter;

      if (user?.role === "student") {
        const students = await base44.entities.Student.filter({ user_id: user.id });
        if (students[0]) filters.student_id = students[0].id;
      } else if (user?.role === "academic_coach") {
        filters.coach_user_id = user.id;
      } else if (user?.role === "performance_coach") {
        filters.coach_user_id = user.id;
      } else if (user?.role === "parent") {
        const parents = await base44.entities.Parent.filter({ user_email: user.email });
        const parent = parents[0];
        if (!parent?.student_ids?.length) return [];
        // Get sessions for first student
        filters.student_id = parent.student_ids[0];
      }
      return base44.entities.Session.filter(filters, "-scheduled_at", 100);
    },
    enabled: !!user,
  });

  const markAttendance = async () => {
    if (!markingSession) return;
    setSaving(true);
    await base44.entities.Session.update(markingSession.id, {
      attendance_status: attendanceStatus,
      status: "completed",
    });
    setSaving(false);
    setMarkingSession(null);
    refetch();
  };

  // Attendance stats
  const completed = sessions.filter(s => s.status === "completed");
  const present = completed.filter(s => s.attendance_status === "present").length;
  const absent = completed.filter(s => s.attendance_status === "absent").length;
  const rate = completed.length > 0 ? Math.round((present / completed.length) * 100) : null;

  // Group by program
  const grouped = sessions.reduce((acc, s) => {
    const pt = s.program_type || "general";
    if (!acc[pt]) acc[pt] = [];
    acc[pt].push(s);
    return acc;
  }, {});

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <p className="text-sm text-slate-500 mb-1">Attendance</p>
        <h1 className="text-3xl font-bold text-[#1a3c5e]">Attendance Tracking</h1>
      </div>

      {/* Stats */}
      {completed.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border p-4 text-center">
            <p className="text-2xl font-bold text-slate-800">{sessions.length}</p>
            <p className="text-xs text-slate-500 mt-0.5">Total Sessions</p>
          </div>
          <div className="bg-green-50 rounded-xl border border-green-100 p-4 text-center">
            <p className="text-2xl font-bold text-green-700">{present}</p>
            <p className="text-xs text-green-500 mt-0.5">Present</p>
          </div>
          <div className="bg-red-50 rounded-xl border border-red-100 p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{absent}</p>
            <p className="text-xs text-red-500 mt-0.5">Absent</p>
          </div>
          <div className={`rounded-xl border p-4 text-center ${rate >= 80 ? "bg-green-50 border-green-100" : "bg-yellow-50 border-yellow-100"}`}>
            <p className={`text-2xl font-bold ${rate >= 80 ? "text-green-700" : "text-yellow-700"}`}>{rate != null ? `${rate}%` : "—"}</p>
            <p className={`text-xs mt-0.5 ${rate >= 80 ? "text-green-500" : "text-yellow-600"}`}>Attendance Rate</p>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-slate-400" />
        {PROGRAM_TYPES.map(pt => (
          <button
            key={pt}
            onClick={() => setProgramFilter(pt)}
            className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-colors ${programFilter === pt ? "bg-[#1a3c5e] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            {pt === "all" ? "All Programs" : PROGRAM_LABELS[pt] || pt}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-4 border-slate-200 border-t-[#1a3c5e] rounded-full animate-spin" /></div>
      ) : sessions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400">No sessions found.</p>
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped).map(([pt, ptSessions]) => (
          <div key={pt}>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">{PROGRAM_LABELS[pt] || pt}</h2>
            <div className="space-y-2">
              {ptSessions.map(s => {
                const sc = STATUS_CONFIG[s.attendance_status];
                return (
                  <Card key={s.id} className="border border-slate-100">
                    <CardContent className="py-3 px-5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-800 text-sm">{s.title}</p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {s.scheduled_at ? format(parseISO(s.scheduled_at), "MMM d, yyyy · h:mm a") : "—"}
                            {s.duration_minutes ? ` · ${s.duration_minutes} min` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {sc ? (
                            <span className={`text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1 ${sc.color}`}>
                              {s.attendance_status}
                            </span>
                          ) : (
                            <span className="text-xs px-2 py-1 rounded-full font-medium bg-slate-100 text-slate-500 capitalize">{s.status}</span>
                          )}
                          {isCoachOrAdmin && s.status !== "cancelled" && (
                            <button
                              onClick={() => { setMarkingSession(s); setAttendanceStatus(s.attendance_status || "present"); }}
                              className="text-xs text-[#1a3c5e] underline hover:no-underline"
                            >
                              {s.attendance_status ? "Edit" : "Mark"}
                            </button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))
      )}

      {/* Mark attendance modal */}
      {markingSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-bold text-[#1a3c5e] mb-1">{markingSession.title}</h3>
            <p className="text-xs text-slate-400 mb-4">{markingSession.scheduled_at ? format(parseISO(markingSession.scheduled_at), "MMM d, yyyy · h:mm a") : ""}</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {Object.entries(STATUS_CONFIG).map(([status, cfg]) => (
                <button
                  key={status}
                  onClick={() => setAttendanceStatus(status)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium capitalize border transition-colors ${attendanceStatus === status ? "bg-[#1a3c5e] text-white border-[#1a3c5e]" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}
                >
                  {cfg.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setMarkingSession(null)} className="flex-1 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
              <Button onClick={markAttendance} disabled={saving} className="flex-1 bg-[#1a3c5e] hover:bg-[#0d2540]">
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}