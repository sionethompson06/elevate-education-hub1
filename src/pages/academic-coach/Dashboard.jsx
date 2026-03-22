import { useAuth } from "@/lib/AuthContext";
import { Users, BookOpen, CheckSquare, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AcademicCoachDashboard() {
  const { user } = useAuth();

  const stats = [
    { icon: Users, label: "Assigned Students", value: "—", color: "text-blue-600", bg: "bg-blue-50" },
    { icon: BookOpen, label: "Active Lessons", value: "—", color: "text-green-600", bg: "bg-green-50" },
    { icon: CheckSquare, label: "Completed This Week", value: "—", color: "text-purple-600", bg: "bg-purple-50" },
    { icon: AlertCircle, label: "Needs Attention", value: "—", color: "text-red-500", bg: "bg-red-50" },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <div className="inline-block px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold mb-2">
          Academic Coach
        </div>
        <h1 className="text-3xl font-bold text-[#1a3c5e]">
          Coach {user?.full_name?.split(" ").slice(-1)[0] || "Dashboard"}
        </h1>
        <p className="text-slate-500 mt-1">{user?.email}</p>
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
          <CardHeader><CardTitle className="text-base text-slate-700">Student Roster</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-slate-400">Student list and gradebook will appear here. (Phase 8)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base text-slate-700">Lesson Queue</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-slate-400">Pending lessons and submissions will appear here. (Phase 8)</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}