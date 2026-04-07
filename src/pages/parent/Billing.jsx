import { useAuth } from "@/lib/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { CreditCard, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import EnrollmentStatusCard from "@/components/parent/EnrollmentStatusCard";
import PaymentHistory from "@/components/parent/PaymentHistory";

export default function Billing() {
  const { user } = useAuth();

  const { data: parents = [] } = useQuery({
    queryKey: ["parent-record", user?.email],
    queryFn: () => base44.entities.Parent.filter({ user_email: user.email }),
    enabled: !!user?.email,
  });
  const parent = parents[0];
  const studentIds = parent?.student_ids || [];

  const { data: enrollments = [], isLoading } = useQuery({
    queryKey: ["billing-enrollments", studentIds],
    queryFn: async () => {
      if (!studentIds.length) return [];
      const all = await Promise.all(studentIds.map(sid => base44.entities.Enrollment.filter({ student_id: sid })));
      return all.flat();
    },
    enabled: studentIds.length > 0,
  });

  const pending = enrollments.filter(e => ["pending_payment", "pending", "payment_failed"].includes(e.status));

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <p className="text-sm text-slate-500 mb-1">Parent Portal</p>
        <h1 className="text-3xl font-bold text-[#1a3c5e]">Billing & Payments</h1>
      </div>

      {pending.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-5 py-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-yellow-600" />
            <p className="text-sm font-semibold text-yellow-800">Action Required</p>
          </div>
          <p className="text-sm text-yellow-700 mb-3">{pending.length} enrollment{pending.length > 1 ? "s" : ""} require payment.</p>
          <div className="space-y-2">
            {pending.map(e => (
              <Link key={e.id} to={`/parent/checkout?enrollment_id=${e.id}`}>
                <Button size="sm" className="bg-[#1a3c5e] hover:bg-[#0d2540] mr-2">
                  <CreditCard className="w-4 h-4 mr-1" /> Pay for {e.program_name}
                </Button>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold text-slate-700 mb-3">All Enrollments</h2>
        {isLoading ? (
          <div className="flex justify-center py-8"><div className="w-5 h-5 border-4 border-slate-200 border-t-[#1a3c5e] rounded-full animate-spin" /></div>
        ) : enrollments.length === 0 ? (
          <Card><CardContent className="py-8 text-center"><p className="text-sm text-slate-400">No enrollments found.</p></CardContent></Card>
        ) : (
          <div className="space-y-3">
            {enrollments.map(e => <EnrollmentStatusCard key={e.id} enrollment={e} />)}
          </div>
        )}
      </div>

      <PaymentHistory />
    </div>
  );
}