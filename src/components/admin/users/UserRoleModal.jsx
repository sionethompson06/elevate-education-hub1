import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { X, Loader2, BookOpen, Activity, Save, Plus, Trash2, Users, GraduationCap } from "lucide-react";
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
  const [role, setRole] = useState(user.role || "user");
  const [saving, setSaving] = useState(false);
  const [assignTab, setAssignTab] = useState("individual"); // "individual" | "program"

  // Individual tab state
  const [selectedStudentId, setSelectedStudentId] = useState("");

  // Program tab state
  const [selectedProgramId, setSelectedProgramId] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("");
  const [bulkAssigning, setBulkAssigning] = useState(false);

  const isCoach = ["academic_coach", "performance_coach"].includes(role);

  const { data: existingAssignments = [], refetch: refetchAssignments } = useQuery({
    queryKey: ["coach-assignments-user", user.id],
    queryFn: () => base44.entities.CoachAssignment.filter({ coachUserId: user.id, isActive: true }),
    enabled: isCoach,
  });

  const { data: allStudents = [] } = useQuery({
    queryKey: ["all-students-for-coach"],
    queryFn: () => base44.entities.Student.list(),
    enabled: isCoach,
  });

  const { data: allPrograms = [] } = useQuery({
    queryKey: ["all-programs-for-coach"],
    queryFn: () => base44.entities.Program.filter({ is_active: true }),
    enabled: isCoach,
  });

  const { data: allEnrollments = [] } = useQuery({
    queryKey: ["all-enrollments-for-coach"],
    queryFn: () => base44.entities.Enrollment.list("-created_date", 500),
    enabled: isCoach && assignTab === "program",
  });

  const assignedStudentIds = new Set(existingAssignments.map(a => a.studentId));
  const unassignedStudents = allStudents.filter(s => !assignedStudentIds.has(s.id));

  // Derive unique grade levels from all students
  const gradeOptions = [...new Set(allStudents.map(s => s.grade).filter(Boolean))].sort();

  // Filter students by selected program & grade
  const studentsMatchingFilter = (() => {
    if (!selectedProgramId) return [];

    const enrolledStudentIds = new Set(
      allEnrollments
        .filter(e => (e.programId ?? e.program_id) === selectedProgramId && ["active", "active_override", "pending_payment"].includes(e.status))
        .map(e => e.studentId ?? e.student_id)
    );

    return allStudents.filter(s => {
      const inProgram = enrolledStudentIds.has(s.id);
      const inGrade = !selectedGrade || s.grade === selectedGrade;
      const notAssigned = !assignedStudentIds.has(s.id);
      return inProgram && inGrade && notAssigned;
    });
  })();

  const selectedProgram = allPrograms.find(p => p.id === selectedProgramId);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const studentName = (s) => s ? `${s.firstName || ''} ${s.lastName || ''}`.trim() || s.email : '';

  const handleAssignStudent = async () => {
    if (!selectedStudentId) return;
    try {
      await base44.entities.CoachAssignment.create({
        coachUserId: user.id,
        coachType: role,
        studentId: parseInt(selectedStudentId),
        isActive: true,
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
          base44.entities.CoachAssignment.create({
            coachUserId: user.id,
            coachType: role,
            studentId: student.id,
            isActive: true,
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
      await base44.entities.CoachAssignment.patch(assignmentId, { isActive: false });
      refetchAssignments();
      toast({ title: "Student removed from coach" });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.entities.User.patch(user.id, { role });
      toast({ title: "Role updated", description: `${user.firstName ? `${user.firstName} ${user.lastName}` : user.email} is now ${role}.` });
      onUpdated();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#1a3c5e] flex items-center justify-center text-white font-bold">
              {user.full_name?.charAt(0) || "?"}
            </div>
            <div>
              <h2 className="font-bold text-[#1a3c5e] text-lg">{user.full_name || user.email}</h2>
              <p className="text-xs text-slate-400">{user.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">

          {/* Role selector */}
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

          {/* Coach assignment panel */}
          {isCoach && (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              {/* Panel header */}
              <div className={`flex items-center gap-2 px-4 py-3 ${role === "academic_coach" ? "bg-blue-50 border-b border-blue-100" : "bg-orange-50 border-b border-orange-100"}`}>
                {role === "academic_coach"
                  ? <BookOpen className="w-4 h-4 text-blue-600" />
                  : <Activity className="w-4 h-4 text-orange-600" />}
                <p className="text-sm font-semibold text-slate-800">
                  {role === "academic_coach" ? "Academic Coach" : "Performance Coach"} — Student Assignments
                </p>
                <span className="ml-auto text-xs text-slate-400">{existingAssignments.length} assigned</span>
              </div>

              {/* Tab switcher */}
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
                {/* Currently assigned students (always visible) */}
                {existingAssignments.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Currently Assigned</p>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {existingAssignments.map(a => {
                        const student = allStudents.find(s => s.id === (a.studentId ?? a.student_id));
                        return (
                          <div key={a.id} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                            <div>
                              <p className="text-sm font-medium text-slate-800">{studentName(student) || `Student #${a.studentId}`}</p>
                              <p className="text-xs text-slate-400">
                                {student?.grade ? `Grade ${student.grade}` : ""}
                              </p>
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

                {/* ── Individual tab ── */}
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

                {/* ── Program & Grade tab ── */}
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

                    {/* Matched students preview */}
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

        {/* Footer */}
        <div className="flex gap-3 px-6 pb-5 shrink-0">
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
  );
}