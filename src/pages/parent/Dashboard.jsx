import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useSearchParams, Link } from "react-router-dom";
import { CreditCard, BookOpen, Star, Calendar, MessageCircle, FileText, ChevronRight, TrendingUp, Users, PlusCircle, UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import EnrollmentStatusCard from "@/components/parent/EnrollmentStatusCard";
import PaymentSuccessBanner from "@/components/parent/PaymentSuccessBanner";
import StudentGradebook from "@/components/parent/StudentGradebook";
import ParentRewardsSummary from "@/components/parent/ParentRewardsSummary";
import AddStudentModal from "@/components/parent/AddStudentModal";

async function fetchMyStudents() {
  const token = localStorage.getItem("elevate_auth_token");
  const res = await fetch("/api/enrollments/my-students", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Failed to load students");
  return res.json(); // { students: [...], enrollments: [...] }
}

export default function ParentDashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const [showAddStudent, setShowAddStudent] = useState(false);
  const paymentStatus = searchParams.get("payment");
  const enrollmentId = searchParams.get("enrollment");

  const { data: myData = { students: [], enrollments: [] }, isLoading: enrollLoading } = useQuery({
    queryKey: ["parent-my-students", user?.id],
    queryFn: fetchMyStudents,
    enabled: !!user?.id,
  });

  const students = myData.students || [];
  const enrollments = myData.enrollments || [];

  const pendingPayment = enrollments.filter(e => ["pending_payment", "pending", "payment_failed"].includes(e.status));
  const activeEnrollments = enrollments.filter(e => ["active", "active_override"].includes(e.status));

  const handleStudentAdded = () => {
    setShowAddStudent(false);
    qc.invalidateQueries({ queryKey: ["parent-my-students"] });
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm text-slate-500 mb-1">Parent Portal</p>
          <h1 className="text-3xl font-bold text-[#1a3c5e]">
            Welcome, {user?.full_name?.split(" ")[0] || "Parent"}!
          </h1>
          <p className="text-sm text-slate-400 mt-1">Your family's complete Elevate overview.</p>
        </div>
        <Button
          onClick={() => setShowAddStudent(true)}
          className="bg-[#1a3c5e] hover:bg-[#0d2540] shrink-0"
        >
          <UserPlus className="w-4 h-4 mr-2" /> Add Student
        </Button>
      </div>

      {paymentStatus === "success" && <PaymentSuccessBanner enrollmentId={enrollmentId} />}

      {/* Payment action required */}
      {pendingPayment.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-5 py-4">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="w-4 h-4 text-yellow-600" />
            <p className="text-sm font-semibold text-yellow-800">Payment Required</p>
          </div>
          <p className="text-sm text-yellow-700 mb-3">{pendingPayment.length} enrollment{pendingPayment.length > 1 ? "s" : ""} awaiting payment.</p>
          <div className="flex flex-wrap gap-2">
            {pendingPayment.map(e => (
              <Link key={e.id} to={`/parent/checkout?enrollment_id=${e.id}`}>
                <button className="text-xs bg-[#1a3c5e] text-white px-3 py-1.5 rounded-lg hover:bg-[#0d2540] transition-colors">
                  {e.studentFirstName ? `${e.studentFirstName} — ` : ''}{e.programName || e.program_name || 'Program'}
                </button>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Enroll CTA if no active enrollments */}
      {!enrollLoading && enrollments.filter(e => ["active","active_override"].includes(e.status)).length === 0 && (
        <div className="bg-gradient-to-r from-[#1a3c5e] to-[#1a4f7a] rounded-2xl p-6 text-white flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="font-bold text-lg mb-1">Get Started — Enroll in a Program</p>
            <p className="text-slate-300 text-sm">Browse our 5 core programs and enroll your student today.</p>
          </div>
          <Link to="/parent/programs">
            <Button className="bg-yellow-400 text-[#1a3c5e] hover:bg-yellow-300 font-bold shrink-0">
              <PlusCircle className="w-4 h-4 mr-2" /> Browse Programs
            </Button>
          </Link>
        </div>
      )}

      {/* Quick nav */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
        {[
          { label: "Programs", href: "/parent/programs", icon: PlusCircle, color: "text-[#1a3c5e]", bg: "bg-slate-100" },
          { label: "Schedule", href: "/parent/schedule", icon: Calendar, color: "text-purple-600", bg: "bg-purple-50" },
          { label: "Progress", href: "/parent/progress", icon: TrendingUp, color: "text-green-600", bg: "bg-green-50" },
          { label: "Messages", href: "/parent/messages", icon: MessageCircle, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Resources", href: "/parent/resources", icon: FileText, color: "text-orange-600", bg: "bg-orange-50" },
          { label: "Billing", href: "/parent/billing", icon: CreditCard, color: "text-red-600", bg: "bg-red-50" },
        ].map(({ label, href, icon: Icon, color, bg }) => (
          <Link key={href} to={href}>
            <div className="bg-white rounded-xl border border-slate-100 p-4 hover:shadow-sm hover:border-[#1a3c5e] transition-all text-center">
              <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center mx-auto mb-2`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <p className="text-xs font-semibold text-slate-700">{label}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Active enrollments summary */}
      {activeEnrollments.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">Active Programs</h2>
          <div className="space-y-2">
            {activeEnrollments.map(e => <EnrollmentStatusCard key={e.id} enrollment={e} />)}
          </div>
        </div>
      )}

      {/* Student snapshots */}
      {students.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-2">
              <Users className="w-4 h-4" /> My Students
            </h2>
            <button
              onClick={() => setShowAddStudent(true)}
              className="text-xs text-[#1a3c5e] hover:underline flex items-center gap-1"
            >
              <UserPlus className="w-3.5 h-3.5" /> Add another student
            </button>
          </div>
          {students.map((student) => {
            const studentName = `${student.firstName} ${student.lastName}`;
            return (
              <div key={student.id} className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  {studentName}
                  {student.grade && <span className="font-normal text-slate-400">· Grade {student.grade}</span>}
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <StudentGradebook studentId={student.id} studentName={studentName} />
                  <ParentRewardsSummary studentId={student.id} studentName={studentName} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* All enrollments if none active */}
      {activeEnrollments.length === 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">All Enrollments</h2>
          {enrollLoading ? (
            <div className="flex justify-center py-8"><div className="w-5 h-5 border-4 border-slate-200 border-t-[#1a3c5e] rounded-full animate-spin" /></div>
          ) : enrollments.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-sm text-slate-400">No enrollments found.</p>
                <Link to="/apply" className="text-xs text-[#1a3c5e] hover:underline mt-2 block">Apply to a program →</Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {enrollments.map(e => <EnrollmentStatusCard key={e.id} enrollment={e} />)}
            </div>
          )}
        </div>
      )}

      {showAddStudent && (
        <AddStudentModal
          onClose={() => setShowAddStudent(false)}
          onAdded={handleStudentAdded}
        />
      )}
    </div>
  );
}