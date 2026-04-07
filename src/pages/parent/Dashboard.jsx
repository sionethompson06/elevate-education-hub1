import { useState, useMemo } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import {
  CreditCard, Calendar, MessageCircle, FileText, TrendingUp,
  PlusCircle, UserPlus, Users, GraduationCap, User,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import EnrollmentStatusCard from "@/components/parent/EnrollmentStatusCard";
import PaymentSuccessBanner from "@/components/parent/PaymentSuccessBanner";
import StudentGradebook from "@/components/parent/StudentGradebook";
import ParentRewardsSummary from "@/components/parent/ParentRewardsSummary";
import AddStudentModal from "@/components/parent/AddStudentModal";
import StudentProfileModal from "@/components/parent/StudentProfileModal";

async function fetchMyStudents() {
  const token = localStorage.getItem("elevate_auth_token");
  const res = await fetch("/api/enrollments/my-students", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Failed to load students");
  return res.json(); // { students: [...], enrollments: [...] }
}

const COACH_TYPE_LABELS = {
  academic_coach: "Academic",
  performance_coach: "Performance",
};

export default function ParentDashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [profileStudent, setProfileStudent] = useState(null);
  const paymentStatus = searchParams.get("payment");
  const enrollmentId = searchParams.get("enrollment");

  const { data: myData = { students: [], enrollments: [] }, isLoading: enrollLoading } = useQuery({
    queryKey: ["parent-my-students", user?.id],
    queryFn: fetchMyStudents,
    enabled: !!user?.id,
  });

  const students = myData.students || [];
  const enrollments = myData.enrollments || [];

  const pendingPayment = enrollments.filter(e =>
    ["pending_payment", "pending", "payment_failed"].includes(e.status)
  );

  // Group enrollments by studentId for the student-centric view
  const enrollmentsByStudent = useMemo(() => {
    const map = {};
    for (const e of enrollments) {
      if (!map[e.studentId]) map[e.studentId] = [];
      map[e.studentId].push(e);
    }
    return map;
  }, [enrollments]);

  // Enrollments not linked to any student in our students list (edge case)
  const orphanedEnrollments = useMemo(() => {
    const studentIdSet = new Set(students.map(s => s.id));
    return enrollments.filter(e => !studentIdSet.has(e.studentId));
  }, [enrollments, students]);

  const handleStudentAdded = () => {
    setShowAddStudent(false);
    qc.invalidateQueries({ queryKey: ["parent-my-students"] });
  };

  const handleProfileUpdated = () => {
    setProfileStudent(null);
    qc.invalidateQueries({ queryKey: ["parent-my-students"] });
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm text-slate-500 mb-1">Parent Portal</p>
          <h1 className="text-3xl font-bold text-[#1a3c5e]">
            Welcome, {user?.firstName || user?.full_name?.split(" ")[0] || "Parent"}!
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
          <p className="text-sm text-yellow-700 mb-3">
            {pendingPayment.length} enrollment{pendingPayment.length > 1 ? "s" : ""} awaiting payment.
          </p>
          <div className="flex flex-wrap gap-2">
            {pendingPayment.map(e => (
              <Link key={e.id} to={`/parent/checkout?enrollment_id=${e.id}`}>
                <button className="text-xs bg-[#1a3c5e] text-white px-3 py-1.5 rounded-lg hover:bg-[#0d2540] transition-colors">
                  {e.studentFirstName ? `${e.studentFirstName} — ` : ""}
                  {e.programName || "Program"}
                </button>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Enroll CTA if no enrollments at all */}
      {!enrollLoading && enrollments.length === 0 && (
        <div className="bg-gradient-to-r from-[#1a3c5e] to-[#1a4f7a] rounded-2xl p-6 text-white flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="font-bold text-lg mb-1">Get Started — Enroll in a Program</p>
            <p className="text-slate-300 text-sm">Browse our core programs and enroll your student today.</p>
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
          { label: "Programs",  href: "/parent/programs",  icon: PlusCircle,     color: "text-[#1a3c5e]", bg: "bg-slate-100" },
          { label: "Schedule",  href: "/parent/schedule",  icon: Calendar,       color: "text-purple-600", bg: "bg-purple-50" },
          { label: "Progress",  href: "/parent/progress",  icon: TrendingUp,     color: "text-green-600",  bg: "bg-green-50" },
          { label: "Messages",  href: "/parent/messages",  icon: MessageCircle,  color: "text-blue-600",   bg: "bg-blue-50" },
          { label: "Resources", href: "/parent/resources", icon: FileText,       color: "text-orange-600", bg: "bg-orange-50" },
          { label: "Billing",   href: "/parent/billing",   icon: CreditCard,     color: "text-red-600",    bg: "bg-red-50" },
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

      {/* ── Family Overview — one card per student ── */}
      {enrollLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-4 border-slate-200 border-t-[#1a3c5e] rounded-full animate-spin" />
        </div>
      ) : students.length > 0 ? (
        <div className="space-y-4">
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

          {students.map(student => {
            const studentName = `${student.firstName} ${student.lastName}`;
            const studentEnrollments = enrollmentsByStudent[student.id] || [];
            const activeEnrollments = studentEnrollments.filter(e =>
              ["active", "active_override"].includes(e.status)
            );
            const pendingEnrollments = studentEnrollments.filter(e =>
              ["pending_payment", "pending", "payment_failed"].includes(e.status)
            );
            const coaches = student.coaches || [];

            return (
              <div key={student.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                {/* Student header */}
                <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#1a3c5e] flex items-center justify-center text-white font-bold text-sm shrink-0">
                      {student.firstName?.charAt(0)}{student.lastName?.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">{studentName}</p>
                      <div className="flex items-center gap-3 flex-wrap">
                        {student.grade && (
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <GraduationCap className="w-3 h-3" /> Grade {student.grade}
                          </span>
                        )}
                        {coaches.length > 0 && coaches.map((c, i) => (
                          <span key={i} className="text-xs text-slate-500 flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {COACH_TYPE_LABELS[c.coachType] || "Coach"}: {c.coachFirstName} {c.coachLastName}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setProfileStudent(student)}
                    className="text-xs text-[#1a3c5e] border border-[#1a3c5e]/30 hover:bg-[#1a3c5e]/5 px-3 py-1.5 rounded-lg transition-colors font-medium"
                  >
                    View / Edit Profile
                  </button>
                </div>

                <div className="p-5 space-y-5">
                  {/* Programs */}
                  {studentEnrollments.length > 0 ? (
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Enrolled Programs</p>
                      <div className="space-y-2">
                        {studentEnrollments.map(e => (
                          <EnrollmentStatusCard key={e.id} enrollment={e} />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-sm text-slate-400 mb-3">Not yet enrolled in any programs.</p>
                      <Link to="/parent/programs">
                        <Button size="sm" className="bg-[#1a3c5e] hover:bg-[#0d2540]">
                          <PlusCircle className="w-3.5 h-3.5 mr-1.5" /> Browse Programs
                        </Button>
                      </Link>
                    </div>
                  )}

                  {/* Gradebook & Rewards */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <StudentGradebook studentId={student.id} studentName={studentName} />
                    <ParentRewardsSummary studentId={student.id} studentName={studentName} />
                  </div>
                </div>
              </div>
            );
          })}

          {/* Orphaned enrollments (linked to students not in guardian_students) */}
          {orphanedEnrollments.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Other Enrollments</h3>
              <div className="space-y-2">
                {orphanedEnrollments.map(e => <EnrollmentStatusCard key={e.id} enrollment={e} />)}
              </div>
            </div>
          )}
        </div>
      ) : !enrollLoading && enrollments.length > 0 ? (
        /* Students list empty but enrollments exist — show flat list as fallback */
        <div>
          <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">All Enrollments</h2>
          <div className="space-y-3">
            {enrollments.map(e => <EnrollmentStatusCard key={e.id} enrollment={e} />)}
          </div>
        </div>
      ) : !enrollLoading && students.length === 0 && enrollments.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-slate-400 mb-2">No students or enrollments yet.</p>
            <button onClick={() => setShowAddStudent(true)} className="text-xs text-[#1a3c5e] hover:underline">
              Add your first student →
            </button>
          </CardContent>
        </Card>
      ) : null}

      {showAddStudent && (
        <AddStudentModal
          onClose={() => setShowAddStudent(false)}
          onAdded={handleStudentAdded}
        />
      )}

      {profileStudent && (
        <StudentProfileModal
          student={profileStudent}
          onClose={() => setProfileStudent(null)}
          onUpdated={handleProfileUpdated}
        />
      )}
    </div>
  );
}
