import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import {
  CreditCard, Calendar, MessageCircle, FileText, TrendingUp,
  PlusCircle, UserPlus, Users, GraduationCap, User,
  ChevronDown, ChevronUp, Heart, Phone, Pencil, Trash2, Plus, Check, X, Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { isPast } from "date-fns";
import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from "@/api/apiClient";
import EnrollmentStatusCard from "@/components/parent/EnrollmentStatusCard";
import PaymentSuccessBanner from "@/components/parent/PaymentSuccessBanner";
import StudentGradebook from "@/components/parent/StudentGradebook";
import ParentRewardsSummary from "@/components/parent/ParentRewardsSummary";
import AddStudentModal from "@/components/parent/AddStudentModal";
import StudentProfileModal from "@/components/parent/StudentProfileModal";
import AnnouncementBanner from "@/components/AnnouncementBanner";

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

function useStudentStats(studentId) {
  const { data } = useQuery({
    queryKey: ["student-progress-stats", studentId],
    queryFn: () => apiGet(`/progress/student/${studentId}`),
    staleTime: 5 * 60 * 1000,
  });
  return useMemo(() => {
    if (!data) return { overdue: 0, complete: 0, total: 0 };
    const scoredIds = new Set(
      (data.submissions || []).filter(s => s.score !== null).map(s => s.assignmentId)
    );
    const total = (data.assignments || []).length;
    const complete = scoredIds.size;
    const overdue = (data.assignments || []).filter(
      a => a.dueDate && isPast(new Date(a.dueDate)) && !scoredIds.has(a.id)
    ).length;
    return { overdue, complete, total };
  }, [data]);
}

function MedicalEmergencySection({ studentId }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingContactId, setEditingContactId] = useState(null);
  const [editContact, setEditContact] = useState({});
  const [addingContact, setAddingContact] = useState(false);
  const [newContact, setNewContact] = useState({ name: "", relationship: "", phone: "" });
  const [savingContact, setSavingContact] = useState(false);
  const [editingMedical, setEditingMedical] = useState(false);
  const [medicalForm, setMedicalForm] = useState({});
  const [savingMedical, setSavingMedical] = useState(false);

  const { data: contactsData, refetch: refetchContacts } = useQuery({
    queryKey: ["emergency-contacts", studentId],
    queryFn: () => apiGet(`/students/${studentId}/emergency-contacts`),
    enabled: open,
  });
  const contacts = contactsData?.emergencyContacts || [];

  const { data: medicalData, refetch: refetchMedical } = useQuery({
    queryKey: ["medical-info", studentId],
    queryFn: () => apiGet(`/students/${studentId}/medical-info`),
    enabled: open,
  });
  const medicalInfo = medicalData?.medicalInfo || null;

  const saveNewContact = async () => {
    if (!newContact.name.trim() || !newContact.phone.trim()) return;
    setSavingContact(true);
    try {
      await apiPost(`/students/${studentId}/emergency-contacts`, newContact);
      setNewContact({ name: "", relationship: "", phone: "" });
      setAddingContact(false);
      refetchContacts();
      toast({ title: "Contact added" });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSavingContact(false);
    }
  };

  const saveEditContact = async (id) => {
    setSavingContact(true);
    try {
      await apiPatch(`/students/${studentId}/emergency-contacts/${id}`, editContact);
      setEditingContactId(null);
      refetchContacts();
      toast({ title: "Contact updated" });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSavingContact(false);
    }
  };

  const deleteContact = async (id) => {
    try {
      await apiDelete(`/students/${studentId}/emergency-contacts/${id}`);
      refetchContacts();
      toast({ title: "Contact removed" });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const saveMedical = async () => {
    setSavingMedical(true);
    try {
      await apiPut(`/students/${studentId}/medical-info`, medicalForm);
      setEditingMedical(false);
      refetchMedical();
      toast({ title: "Medical info saved" });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSavingMedical(false);
    }
  };

  const startEditMedical = () => {
    setMedicalForm({
      allergies: medicalInfo?.allergies || "",
      medications: medicalInfo?.medications || "",
      medicalConditions: medicalInfo?.medicalConditions || "",
      doctorName: medicalInfo?.doctorName || "",
      doctorPhone: medicalInfo?.doctorPhone || "",
      notes: medicalInfo?.notes || "",
    });
    setEditingMedical(true);
  };

  return (
    <div className="border-t border-slate-100 pt-4">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-700 uppercase tracking-wide w-full text-left">
        <Heart className="w-3.5 h-3.5 text-rose-400" />
        Medical & Emergency
        {open ? <ChevronUp className="w-3.5 h-3.5 ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 ml-auto" />}
      </button>

      {open && (
        <div className="mt-4 space-y-5">
          {/* Emergency Contacts */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-600 flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> Emergency Contacts</p>
              <button onClick={() => setAddingContact(true)} className="text-xs text-[#1a3c5e] hover:underline flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>

            {addingContact && (
              <div className="mb-3 p-3 border border-slate-200 rounded-lg space-y-2 bg-slate-50">
                <div className="grid grid-cols-3 gap-2">
                  <input className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                    placeholder="Name *" value={newContact.name} onChange={e => setNewContact(f => ({ ...f, name: e.target.value }))} />
                  <input className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                    placeholder="Relationship" value={newContact.relationship} onChange={e => setNewContact(f => ({ ...f, relationship: e.target.value }))} />
                  <input className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                    placeholder="Phone *" value={newContact.phone} onChange={e => setNewContact(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div className="flex gap-2">
                  <button onClick={saveNewContact} disabled={savingContact || !newContact.name.trim() || !newContact.phone.trim()}
                    className="text-xs bg-[#1a3c5e] text-white px-3 py-1.5 rounded-lg hover:bg-[#0d2540] disabled:opacity-50 flex items-center gap-1">
                    {savingContact ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Save
                  </button>
                  <button onClick={() => setAddingContact(false)} className="text-xs text-slate-500 hover:text-slate-700">Cancel</button>
                </div>
              </div>
            )}

            {contacts.length === 0 && !addingContact ? (
              <p className="text-xs text-slate-400">No emergency contacts on file.</p>
            ) : (
              <div className="space-y-2">
                {contacts.map(c => (
                  <div key={c.id} className="border border-slate-100 rounded-lg p-2.5 bg-white">
                    {editingContactId === c.id ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-3 gap-2">
                          <input className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                            value={editContact.name ?? c.name} onChange={e => setEditContact(f => ({ ...f, name: e.target.value }))} />
                          <input className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                            value={editContact.relationship ?? c.relationship} onChange={e => setEditContact(f => ({ ...f, relationship: e.target.value }))} />
                          <input className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                            value={editContact.phone ?? c.phone} onChange={e => setEditContact(f => ({ ...f, phone: e.target.value }))} />
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => saveEditContact(c.id)} disabled={savingContact}
                            className="text-xs bg-[#1a3c5e] text-white px-3 py-1 rounded-lg hover:bg-[#0d2540] flex items-center gap-1">
                            {savingContact ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Save
                          </button>
                          <button onClick={() => setEditingContactId(null)} className="text-xs text-slate-500">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-medium text-slate-700">{c.name}</p>
                          <p className="text-xs text-slate-400">{c.relationship && `${c.relationship} · `}{c.phone}</p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => { setEditingContactId(c.id); setEditContact({}); }}
                            className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"><Pencil className="w-3 h-3" /></button>
                          <button onClick={() => deleteContact(c.id)}
                            className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Medical Info */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-600">Medical Information</p>
              {!editingMedical && (
                <button onClick={startEditMedical} className="text-xs text-[#1a3c5e] hover:underline flex items-center gap-1">
                  <Pencil className="w-3 h-3" /> {medicalInfo ? "Edit" : "Add"}
                </button>
              )}
            </div>

            {editingMedical ? (
              <div className="border border-slate-200 rounded-lg p-3 space-y-2 bg-slate-50">
                {[
                  ["allergies", "Allergies"],
                  ["medications", "Medications"],
                  ["medicalConditions", "Medical Conditions"],
                  ["doctorName", "Doctor Name"],
                  ["doctorPhone", "Doctor Phone"],
                  ["notes", "Additional Notes"],
                ].map(([field, label]) => (
                  <div key={field}>
                    <label className="block text-xs text-slate-500 mb-0.5">{label}</label>
                    <input className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#1a3c5e]/30"
                      value={medicalForm[field] || ""} onChange={e => setMedicalForm(f => ({ ...f, [field]: e.target.value }))} />
                  </div>
                ))}
                <div className="flex gap-2 pt-1">
                  <button onClick={saveMedical} disabled={savingMedical}
                    className="text-xs bg-[#1a3c5e] text-white px-3 py-1.5 rounded-lg hover:bg-[#0d2540] flex items-center gap-1">
                    {savingMedical ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Save
                  </button>
                  <button onClick={() => setEditingMedical(false)} className="text-xs text-slate-500">Cancel</button>
                </div>
              </div>
            ) : medicalInfo ? (
              <div className="border border-slate-100 rounded-lg p-3 bg-white space-y-1.5 text-xs text-slate-600">
                {medicalInfo.allergies && <p><span className="font-medium">Allergies:</span> {medicalInfo.allergies}</p>}
                {medicalInfo.medications && <p><span className="font-medium">Medications:</span> {medicalInfo.medications}</p>}
                {medicalInfo.medicalConditions && <p><span className="font-medium">Conditions:</span> {medicalInfo.medicalConditions}</p>}
                {medicalInfo.doctorName && <p><span className="font-medium">Doctor:</span> {medicalInfo.doctorName}{medicalInfo.doctorPhone && ` · ${medicalInfo.doctorPhone}`}</p>}
                {medicalInfo.notes && <p><span className="font-medium">Notes:</span> {medicalInfo.notes}</p>}
              </div>
            ) : (
              <p className="text-xs text-slate-400">No medical information on file.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StudentCard({ student, studentEnrollments, onViewProfile }) {
  const stats = useStudentStats(student.id);
  const studentName = `${student.firstName} ${student.lastName}`;
  const coaches = student.coaches || [];
  const hasOverdue = stats.overdue > 0;

  return (
    <div className={`bg-white border rounded-2xl overflow-hidden shadow-sm ${hasOverdue ? "border-amber-300" : "border-slate-200"}`}>
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
              {coaches.map((c, i) => (
                <span key={i} className="text-xs text-slate-500 flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {COACH_TYPE_LABELS[c.coachType] || "Coach"}: {c.coachFirstName} {c.coachLastName}
                </span>
              ))}
            </div>
            {stats.total > 0 && (
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {stats.overdue > 0 && (
                  <span className="text-xs font-semibold text-red-600">{stats.overdue} overdue</span>
                )}
                <span className="text-xs text-green-600">{stats.complete} complete</span>
                <span className="text-xs text-slate-400">{stats.total} total</span>
              </div>
            )}
          </div>
        </div>
        <button
          onClick={onViewProfile}
          className="text-xs text-[#1a3c5e] border border-[#1a3c5e]/30 hover:bg-[#1a3c5e]/5 px-3 py-1.5 rounded-lg transition-colors font-medium"
        >
          View / Edit Profile
        </button>
      </div>

      <div className="p-5 space-y-5">
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
        <div className="grid md:grid-cols-2 gap-4">
          <StudentGradebook studentId={student.id} studentName={studentName} />
          <ParentRewardsSummary studentId={student.id} studentName={studentName} />
        </div>
        <MedicalEmergencySection studentId={student.id} />
      </div>
    </div>
  );
}

export default function ParentDashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [profileStudent, setProfileStudent] = useState(null);
  const paymentStatus = searchParams.get("payment");
  const enrollmentId = searchParams.get("enrollment");
  const sessionId = searchParams.get("session_id");

  // On success redirect: verify payment with Stripe and activate enrollment if needed
  useEffect(() => {
    if (paymentStatus === "success" && enrollmentId && sessionId && user?.id) {
      apiPost("/stripe/verify-payment", { enrollment_id: Number(enrollmentId), session_id: sessionId })
        .then(() => {
          qc.invalidateQueries({ queryKey: ["parent-my-students"] });
          qc.invalidateQueries({ queryKey: ["enrollment-detail", enrollmentId] });
        })
        .catch(err => console.error("[verify-payment]", err));
    }
  }, [paymentStatus, enrollmentId, sessionId, user?.id]);

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
      <AnnouncementBanner />
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
          { label: "Billing",   href: "/parent/payments",  icon: CreditCard,     color: "text-red-600",    bg: "bg-red-50" },
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

          {students.map(student => (
            <StudentCard
              key={student.id}
              student={student}
              studentEnrollments={enrollmentsByStudent[student.id] || []}
              onViewProfile={() => setProfileStudent(student)}
            />
          ))}

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
