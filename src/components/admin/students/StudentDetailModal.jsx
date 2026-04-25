import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet, apiPatch, apiPost } from "@/api/apiClient";
import { X, Trash2, BookOpen, Activity, Users, Pencil, Save, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const GRADE_OPTIONS = ["K","1","2","3","4","5","6","7","8","9","10","11","12"];

const Row = ({ label, value }) => (
  <div className="flex gap-2 text-sm">
    <span className="text-slate-400 w-32 shrink-0">{label}</span>
    <span className="text-slate-800 font-medium">{value || "—"}</span>
  </div>
);

export default function StudentDetailModal({ student: initialStudent, onClose, onUpdated }) {
  const { toast } = useToast();
  const [addingType, setAddingType] = useState(null);
  const [selectedCoachId, setSelectedCoachId] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingStudent, setEditingStudent] = useState(false);
  const [editingParent, setEditingParent] = useState(false);
  const [revokeTargetId, setRevokeTargetId] = useState(null);

  const { data: detail, refetch: refetchDetail } = useQuery({
    queryKey: ["student-detail", initialStudent.id],
    queryFn: () => apiGet(`/students/${initialStudent.id}`),
  });

  const student = detail?.student || initialStudent;
  const guardian = detail?.guardians?.[0] || null;

  const [studentForm, setStudentForm] = useState({
    firstName: initialStudent.firstName || "",
    lastName: initialStudent.lastName || "",
    grade: initialStudent.grade || "",
    dateOfBirth: initialStudent.dateOfBirth || "",
    status: initialStudent.status || "active",
  });

  const [parentForm, setParentForm] = useState(null);

  const { data: assignmentsData = { assignments: [] }, refetch: refetchAssignments } = useQuery({
    queryKey: ["student-assignments", initialStudent.id],
    queryFn: () => apiGet(`/coach-assignments?studentId=${initialStudent.id}`),
  });
  const assignments = assignmentsData.assignments || [];

  const { data: enrollmentsData = { enrollments: [] } } = useQuery({
    queryKey: ["student-enrollments", initialStudent.id],
    queryFn: () => apiGet(`/enrollments`),
  });
  const enrollments = (enrollmentsData.enrollments || []).filter(e => e.studentId === initialStudent.id);

  const { data: usersData } = useQuery({
    queryKey: ["all-users-coaches"],
    queryFn: () => apiGet('/users'),
  });
  const allUsers = Array.isArray(usersData) ? usersData : (usersData?.users || []);
  const coaches = allUsers.filter(u => ["academic_coach", "performance_coach"].includes(u.role));
  const eligibleCoaches = coaches.filter(c => !addingType || c.role === addingType);

  const saveStudent = async () => {
    setSaving(true);
    try {
      await apiPatch(`/students/${student.id}`, studentForm);
      await refetchDetail();
      setEditingStudent(false);
      onUpdated?.();
      toast({ title: "Student info updated" });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const saveParent = async () => {
    if (!guardian) return;
    setSaving(true);
    try {
      await apiPatch(`/users/${guardian.guardianUserId}`, {
        firstName: parentForm.firstName,
        lastName: parentForm.lastName,
        email: parentForm.email,
      });
      await refetchDetail();
      setEditingParent(false);
      onUpdated?.();
      toast({ title: "Parent info updated" });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const assignCoach = async () => {
    if (!selectedCoachId || !addingType) return;
    const coach = coaches.find(c => c.id === Number(selectedCoachId));
    if (!coach) return;
    setSaving(true);
    try {
      await apiPost('/coach-assignments', {
        coachUserId: coach.id,
        coachType: addingType,
        studentId: student.id,
      });
      setAddingType(null);
      setSelectedCoachId("");
      refetchAssignments();
      onUpdated?.();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const revokeAssignment = async (id) => {
    try {
      await apiPatch(`/coach-assignments/${id}`, { isActive: false });
      refetchAssignments();
      onUpdated?.();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const fullName = `${student.firstName || ''} ${student.lastName || ''}`.trim();
  const guardianName = guardian ? `${guardian.firstName || ''} ${guardian.lastName || ''}`.trim() : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="font-bold text-[#1a3c5e] text-lg">{fullName}</h2>
            <p className="text-xs text-slate-400">{guardian?.email || "No parent linked"}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100"><X className="w-5 h-5 text-slate-500" /></button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">

          {/* Student Info */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-slate-700">Student Info</h3>
              {!editingStudent && (
                <button onClick={() => {
                  setStudentForm({ firstName: student.firstName || "", lastName: student.lastName || "", grade: student.grade || "", dateOfBirth: student.dateOfBirth || "", status: student.status || "active" });
                  setEditingStudent(true);
                }} className="text-xs text-[#1a3c5e] flex items-center gap-1 hover:underline">
                  <Pencil className="w-3 h-3" /> Edit
                </button>
              )}
            </div>
            {editingStudent ? (
              <div className="space-y-3 bg-slate-50 rounded-xl p-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">First Name</label>
                    <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
                      value={studentForm.firstName} onChange={e => setStudentForm(f => ({ ...f, firstName: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Last Name</label>
                    <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
                      value={studentForm.lastName} onChange={e => setStudentForm(f => ({ ...f, lastName: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Grade</label>
                    <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                      value={studentForm.grade} onChange={e => setStudentForm(f => ({ ...f, grade: e.target.value }))}>
                      <option value="">—</option>
                      {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g === "K" ? "Kindergarten" : `Grade ${g}`}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Date of Birth</label>
                    <input type="date" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                      value={studentForm.dateOfBirth} onChange={e => setStudentForm(f => ({ ...f, dateOfBirth: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Status</label>
                  <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                    value={studentForm.status} onChange={e => setStudentForm(f => ({ ...f, status: e.target.value }))}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setEditingStudent(false)} className="text-xs text-slate-500 hover:text-slate-700">Cancel</button>
                  <Button size="sm" onClick={saveStudent} disabled={saving} className="bg-[#1a3c5e] hover:bg-[#0d2540]">
                    {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />} Save
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-2">
                <Row label="First Name" value={student.firstName} />
                <Row label="Last Name" value={student.lastName} />
                <Row label="Grade" value={student.grade} />
                <Row label="Date of Birth" value={student.dateOfBirth} />
                <Row label="Status" value={student.status === 'active' ? "Active" : "Inactive"} />
              </div>
            )}
          </div>

          {/* Parent / Guardian */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Users className="w-4 h-4" /> Parent / Guardian
              </h3>
              {guardian && !editingParent && (
                <button onClick={() => {
                  setParentForm({ firstName: guardian.firstName || "", lastName: guardian.lastName || "", email: guardian.email || "" });
                  setEditingParent(true);
                }} className="text-xs text-[#1a3c5e] flex items-center gap-1 hover:underline">
                  <Pencil className="w-3 h-3" /> Edit
                </button>
              )}
            </div>
            {!guardian && <p className="text-xs text-slate-400 italic">No parent linked to this student.</p>}
            {guardian && !editingParent && (
              <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 space-y-2">
                <p className="text-sm font-semibold text-slate-800">{guardianName}</p>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Mail className="w-3.5 h-3.5" /> {guardian.email || "—"}
                </div>
                <span className="inline-block text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full capitalize">{guardian.relationship}</span>
              </div>
            )}
            {editingParent && parentForm && (
              <div className="space-y-3 bg-slate-50 rounded-xl p-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">First Name</label>
                    <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
                      value={parentForm.firstName} onChange={e => setParentForm(f => ({ ...f, firstName: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Last Name</label>
                    <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
                      value={parentForm.lastName} onChange={e => setParentForm(f => ({ ...f, lastName: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Email</label>
                  <input type="email" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
                    value={parentForm.email} onChange={e => setParentForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setEditingParent(false)} className="text-xs text-slate-500 hover:text-slate-700">Cancel</button>
                  <Button size="sm" onClick={saveParent} disabled={saving} className="bg-[#1a3c5e] hover:bg-[#0d2540]">
                    {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />} Save
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Enrollments */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
              <BookOpen className="w-4 h-4" /> Enrollments ({enrollments.length})
            </h3>
            {enrollments.length === 0 ? (
              <p className="text-xs text-slate-400">No enrollments.</p>
            ) : (
              <div className="space-y-1.5">
                {enrollments.map(e => {
                  const isActive = e.status === "active" || e.status === "active_override";
                  const isPending = e.status === "pending_payment" || e.status === "pending";
                  return (
                    <div key={e.id} className="flex items-center justify-between px-3 py-2.5 bg-slate-50 rounded-lg">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800">
                          {e.programName || `Program #${e.programId}`}
                        </p>
                        {e.billingCycle && (
                          <p className="text-xs text-slate-400 capitalize mt-0.5">
                            {e.billingCycle.replace(/_/g, " ")}
                            {e.invoiceAmount && ` · $${parseFloat(e.invoiceAmount).toLocaleString()}`}
                          </p>
                        )}
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ml-2 shrink-0 ${
                        isActive ? "bg-green-100 text-green-700" :
                        isPending ? "bg-yellow-100 text-yellow-700" :
                        "bg-slate-100 text-slate-500"
                      }`}>
                        {e.status === "active_override" ? "Active" : e.status?.replace(/_/g, " ")}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Coach Assignments */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <BookOpen className="w-4 h-4" /> Coach Assignments
              </h3>
              <div className="flex gap-1">
                <button onClick={() => setAddingType("academic_coach")} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-200">+ Academic</button>
                <button onClick={() => setAddingType("performance_coach")} className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-lg hover:bg-orange-200">+ Performance</button>
              </div>
            </div>

            {addingType && (
              <div className="bg-slate-50 rounded-xl p-3 mb-3 space-y-2">
                <p className="text-xs font-semibold text-slate-600 capitalize">Assign {addingType.replace("_", " ")}</p>
                <select value={selectedCoachId} onChange={e => setSelectedCoachId(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
                  <option value="">Select coach...</option>
                  {eligibleCoaches.map(c => (
                    <option key={c.id} value={c.id}>{c.firstName} {c.lastName} ({c.email})</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <button onClick={() => { setAddingType(null); setSelectedCoachId(""); }} className="text-xs text-slate-500 hover:text-slate-700">Cancel</button>
                  <Button size="sm" onClick={assignCoach} disabled={saving || !selectedCoachId} className="bg-[#1a3c5e] hover:bg-[#0d2540] text-xs">
                    {saving ? "Assigning..." : "Assign"}
                  </Button>
                </div>
              </div>
            )}

            {assignments.filter(a => a.isActive).length === 0 ? (
              <p className="text-xs text-slate-400">No coaches assigned.</p>
            ) : (
              <div className="space-y-2">
                {assignments.filter(a => a.isActive).map(a => {
                  const coach = allUsers.find(u => u.id === a.coachUserId);
                  return (
                    <div key={a.id} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        {a.coachType === "academic_coach"
                          ? <BookOpen className="w-3.5 h-3.5 text-blue-500" />
                          : <Activity className="w-3.5 h-3.5 text-orange-500" />}
                        <div>
                          <p className="text-sm font-medium text-slate-800">
                            {coach ? `${coach.firstName} ${coach.lastName}` : `Coach #${a.coachUserId}`}
                          </p>
                          <p className="text-xs text-slate-400 capitalize">{a.coachType.replace("_", " ")}</p>
                        </div>
                      </div>
                      <button onClick={() => setRevokeTargetId(a.id)} className="text-red-400 hover:text-red-600 p-1">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <AlertDialog open={!!revokeTargetId} onOpenChange={open => !open && setRevokeTargetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove coach assignment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate the coach assignment for {fullName}. The coach will no longer have access to this student's data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => { revokeAssignment(revokeTargetId); setRevokeTargetId(null); }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
