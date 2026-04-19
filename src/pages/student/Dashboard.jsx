import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/api/apiClient";
import { Link } from "react-router-dom";
import { BookOpen, Activity, AlertCircle, Star, Calendar, TrendingUp, MessageCircle, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import KPIBar from "@/components/gradebook/KPIBar";
import LessonRow from "@/components/gradebook/LessonRow";
import LessonDetailPanel from "@/components/gradebook/LessonDetailPanel";
import AnnouncementBanner from "@/components/AnnouncementBanner";
import { format } from "date-fns";

export default function StudentDashboard() {
  const { user } = useAuth();
  const [selected, setSelected] = useState(null);

  const { data: student } = useQuery({
    queryKey: ["my-student", user?.id],
    queryFn: () => apiGet(`/students/by-user/${user.id}`).then(r => r.student),
    enabled: !!user?.id,
  });

  const { data: lessonData, isLoading: lessonsLoading, refetch } = useQuery({
    queryKey: ["student-lessons", user?.id],
    queryFn: () => apiGet("/gradebook/lessons"),
    enabled: !!user,
  });

  const { data: pointsData } = useQuery({
    queryKey: ["student-points", student?.id],
    queryFn: () => apiGet(`/rewards/points/${student.id}`),
    enabled: !!student?.id,
  });

  const { data: trainingLogs = [] } = useQuery({
    queryKey: ["student-training-logs", student?.id],
    queryFn: () => apiGet(`/training-logs/student/${student.id}`).then(r => r.logs || []),
    enabled: !!student?.id,
  });

  const allLessons = lessonData?.lessons || [];
  const kpis = lessonData?.kpis;
  const incomplete = allLessons.filter(l => l.status === "incomplete").slice(0, 5);
  const totalPoints = pointsData?.points ?? 0;
  const recentLogs = trainingLogs.slice(0, 3);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <AnnouncementBanner />
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm text-slate-500 mb-1">Student Portal</p>
          <h1 className="text-3xl font-bold text-[#1a3c5e]">
            Welcome back, {user?.firstName || user?.first_name || "Student"}!
          </h1>
          <p className="text-sm text-slate-400 mt-1">Here's your full picture — academics, performance, and goals.</p>
        </div>
      </div>

      {kpis?.intervention && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          You have overdue or incomplete lessons. Please reach out to your academic coach.
        </div>
      )}

      {kpis && (
        <div>
          <h2 className="text-sm font-semibold text-slate-600 mb-3 uppercase tracking-wide">Academic Progress</h2>
          <KPIBar kpis={kpis} showIntervention={false} />
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
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

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-slate-700">
                <Star className="w-4 h-4 text-yellow-500" /> My Rewards
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-2">
                <p className="text-3xl font-bold text-yellow-600">{totalPoints}</p>
                <p className="text-xs text-yellow-500 mt-0.5">Total Points</p>
              </div>
              <Link to="/student/rewards" className="text-xs text-[#1a3c5e] flex items-center gap-1 hover:underline mt-2">
                View rewards & redeem <ChevronRight className="w-3 h-3" />
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-slate-700">
                <Activity className="w-4 h-4 text-purple-500" /> Recent Training
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentLogs.length === 0 ? (
                <p className="text-xs text-slate-400">No training sessions logged yet.</p>
              ) : (
                <div className="space-y-2">
                  {recentLogs.map(log => (
                    <div key={log.id} className="flex items-center justify-between text-xs">
                      <span className="text-slate-700 font-medium capitalize">{log.type || "Training"}</span>
                      <span className="text-slate-400 shrink-0 ml-2">
                        {log.date ? format(new Date(log.date), "MMM d") : "—"}
                        {log.durationMinutes ? ` · ${log.durationMinutes}m` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <Link to="/student/schedule" className="text-xs text-[#1a3c5e] flex items-center gap-1 hover:underline mt-3">
                Full history <ChevronRight className="w-3 h-3" />
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Schedule", href: "/student/schedule", icon: Calendar, color: "text-purple-600", bg: "bg-purple-50" },
          { label: "My Lessons", href: "/student/progress", icon: TrendingUp, color: "text-green-600", bg: "bg-green-50" },
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
