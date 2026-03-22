import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Users, Activity, AlertTriangle, Target, Calendar, MessageCircle, ChevronRight, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function PerformanceCoachDashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selectedAthlete, setSelectedAthlete] = useState(null);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ["pc-assignments", user?.id],
    queryFn: () => base44.entities.CoachAssignment.filter({
      coach_user_id: user.id,
      coach_type: "performance_coach",
      is_active: true,
    }),
    enabled: !!user,
  });

  const studentIds = assignments.map(a => a.student_id);

  const { data: students = [] } = useQuery({
    queryKey: ["pc-students", studentIds],
    queryFn: async () => {
      if (!studentIds.length) return [];
      const all = await Promise.all(studentIds.map(sid => base44.entities.Student.filter({ id: sid })));
      return all.flat();
    },
    enabled: studentIds.length > 0,
  });

  const { data: rewardData } = useQuery({
    queryKey: ["pc-rewards", selectedAthlete?.id],
    queryFn: () => base44.functions.invoke("rewards", {
      action: "get_student_rewards",
      student_id: selectedAthlete?.id,
    }).then(r => r.data),
    enabled: !!selectedAthlete,
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ["pc-sessions", selectedAthlete?.id],
    queryFn: () => base44.entities.Session.filter({
      student_id: selectedAthlete.id,
      program_type: "athletic",
    }, "-scheduled_at", 10),
    enabled: !!selectedAthlete,
  });

  const saveNote = async () => {
    if (!noteText.trim() || !selectedAthlete) return;
    setSavingNote(true);
    await base44.entities.ProgressRecord.create({
      student_id: selectedAthlete.id,
      program_type: "athletic",
      period_label: `Coach Note – ${new Date().toLocaleDateString()}`,
      period_start: new Date().toISOString().split("T")[0],
      period_end: new Date().toISOString().split("T")[0],
      recorded_by: user.email,
      summary: noteText.trim(),
    });
    setNoteText("");
    setSavingNote(false);
    qc.invalidateQueries({ queryKey: ["pc-progress"] });
  };

  const activeAthlete = selectedAthlete || students[0];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="inline-block px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-semibold mb-2">
            Performance Coach
          </div>
          <h1 className="text-3xl font-bold text-[#1a3c5e]">
            Coach {user?.full_name?.split(" ").slice(-1)[0] || "Dashboard"}
          </h1>
        </div>
        <div className="flex gap-2">
          <Link to="/performance-coach/schedule">
            <Button variant="outline" size="sm" className="gap-1"><Calendar className="w-4 h-4" /> Schedule</Button>
          </Link>
          <Link to="/performance-coach/messages">
            <Button variant="outline" size="sm" className="gap-1"><MessageCircle className="w-4 h-4" /> Messages</Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Users, label: "Assigned Athletes", value: students.length, color: "text-blue-600", bg: "bg-blue-50" },
          { icon: Activity, label: "Athletic Sessions (logged)", value: sessions.length, color: "text-orange-600", bg: "bg-orange-50" },
          { icon: Target, label: "Active Goals", value: rewardData?.goals?.filter(g => g.status !== "completed").length ?? "—", color: "text-purple-600", bg: "bg-purple-50" },
          { icon: AlertTriangle, label: "Needs Attention", value: "—", color: "text-red-500", bg: "bg-red-50" },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <Card key={label}>
            <CardHeader className="pb-2">
              <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-2`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <CardTitle className="text-xs font-medium text-slate-500">{label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-slate-800">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Athlete roster */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-slate-700 flex items-center gap-2">
              <Users className="w-4 h-4" /> Athlete Roster
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-6"><div className="w-5 h-5 border-4 border-slate-200 border-t-orange-500 rounded-full animate-spin" /></div>
            ) : students.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">No athletes assigned yet.</p>
            ) : (
              <div className="divide-y">
                {students.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedAthlete(s)}
                    className={`w-full text-left px-4 py-3 transition-colors ${activeAthlete?.id === s.id ? "bg-[#1a3c5e] text-white" : "hover:bg-slate-50"}`}
                  >
                    <p className={`text-sm font-semibold ${activeAthlete?.id === s.id ? "text-white" : "text-slate-800"}`}>{s.full_name}</p>
                    <p className={`text-xs mt-0.5 ${activeAthlete?.id === s.id ? "text-slate-300" : "text-slate-400"}`}>
                      {s.sport || "—"} · Grade {s.grade_level || "—"}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Athlete detail */}
        <div className="lg:col-span-2 space-y-4">
          {activeAthlete ? (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-slate-700">{activeAthlete.full_name} — Performance Overview</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-orange-50 rounded-lg p-3">
                      <p className="text-xl font-bold text-orange-700">{rewardData?.balance?.performance_points ?? 0}</p>
                      <p className="text-xs text-orange-500">Performance Pts</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-3">
                      <p className="text-xl font-bold text-blue-700">{sessions.length}</p>
                      <p className="text-xs text-blue-500">Sessions Logged</p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-3">
                      <p className="text-xl font-bold text-purple-700">
                        {rewardData?.goals?.filter(g => g.status !== "completed").length ?? 0}
                      </p>
                      <p className="text-xs text-purple-500">Active Goals</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {activeAthlete.sport && <div><span className="text-slate-400">Sport: </span><span className="font-medium">{activeAthlete.sport}</span></div>}
                    {activeAthlete.grade_level && <div><span className="text-slate-400">Grade: </span><span className="font-medium">{activeAthlete.grade_level}</span></div>}
                  </div>
                </CardContent>
              </Card>

              {/* Coach note / progress log */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-slate-700">Log Coach Note / Progress Update</CardTitle>
                </CardHeader>
                <CardContent>
                  <textarea
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    placeholder="Enter training notes, performance observations, or next steps..."
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30 min-h-[80px] resize-none"
                  />
                  <button
                    onClick={saveNote}
                    disabled={savingNote || !noteText.trim()}
                    className="mt-2 px-4 py-2 bg-[#1a3c5e] text-white text-sm rounded-lg hover:bg-[#0d2540] disabled:opacity-50 transition-colors"
                  >
                    {savingNote ? "Saving..." : "Save Note"}
                  </button>
                </CardContent>
              </Card>

              {/* Recent sessions */}
              {sessions.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-slate-700">Recent Athletic Sessions</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y">
                      {sessions.slice(0, 5).map(s => (
                        <div key={s.id} className="px-4 py-3 flex justify-between text-sm">
                          <div>
                            <p className="font-medium text-slate-800">{s.title}</p>
                            <p className="text-xs text-slate-400">{s.scheduled_at ? new Date(s.scheduled_at).toLocaleDateString() : "—"}</p>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full self-start ${s.attendance_status === "present" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                            {s.attendance_status || s.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">Select an athlete to view their profile.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}