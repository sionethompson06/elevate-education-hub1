import { useState } from "react";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/api/apiClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X, Loader2, BookOpen, Activity, Save, Plus, Trash2, Users, GraduationCap, Send, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

const ROLES = [
  { value: "user",              label: "User / Parent",     desc: "Default role for parents/guardians" },
  { value: "parent",            label: "Parent",            desc: "Parent portal access" },
  { value: "student",           label: "Student",           desc: "Student portal access" },
  { value: "academic_coach",    label: "Academic Coach",    desc: "Academic coach portal access" },
  { value: "performance_coach", label: "Performance Coach", desc: "Performance coach portal access" },
  { value: "admin",             label: "Admin",             desc: "Full admin access" },
];

export default function UserRoleModal({ user, onClose, onUpdated }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [role, setRole] = useState(user.role || "user");
  const [saving, setSaving] = useState(false);
  const [resending, setResending] = useState(false);
  const [inviteUrl, setInviteUrl] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [assignTab, setAssignTab] = useState("individual");

  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedProgramId, setSelectedProgramId] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("");
  const [bulkAssigning, setBulkAssigning] = useState(false);

  const isCoach = ["academic_coach", "performance_coach"].includes(role);

  const { data: assignmentsData = { assignments: [] }, refetch: refetchAssignments } = useQuery({
    queryKey: ["coach-assignments-user", user.id],
    queryFn: () => apiGet(`/coach-assignments?coachUserId=${user.id}&isActive=true`),
    enabled: isCoach,
  });
  const existingAssignments = assignmentsData.assignments || [];

  const { data: studentsData = { students: [] } } = useQuery({
    queryKey: ["all-students-for-coach"],
    queryFn: () => apiGet('/students'),
    enabled: isCoach,
  });
  const allStudents = studentsData.students || [];

  const { data: programsData = { programs: [] } } = useQuery({
    queryKey: ["all-programs-for-coach"],
    queryFn: () => apiGet('/programs'),
    enabled: isCoach,
  });
  const allPrograms = (programsData.programs || []).filter(p => p.status === 'active');

  const { data: enrollmentsData = { enrollments: [] } } = useQuery({
    queryKey: ["all-enrollments-for-coach"],
    queryFn: () => apiGet('/enrollments'),
    enabled: isCoach && assignTab === "program",
  });
  const allEnrollments = enrollmentsData.enrollments || [];

  const assignedStudentIds = new Set(existingAssignments.map(a => a.studentId));
  const unassignedStudents = allStudents.filter(s => !assignedStudentIds.has(s.id));

  const gradeOptions = [...new Set(allStudents.map(s => s.grade).filter(Boolean))].sort();

  const studentsMatchingFilter = (() => {
    if (!selectedProgramId) return [];
    const programIdNum = parseInt(selectedProgramId);
    const enrolledStudentIds = new Set(
      allEnrollments
        .filter(e => e.programId === programIdNum && ["active", "active_override", "pending_payment"].includes(e.status))
        .map(e => e.studentId)
    );
    return allStudents.filter(s => {
      const inProgram = enrolledStudentIds.has(s.id);
      const inGrade = !selectedGrade || s.grade === selectedGrade;
      const notAssigned = !assignedStudentIds.has(s.id);
      return inProgram && inGrade && notAssigned;
    });
  })();

  const selectedProgram = allPrograms.find(p => p.id === parseInt(selectedProgramId));

  const studentName = (s) => s ? `${s.firstName || ''} ${s.lastName || ''}`.trim() || s.email : '';

  const handleAssignStudent = async () => {
    if (!selectedStudentId) return;
    try {
      await apiPost('/coach-assignments', {
        coachUserId: user.id,
        coachType: role,
        studentId: parseInt(selectedStudentId),
        startDate: new Date().toISOString().split("T")[0],
      });
      setSelectedStudentId("");
      refetchAssignments();
      toast({ title: "Student assigned" });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleBulkAssign = async () => {
    if (studentsMatchingFilter.length === 0) return;
    setBulkAssigning(true);
    const today = new Date().toISOString().split("T")[0];
    try {
      await Promise.all(
        studentsMatchingFilter.map(student =>
          apiPost('/coach-assignments', {
            coachUserId: user.id,
            coachType: role,
            studentId: student.id,
            startDate: today,
          })
        )
      );
      refetchAssignments();
      toast({ title: `${studentsMatchingFilter.length} student(s) assigned`, description: `Program: ${selectedProgram?.name}${selectedGrade ? ` · Grade ${selectedGrade}` : ""}` });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setBulkAssigning(false);
  };

  const handleRemoveAssignment = async (assignmentId) => {
    try {
      await apiPatch(`/coach-assignments/${assignmentId}`, { isActive: false });
      refetchAssignments();
      toast({ title: "Student removed from coach" });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleResendInvite = async () => {
    setResending(true);
    setInviteUrl(null);
    try {
      const res = await apiPost(`/users/${user.id}/send-invite`, {});
      const url = res.registerUrl || res.inviteUrl;
      if (res.emailSent) {
        toast({ title: "Invite email sent!", description: `Sent to ${user.email}.` });
      } else if (url) {
        setInviteUrl(url);
      }
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setResending(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiPatch(`/users/${user.id}`, { role });
      toast({ title: "Role updated", description: `${user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user.email} is now ${role}.` });
      qc.invalidateQueries({ queryKey: ["admin-all-users"] });
      onUpdated();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const handleArchive = async () => {
    setDeleting(true);
    try {
      await apiDelete(`/users/${user.id}`);
      toast({ title: "User archived", description: `${user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user.email} has been archived.` });
      onUpdated();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const displayName = user.firstName
    ? `${user.firstName} ${user.lastName || ''}`.trim()
    : user.email;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">

        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#1a3c5e] flex items-center justify-center text-white font-bold">
              {displayName?.charAt(0)?.toUpperCase() || "?"}
            </div>
            <div>
              <h2 className="font-bold text-[#1a3c5e] text-lg">{displayName}</h2>
              <p className="text-xs text-slate-400">{user.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Assign Role</label>
            <div className="space-y-2">
              {ROLES.map(r => (
                <button
                  key={r.value}
                  onClick={() => setRole(r.value)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 text-left transition-all ${
                    role === r.value ? "border-[#1a3c5e] bg-[#1a3c5e]/5" : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div>
                    <p className={`text-sm font-semibold ${role === r.value ? "text-[#1a3c5e]" : "text-slate-800"}`}>{r.label}</p>
                    <p className="text-xs text-slate-400">{r.desc}</p>
                  </div>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    role === r.value ? "border-[#1a3c5e] bg-[#1a3c5e]" : "border-slate-300"
                  }`}>
                    {role === r.value && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {isCoach && (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className={`flex items-center gap-2 px-4 py-3 ${role === "academic_coach" ? "bg-blue-50 border-b border-blue-100" : "bg-orange-50 border-b border-orange-100"}`}>
                {role === "academic_coach"
                  ? <BookOpen className="w-4 h-4 text-blue-600" />
                  : <Activity className="w-4 h-4 text-orange-600" />}
                <p className="text-sm font-semibold text-slate-800">
                  {role === "academic_coach" ? "Academic Coach" : "Performance Coach"} — Student Assignments
                </p>
                <span className="ml-auto text-xs text-slate-400">{existingAssignments.length} assigned</span>
              </div>

              <div className="flex border-b border-slate-100">
                <button
                  onClick={() => setAssignTab("individual")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
                    assignTab === "individual" ? "bg-white text-[#1a3c5e] border-b-2 border-[#1a3c5e]" : "text-slate-500 hover:text-slate-700 bg-slate-50"
                  }`}
                >
                  <Users className="w-3.5 h-3.5" /> Individual Students
                </button>
                <button
                  onClick={() => setAssignTab("program")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
                    assignTab === "program" ? "bg-white text-[#1a3c5e] border-b-2 border-[#1a3c5e]" : "text-slate-500 hover:text-slate-700 bg-slate-50"
                  }`}
                >
                  <GraduationCap className="w-3.5 h-3.5" /> By Program & Grade
                </button>
              </div>

              <div className="p-4 space-y-3">
                {existingAssignments.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Currently Assigned</p>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {existingAssignments.map(a => {
                        const student = allStudents.find(s => s.id === a.studentId);
                        return (
                          <div key={a.id} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                            <div>
                              <p className="text-sm font-medium text-slate-800">{studentName(student) || `Student #${a.studentId}`}</p>
                              <p className="text-xs text-slate-400">{student?.grade ? `Grade ${student.grade}` : ""}</p>
                            </div>
                            <button onClick={() => handleRemoveAssignment(a.id)} className="text-red-400 hover:text-red-600 p-1">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {assignTab === "individual" && (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Add Student</p>
                    {unassignedStudents.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">All active students are already assigned.</p>
                    ) : (
                      <div className="flex gap-2">
                        <select
                          value={selectedStudentId}
                          onChange={e => setSelectedStudentId(e.target.value)}
                          className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
                        >
                          <option value="">Select a student…</option>
                          {unassignedStudents.map(s => (
                            <option key={s.id} value={s.id}>
                              {studentName(s)}{s.grade ? ` (Grade ${s.grade})` : ""}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={handleAssignStudent}
                          disabled={!selectedStudentId}
                          className="flex items-center gap-1 px-3 py-1.5 bg-[#1a3c5e] text-white text-xs rounded-lg disabled:opacity-40 hover:bg-[#0d2540]"
                        >
                          <Plus className="w-3.5 h-3.5" /> Assign
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {assignTab === "program" && (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Filter by Program & Grade</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Program</label>
                        <select
                          value={selectedProgramId}
                          onChange={e => setSelectedProgramId(e.target.value)}
                          className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
                        >
                          <option value="">All programs</option>
                          {allPrograms.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Grade Level</label>
                        <select
                          value={selectedGrade}
                          onChange={e => setSelectedGrade(e.target.value)}
                          className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
                        >
                          <option value="">All grades</option>
                          {gradeOptions.map(g => (
                            <option key={g} value={g}>Grade {g}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {selectedProgramId && (
                      <div>
                        {studentsMatchingFilter.length === 0 ? (
                          <p className="text-xs text-slate-400 italic py-2">
                            No unassigned students match this program{selectedGrade ? ` and grade ${selectedGrade}` : ""}.
                          </p>
                        ) : (
                          <>
                            <p className="text-xs text-slate-500 mb-2">
                              <span className="font-semibold text-slate-700">{studentsMatchingFilter.length}</span> student(s) will be assigned:
                            </p>
                            <div className="max-h-28 overflow-y-auto space-y-1 mb-3">
                              {studentsMatchingFilter.map(s => (
                                <div key={s.id} className="flex items-center gap-2 text-xs text-slate-600 bg-blue-50 border border-blue-100 rounded-lg px-2 py-1.5">
                                  <GraduationCap className="w-3 h-3 text-blue-400 shrink-0" />
                                  <span className="font-medium">{studentName(s)}</span>
                                  {s.grade && <span className="text-slate-400">· Grade {s.grade}</span>}
                                </div>
                              ))}
                            </div>
                            <button
                              onClick={handleBulkAssign}
                              disabled={bulkAssigning}
                              className="w-full flex items-center justify-center gap-2 py-2 bg-[#1a3c5e] text-white text-sm rounded-lg hover:bg-[#0d2540] disabled:opacity-50"
                            >
                              {bulkAssigning
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : <Plus className="w-4 h-4" />}
                              Assign All {studentsMatchingFilter.length} Student(s)
                            </button>
                          </>
                        )}
                      </div>
                    )}

                    {!selectedProgramId && (
                      <p className="text-xs text-slate-400 italic">Select a program above to preview matching students.</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 pb-5 shrink-0 space-y-2">
          <Button
            variant="outline"
            className="w-full border-slate-200 text-slate-600 hover:bg-slate-50 gap-2"
            onClick={handleResendInvite}
            disabled={resending}
          >
            {resending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Resend Invite / Reset Password Link
          </Button>
          {inviteUrl && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1.5">
              <p className="text-xs font-semibold text-amber-800">Email not configured — copy &amp; share this link:</p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={inviteUrl}
                  className="flex-1 text-xs bg-white border border-amber-200 rounded-lg px-2 py-1.5 text-slate-700 font-mono truncate"
                />
                <button
                  onClick={() => { navigator.clipboard.writeText(inviteUrl); toast({ title: "Copied!" }); }}
                  className="shrink-0 text-xs px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium"
                >
                  Copy
                </button>
              </div>
              <p className="text-xs text-amber-600">This link expires in 7 days.</p>
            </div>
          )}

          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full py-2.5 rounded-xl border border-red-200 text-sm text-red-500 hover:bg-red-50 flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" /> Archive User
            </button>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-700">Archive this user?</p>
                  <p className="text-xs text-red-600 mt-0.5">
                    {displayName} will be archived and can no longer log in. Their data is preserved and an admin can restore them later.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleArchive}
                  disabled={deleting}
                  className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  Yes, Archive
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <Button
              className="flex-1 bg-[#1a3c5e] hover:bg-[#0d2540]"
              onClick={handleSave}
              disabled={saving || role === user.role}
            >
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              {role === user.role ? "No Changes" : "Save Role"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
