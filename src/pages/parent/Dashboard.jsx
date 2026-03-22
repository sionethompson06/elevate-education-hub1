import { useAuth } from "@/lib/AuthContext";
import { Users, CreditCard, BookOpen, Bell } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ParentDashboard() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#1a3c5e]">
            Welcome, {user?.full_name?.split(" ")[0] || "Parent"}
          </h1>
          <p className="text-slate-500 mt-1">Parent Portal — Elevate Education Hub</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Users, label: "My Students", value: "—", color: "text-blue-600" },
            { icon: CreditCard, label: "Billing Status", value: "—", color: "text-green-600" },
            { icon: BookOpen, label: "Lessons This Week", value: "—", color: "text-purple-600" },
            { icon: Bell, label: "Alerts", value: "—", color: "text-red-500" },
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
            Enrollment, billing, and student progress views will appear here in Phase 5+.
          </p>
        </div>
      </div>
    </div>
  );
}