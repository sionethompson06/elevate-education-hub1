import { useAuth } from "@/lib/AuthContext";
import { BookOpen, Award, Calendar, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function StudentDashboard() {
  const { user } = useAuth();

  const stats = [
    { icon: BookOpen, label: "Active Lessons", value: "—", color: "text-blue-600", bg: "bg-blue-50" },
    { icon: Award, label: "Reward Points", value: "—", color: "text-yellow-500", bg: "bg-yellow-50" },
    { icon: Calendar, label: "Next Session", value: "—", color: "text-green-600", bg: "bg-green-50" },
    { icon: TrendingUp, label: "Lessons Completed", value: "—", color: "text-purple-600", bg: "bg-purple-50" },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <p className="text-sm text-slate-500 mb-1">Student Portal</p>
        <h1 className="text-3xl font-bold text-[#1a3c5e]">
          Welcome back, {user?.full_name?.split(" ")[0] || "Student"}!
        </h1>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(({ icon: Icon, label, value, color, bg }) => (
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

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base text-slate-700">Recent Lessons</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-slate-400">Your lessons will appear here. (Phase 8)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base text-slate-700">Reward Activity</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-slate-400">Your reward history will appear here. (Phase 10)</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}