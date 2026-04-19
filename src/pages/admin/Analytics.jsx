import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/api/apiClient";
import { TrendingUp, Users, BookOpen, Star, DollarSign, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const COLORS = ["#1a3c5e", "#f59e0b", "#10b981", "#f97316", "#ec4899"];

export default function Analytics() {
  const { data: studentsData = { students: [] } } = useQuery({
    queryKey: ["analytics-students"],
    queryFn: () => apiGet('/students'),
  });
  const { data: enrollmentsData = { enrollments: [] } } = useQuery({
    queryKey: ["analytics-enrollments"],
    queryFn: () => apiGet('/enrollments'),
  });
  const { data: lessonsData = { lessons: [] } } = useQuery({
    queryKey: ["analytics-lessons"],
    queryFn: () => apiGet('/gradebook/lessons'),
  });
  const { data: transactions = [] } = useQuery({
    queryKey: ["analytics-transactions"],
    queryFn: () => apiGet('/rewards/transactions'),
  });

  const students = studentsData.students || [];
  const enrollments = enrollmentsData.enrollments || [];
  const lessons = lessonsData.lessons || [];

  const enrollByStatus = Object.entries(
    enrollments.reduce((acc, e) => { acc[e.status] = (acc[e.status] || 0) + 1; return acc; }, {})
  ).map(([name, value]) => ({ name, value }));

  const completedLessons = lessons.filter(l => l.status === "complete").length;
  const incompleteLessons = lessons.filter(l => l.status === "incomplete").length;
  const completionRate = lessons.length > 0 ? Math.round((completedLessons / lessons.length) * 100) : 0;

  const lessonsBySubject = Object.entries(
    lessons.reduce((acc, l) => { acc[l.subject || "General"] = (acc[l.subject || "General"] || 0) + 1; return acc; }, {})
  ).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

  const totalPoints = transactions.filter(t => t.delta > 0).reduce((s, t) => s + t.delta, 0);

  const stats = [
    { icon: Users, label: "Total Students", value: students.length, color: "text-blue-600", bg: "bg-blue-50" },
    { icon: DollarSign, label: "Active Enrollments", value: enrollments.filter(e => ["active","active_override"].includes(e.status)).length, color: "text-green-600", bg: "bg-green-50" },
    { icon: BookOpen, label: "Lessons Assigned", value: lessons.length, color: "text-purple-600", bg: "bg-purple-50" },
    { icon: Star, label: "Reward Points Earned", value: totalPoints.toLocaleString(), color: "text-yellow-600", bg: "bg-yellow-50" },
    { icon: Activity, label: "Transactions", value: transactions.length, color: "text-orange-600", bg: "bg-orange-50" },
    { icon: TrendingUp, label: "Lesson Completion", value: `${completionRate}%`, color: "text-emerald-600", bg: "bg-emerald-50" },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div>
        <p className="text-sm text-slate-500 mb-1">Admin</p>
        <h1 className="text-3xl font-bold text-[#1a3c5e]">Analytics & Reports</h1>
      </div>

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

        <Card>
          <CardHeader><CardTitle className="text-base text-slate-700">Lessons by Subject</CardTitle></CardHeader>
          <CardContent>
            {lessonsBySubject.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">No lesson data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={lessonsBySubject} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#1a3c5e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base text-slate-700">Lesson Completion</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={[{ name: "Completed", value: completedLessons || 0 }, { name: "Incomplete", value: incompleteLessons || 0 }]}
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

        <Card>
          <CardHeader><CardTitle className="text-base text-slate-700">Recent Point Awards</CardTitle></CardHeader>
          <CardContent>
            {transactions.filter(t => t.delta > 0).length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">No transactions yet.</p>
            ) : (
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {transactions.filter(t => t.delta > 0).slice(0, 8).map(tx => (
                  <div key={tx.id} className="flex items-center justify-between text-sm">
                    <span className="text-slate-700 truncate">{tx.student_name || `Student #${tx.studentId}`}</span>
                    <span className="font-bold text-green-600 shrink-0 ml-2">+{tx.delta} pts</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
