import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { TrendingUp, Users, BookOpen, Star, DollarSign, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const COLORS = ["#1a3c5e", "#f59e0b", "#10b981", "#f97316", "#ec4899"];

export default function Analytics() {
  const { user } = useAuth();

  const { data: students = [] } = useQuery({ queryKey: ["analytics-students"], queryFn: () => base44.entities.Student.list("-created_date", 200) });
  const { data: enrollments = [] } = useQuery({ queryKey: ["analytics-enrollments"], queryFn: () => base44.entities.Enrollment.list("-created_date", 200) });
  const { data: lessons = [] } = useQuery({ queryKey: ["analytics-lessons"], queryFn: () => base44.entities.LessonAssignment.list("-created_date", 500) });
  const { data: transactions = [] } = useQuery({ queryKey: ["analytics-transactions"], queryFn: () => base44.entities.RewardTransaction.list("-awarded_at", 200) });
  const { data: sessions = [] } = useQuery({ queryKey: ["analytics-sessions"], queryFn: () => base44.entities.Session.list("-scheduled_at", 200) });

  // Enrollment by status
  const enrollByStatus = Object.entries(
    enrollments.reduce((acc, e) => { acc[e.status] = (acc[e.status] || 0) + 1; return acc; }, {})
  ).map(([name, value]) => ({ name, value }));

  // Lessons completion
  const completedLessons = lessons.filter(l => l.status === "complete").length;
  const incompleteLessons = lessons.filter(l => l.status === "incomplete").length;
  const completionRate = lessons.length > 0 ? Math.round((completedLessons / lessons.length) * 100) : 0;

  // Sessions by program type
  const sessionsByType = Object.entries(
    sessions.reduce((acc, s) => { acc[s.program_type || "other"] = (acc[s.program_type || "other"] || 0) + 1; return acc; }, {})
  ).map(([name, count]) => ({ name, count }));

  // Reward points by track
  const acadPoints = transactions.filter(t => t.track === "academic" && t.points > 0).reduce((s, t) => s + t.points, 0);
  const perfPoints = transactions.filter(t => t.track === "performance" && t.points > 0).reduce((s, t) => s + t.points, 0);

  const stats = [
    { icon: Users, label: "Total Students", value: students.length, color: "text-blue-600", bg: "bg-blue-50" },
    { icon: DollarSign, label: "Active Enrollments", value: enrollments.filter(e => e.status === "active").length, color: "text-green-600", bg: "bg-green-50" },
    { icon: BookOpen, label: "Lessons Created", value: lessons.length, color: "text-purple-600", bg: "bg-purple-50" },
    { icon: Star, label: "Reward Points Earned", value: (acadPoints + perfPoints).toLocaleString(), color: "text-yellow-600", bg: "bg-yellow-50" },
    { icon: Activity, label: "Sessions Logged", value: sessions.length, color: "text-orange-600", bg: "bg-orange-50" },
    { icon: TrendingUp, label: "Lesson Completion Rate", value: `${completionRate}%`, color: "text-emerald-600", bg: "bg-emerald-50" },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div>
        <p className="text-sm text-slate-500 mb-1">Admin</p>
        <h1 className="text-3xl font-bold text-[#1a3c5e]">Analytics & Reports</h1>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats.map(({ icon: Icon, label, value, color, bg }) => (
          <Card key={label}>
            <CardContent className="py-4 px-4 text-center">
              <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center mx-auto mb-2`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <p className="text-xl font-bold text-slate-800">{value}</p>
              <p className="text-xs text-slate-500 mt-0.5 leading-tight">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Enrollment by status */}
        <Card>
          <CardHeader><CardTitle className="text-base text-slate-700">Enrollment by Status</CardTitle></CardHeader>
          <CardContent>
            {enrollByStatus.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">No enrollment data.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={enrollByStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
                    {enrollByStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Sessions by program type */}
        <Card>
          <CardHeader><CardTitle className="text-base text-slate-700">Sessions by Program Type</CardTitle></CardHeader>
          <CardContent>
            {sessionsByType.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">No session data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={sessionsByType} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#1a3c5e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Lesson completion */}
        <Card>
          <CardHeader><CardTitle className="text-base text-slate-700">Lesson Completion</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={[{ name: "Completed", value: completedLessons }, { name: "Incomplete", value: incompleteLessons }]}
                  dataKey="value" cx="50%" cy="50%" outerRadius={80}
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  <Cell fill="#10b981" />
                  <Cell fill="#f59e0b" />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Reward points by track */}
        <Card>
          <CardHeader><CardTitle className="text-base text-slate-700">Reward Points Earned by Track</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={[{ track: "Academic", points: acadPoints }, { track: "Performance", points: perfPoints }]}
                margin={{ top: 5, right: 10, bottom: 5, left: 0 }}
              >
                <XAxis dataKey="track" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="points" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}