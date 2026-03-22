import { useAuth } from "@/lib/AuthContext";
import { Users, CreditCard, BookOpen, Bell } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ParentDashboard() {
  const { user } = useAuth();

  const stats = [
    { icon: Users, label: "My Students", value: "—", color: "text-blue-600", bg: "bg-blue-50" },
    { icon: CreditCard, label: "Billing Status", value: "—", color: "text-green-600", bg: "bg-green-50" },
    { icon: BookOpen, label: "Lessons This Week", value: "—", color: "text-purple-600", bg: "bg-purple-50" },
    { icon: Bell, label: "Alerts", value: "—", color: "text-red-500", bg: "bg-red-50" },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <p className="text-sm text-slate-500 mb-1">Parent Portal</p>
        <h1 className="text-3xl font-bold text-[#1a3c5e]">
          Welcome, {user?.full_name?.split(" ")[0] || "Parent"}!
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
          <CardHeader><CardTitle className="text-base text-slate-700">Student Progress</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-slate-400">Student progress will appear here. (Phase 5+)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base text-slate-700">Billing & Enrollments</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-slate-400">Enrollment and billing details will appear here. (Phase 5)</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}