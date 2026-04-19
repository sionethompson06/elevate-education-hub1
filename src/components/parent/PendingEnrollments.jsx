import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/api/apiClient";
import { Clock, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function PendingEnrollments({ userId }) {
  const { data, isLoading } = useQuery({
    queryKey: ["my-enrollments", userId],
    queryFn: () => apiGet('/enrollments/my-students'),
    enabled: !!userId,
  });

  const enrollments = (data?.enrollments || []).filter(e => e.status === "pending_payment");

  if (isLoading || !enrollments.length) return null;

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
                <p className="font-medium text-slate-800">{enr.programName || `Program #${enr.programId}`}</p>
                <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs font-semibold">
                  Pending Payment
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {enr.studentFirstName} {enr.studentLastName}
              </p>
            </div>
            <a href={`/parent/checkout?enrollment_id=${enr.id}`}>
              <Button size="sm" className="bg-[#1a3c5e] hover:bg-[#0d2540] shrink-0">
                Pay Now
              </Button>
            </a>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
