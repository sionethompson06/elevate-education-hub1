import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Clock, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export default function PendingEnrollments({ userEmail }) {
  const { data: parents = [] } = useQuery({
    queryKey: ["parent-record", userEmail],
    queryFn: () => base44.entities.Parent.filter({ user_email: userEmail }),
    enabled: !!userEmail,
  });

  const parentRecord = parents[0];
  const studentIds = parentRecord?.student_ids || [];

  const { data: enrollments = [], isLoading } = useQuery({
    queryKey: ["pending-enrollments", studentIds],
    queryFn: async () => {
      if (!studentIds.length) return [];
      const all = await Promise.all(
        studentIds.map((sid) =>
          base44.entities.Enrollment.filter({ student_id: sid, status: "pending_payment" })
        )
      );
      return all.flat();
    },
    enabled: studentIds.length > 0,
  });

  if (isLoading) return null;
  if (!enrollments.length) return null;

  return (
    <Card className="border-yellow-200 bg-yellow-50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-yellow-800 text-base">
          <AlertCircle className="w-5 h-5" />
          Action Required: Pending Enrollment{enrollments.length > 1 ? "s" : ""}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {enrollments.map((enr) => (
          <div key={enr.id} className="bg-white rounded-xl p-4 border border-yellow-200 flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-yellow-600" />
                <p className="font-medium text-slate-800">{enr.program_name}</p>
                <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs font-semibold">
                  Pending Payment
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Enrolled {enr.enrolled_date} · Payment status: {enr.payment_status}
              </p>
            </div>
            <Button size="sm" className="bg-[#1a3c5e] hover:bg-[#0d2540] shrink-0" disabled>
              Pay Now (Phase 5)
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}