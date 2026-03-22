import { useAuth } from "@/lib/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useSearchParams } from "react-router-dom";
import EnrollmentStatusCard from "@/components/parent/EnrollmentStatusCard";
import PaymentHistory from "@/components/parent/PaymentHistory";
import PaymentSuccessBanner from "@/components/parent/PaymentSuccessBanner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ParentDashboard() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const paymentStatus = searchParams.get("payment");
  const enrollmentId = searchParams.get("enrollment");

  const { data: parents = [] } = useQuery({
    queryKey: ["parent-record", user?.email],
    queryFn: () => base44.entities.Parent.filter({ user_email: user.email }),
    enabled: !!user?.email,
  });
  const parent = parents[0];
  const studentIds = parent?.student_ids || [];

  const { data: enrollments = [], isLoading } = useQuery({
    queryKey: ["all-enrollments", studentIds],
    queryFn: async () => {
      if (!studentIds.length) return [];
      const all = await Promise.all(
        studentIds.map((sid) => base44.entities.Enrollment.filter({ student_id: sid }))
      );
      return all.flat();
    },
    enabled: studentIds.length > 0,
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <p className="text-sm text-slate-500 mb-1">Parent Portal</p>
        <h1 className="text-3xl font-bold text-[#1a3c5e]">
          Welcome, {user?.full_name?.split(" ")[0] || "Parent"}!
        </h1>
      </div>

      {paymentStatus === "success" && <PaymentSuccessBanner enrollmentId={enrollmentId} />}

      {/* Enrollments section */}
      <div>
        <h2 className="text-lg font-semibold text-slate-700 mb-3">Enrollments</h2>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-5 h-5 border-4 border-slate-200 border-t-[#1a3c5e] rounded-full animate-spin" />
          </div>
        ) : enrollments.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-sm text-slate-400">No enrollments found. Contact admissions to get started.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {enrollments.map((e) => (
              <EnrollmentStatusCard key={e.id} enrollment={e} />
            ))}
          </div>
        )}
      </div>

      {/* Payment history */}
      <PaymentHistory />

      {/* Placeholder sections */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base text-slate-700">Student Progress</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-slate-400">Student progress will appear here. (Phase 6+)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base text-slate-700">Upcoming Sessions</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-slate-400">Upcoming sessions will appear here. (Phase 7)</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}