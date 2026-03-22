import { useAuth } from "@/lib/AuthContext";
import { Users, Activity, TrendingUp, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PerformanceCoachDashboard() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <div className="inline-block px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold mb-2">
            Performance Coach
          </div>
          <h1 className="text-3xl font-bold text-[#1a3c5e]">
            Coach {user?.full_name?.split(" ")[1] || user?.full_name || "Dashboard"}
          </h1>
          <p className="text-slate-500 mt-1">Performance Coach Portal — Elevate Education Hub</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Users, label: "Assigned Athletes", value: "—", color: "text-blue-600" },
            { icon: Activity, label: "Active Programs", value: "—", color: "text-green-600" },
            { icon: TrendingUp, label: "Weekly Progress", value: "—", color: "text-purple-600" },
            { icon: AlertCircle, label: "Intervention Flags", value: "—", color: "text-red-500" },
          ].map(({ icon: Icon, label, value, color }) => (
            <Card key={label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">{label}</CardTitle>
                <Icon className={`w-5 h-5 ${color}`} />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-slate-800">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="mt-8 p-6 bg-white rounded-xl border border-slate-200">
          <p className="text-slate-400 text-center">
            Athlete management and performance KPIs will appear here in Phase 8+.
          </p>
        </div>
      </div>
    </div>
  );
}