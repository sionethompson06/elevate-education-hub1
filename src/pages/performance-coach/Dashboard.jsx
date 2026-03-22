import { useAuth } from "@/lib/AuthContext";
import { Users, Activity, TrendingUp, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PerformanceCoachDashboard() {
  const { user } = useAuth();

  const stats = [
    { icon: Users, label: "Assigned Athletes", value: "—", color: "text-blue-600", bg: "bg-blue-50" },
    { icon: Activity, label: "Active Programs", value: "—", color: "text-green-600", bg: "bg-green-50" },
    { icon: TrendingUp, label: "Weekly Progress", value: "—", color: "text-purple-600", bg: "bg-purple-50" },
    { icon: AlertCircle, label: "Needs Attention", value: "—", color: "text-red-500", bg: "bg-red-50" },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <div className="inline-block px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-semibold mb-2">
          Performance Coach
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
          <CardHeader><CardTitle className="text-base text-slate-700">Athlete Roster</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-slate-400">Athlete list and performance data will appear here. (Phase 8)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base text-slate-700">Training Plans</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-slate-400">Assigned training plans will appear here. (Phase 8)</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}