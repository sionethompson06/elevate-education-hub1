import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { BookOpen, Activity, AlertCircle, Star, Calendar, TrendingUp, MessageCircle, ChevronRight, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import KPIBar from "@/components/gradebook/KPIBar";
import LessonRow from "@/components/gradebook/LessonRow";
import LessonDetailPanel from "@/components/gradebook/LessonDetailPanel";

export default function StudentDashboard() {
  const { user } = useAuth();
  const [selected, setSelected] = useState(null);

  const { data: lessonData, isLoading: lessonsLoading, refetch } = useQuery({
    queryKey: ["student-lessons", user?.id],
    queryFn: () => base44.functions.invoke("gradebook", { action: "get_lessons" }).then(r => r.data),
    enabled: !!user,
  });

  const { data: rewardData } = useQuery({
    queryKey: ["student-rewards-dash", user?.id],
    queryFn: () => base44.functions.invoke("rewards", { action: "get_student_rewards" }).then(r => r.data),
    enabled: !!user,
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ["student-sessions-dash", user?.id],
    queryFn: async () => {
      const students = await base44.entities.Student.filter({ user_id: user.id });
      if (!students[0]) return [];
      return base44.entities.Session.filter({ student_id: students[0].id }, "scheduled_at", 5);
    },
    enabled: !!user,
  });

  const allLessons = lessonData?.lessons || [];
  const kpis = lessonData?.kpis;
  const incomplete = allLessons.filter(l => l.status === "incomplete").slice(0, 5);
  const balance = rewardData?.balance;
  const goals = rewardData?.goals?.filter(g => g.status !== "completed").slice(0, 3) || [];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm text-slate-500 mb-1">Student Portal</p>
          <h1 className="text-3xl font-bold text-[#1a3c5e]">
            Welcome back, {user?.full_name?.split(" ")[0] || "Student"}!
          </h1>
          <p className="text-sm text-slate-400 mt-1">Here's your full picture — academics, performance, and goals.</p>
        </div>
      </div>

      {/* Intervention alert */}
      {kpis?.intervention && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          You have overdue or incomplete lessons. Please reach out to your academic coach.
        </div>
      )}

      {/* KPIs */}
      {kpis && (
        <div>
          <h2 className="text-sm font-semibold text-slate-600 mb-3 uppercase tracking-wide">Academic Progress</h2>
          <KPIBar kpis={kpis} showIntervention={false} />
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Upcoming lessons */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2 text-slate-700">
                <BookOpen className="w-4 h-4 text-blue-500" /> Academic — Tasks Due
              </CardTitle>
              <Link to="/student/progress" className="text-xs text-[#1a3c5e] flex items-center gap-1 hover:underline">
                View all <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {lessonsLoading ? (
              <div className="flex justify-center py-8"><div className="w-5 h-5 border-4 border-slate-200 border-t-[#1a3c5e] rounded-full animate-spin" /></div>
            ) : incomplete.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">All caught up! No pending tasks.</p>
            ) : (
              incomplete.map(l => <LessonRow key={l.id} lesson={l} onClick={() => setSelected(l)} />)
            )}
          </CardContent>
        </Card>

        {/* Right column */}
        <div className="space-y-4">
          {/* Reward balance */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-slate-700">
                <Star className="w-4 h-4 text-yellow-500" /> My Rewards
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2 text-center mb-3">
                <div className="bg-blue-50 rounded-lg p-2">
                  <p className="text-lg font-bold text-blue-700">{balance?.academic_points ?? 0}</p>
                  <p className="text-xs text-blue-500">Academic</p>
                </div>
                <div className="bg-orange-50 rounded-lg p-2">
                  <p className="text-lg font-bold text-orange-600">{balance?.performance_points ?? 0}</p>
                  <p className="text-xs text-orange-500">Perf.</p>
                </div>
                <div className="bg-yellow-50 rounded-lg p-2">
                  <p className="text-lg font-bold text-yellow-600">{balance?.total_points ?? 0}</p>
                  <p className="text-xs text-yellow-500">Total</p>
                </div>
              </div>
              <Link to="/student/rewards" className="text-xs text-[#1a3c5e] flex items-center gap-1 hover:underline">
                View rewards & redeem <ChevronRight className="w-3 h-3" />
              </Link>
            </CardContent>
          </Card>

          {/* Active goals */}
          {goals.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-slate-700">
                  <Target className="w-4 h-4 text-blue-500" /> Active Goals
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {goals.map(g => {
                  const pct = Math.min(100, Math.round(((g.current_points || 0) / g.target_points) * 100));
                  return (
                    <div key={g.id}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-700 font-medium truncate">{g.title}</span>
                        <span className="text-slate-400 shrink-0 ml-2">{pct}%</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Upcoming sessions */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-slate-700">
                <Calendar className="w-4 h-4 text-purple-500" /> Next Sessions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sessions.length === 0 ? (
                <p className="text-xs text-slate-400">No upcoming sessions.</p>
              ) : (
                <div className="space-y-2">
                  {sessions.slice(0, 3).map(s => (
                    <div key={s.id} className="flex items-center justify-between text-xs">
                      <span className="text-slate-700 font-medium truncate">{s.title}</span>
                      <span className="text-slate-400 shrink-0 ml-2 capitalize">{s.program_type}</span>
                    </div>
                  ))}
                </div>
              )}
              <Link to="/student/schedule" className="text-xs text-[#1a3c5e] flex items-center gap-1 hover:underline mt-3">
                Full schedule <ChevronRight className="w-3 h-3" />
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Quick nav tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Schedule", href: "/student/schedule", icon: Calendar, color: "text-purple-600", bg: "bg-purple-50" },
          { label: "Progress", href: "/student/progress", icon: TrendingUp, color: "text-green-600", bg: "bg-green-50" },
          { label: "Messages", href: "/student/messages", icon: MessageCircle, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Resources", href: "/student/resources", icon: BookOpen, color: "text-orange-600", bg: "bg-orange-50" },
        ].map(({ label, href, icon: Icon, color, bg }) => (
          <Link key={href} to={href}>
            <div className="bg-white rounded-xl border border-slate-100 p-4 hover:shadow-sm hover:border-[#1a3c5e] transition-all text-center">
              <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center mx-auto mb-2`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <p className="text-xs font-semibold text-slate-700">{label}</p>
            </div>
          </Link>
        ))}
      </div>

      {selected && (
        <LessonDetailPanel
          lesson={selected}
          readOnly={false}
          onClose={() => setSelected(null)}
          onUpdated={() => { refetch(); setSelected(null); }}
        />
      )}
    </div>
  );
}