import { useAuth } from "@/lib/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Users, CreditCard, BookOpen, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PendingEnrollments from "@/components/parent/PendingEnrollments";

export default function ParentDashboard() {
  const { user } = useAuth();

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <p className="text-sm text-slate-500 mb-1">Parent Portal</p>
        <h1 className="text-3xl font-bold text-[#1a3c5e]">
          Welcome, {user?.full_name?.split(" ")[0] || "Parent"}!
        </h1>
      </div>

      <PendingEnrollments userEmail={user?.email} />

      <div className="grid md:grid-cols-2 gap-6 mt-6">
        <Card>
          <CardHeader><CardTitle className="text-base text-slate-700">Student Progress</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-slate-400">Student progress will appear here. (Phase 5+)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base text-slate-700">Billing History</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-slate-400">Billing details will appear here. (Phase 5)</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}