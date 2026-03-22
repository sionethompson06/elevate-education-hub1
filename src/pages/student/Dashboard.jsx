import { useAuth } from "@/lib/AuthContext";
import { BookOpen, Award, Calendar, MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function StudentDashboard() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#1a3c5e]">
            Welcome back, {user?.full_name?.split(" ")[0] || "Student"}
          </h1>
          <p className="text-slate-500 mt-1">Student Portal — Elevate Education Hub</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: BookOpen, label: "My Lessons", value: "—", color: "text-blue-600" },
            { icon: Award, label: "Reward Points", value: "—", color: "text-yellow-500" },
            { icon: Calendar, label: "Next Session", value: "—", color: "text-green-600" },
            { icon: MessageSquare, label: "Messages", value: "—", color: "text-purple-600" },
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
            Gradebook and rewards will appear here in Phase 8 & 10.
          </p>
        </div>
      </div>
    </div>
  );
}