import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { X, Loader2, BookOpen, Activity, Save, Plus, Trash2 } from "lucide-react";
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
  const [selectedStudentId, setSelectedStudentId] = useState("");

  const isCoach = ["academic_coach", "performance_coach"].includes(role);

  const { data: existingAssignments = [], refetch: refetchAssignments } = useQuery({
    queryKey: ["coach-assignments-user", user.id],
    queryFn: () => base44.entities.CoachAssignment.filter({ coach_user_id: user.id, is_active: true }),
    enabled: isCoach,
  });

  const { data: allStudents = [] } = useQuery({
    queryKey: ["all-students-for-coach"],
    queryFn: () => base44.entities.Student.filter({ is_active: true }),
    enabled: isCoach,
  });

  const assignedStudentIds = new Set(existingAssignments.map(a => a.student_id));
  const unassignedStudents = allStudents.filter(s => !assignedStudentIds.has(s.id));

  const handleAssignStudent = async () => {
    if (!selectedStudentId) return;
    const student = allStudents.find(s => s.id === selectedStudentId);
    if (!student) return;

    await base44.entities.CoachAssignment.create({
      coach_user_id: user.id,
      coach_email: user.email,
      coach_type: role,
      student_id: student.id,
      student_email: student.user_email || "",
      is_active: true,
      assigned_date: new Date().toISOString().split("T")[0],
    });
    setSelectedStudentId("");
    refetchAssignments();
    toast({ title: "Student assigned" });
  };

  const handleRemoveAssignment = async (assignmentId) => {
    await base44.entities.CoachAssignment.update(assignmentId, { is_active: false });
    refetchAssignments();
    toast({ title: "Student removed from coach" });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.entities.User.update(user.id, { role });

      await base44.entities.AuditLog.create({
        actor_email: "admin",
        action: "user_role_updated",
        resource_type: "User",
        resource_id: user.id,
        description: `Role updated to "${role}" for ${user.email}`,
        timestamp: new Date().toISOString(),
        severity: "info",
      });

      toast({ title: "Role updated", description: `${user.full_name || user.email} is now ${role}.` });
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
                    role === r.value
                      ? "border-[#1a3c5e] bg-[#1a3c5e]/5"
                      : "border-slate-200 hover:border-slate-300"
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

          {/* Coach student assignment */}
          {isCoach && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                {role === "academic_coach"
                  ? <BookOpen className="w-4 h-4 text-blue-600" />
                  : <Activity className="w-4 h-4 text-orange-600" />}
                <p className="text-sm font-semibold text-blue-800">
                  {role === "academic_coach" ? "Academic Coach" : "Performance Coach"} — Student Assignments
                </p>
              </div>

              {/* Assigned students */}
              {existingAssignments.length > 0 && (
                <div className="space-y-1">
                  {existingAssignments.map(a => {
                    const student = allStudents.find(s => s.id === a.student_id);
                    return (
                      <div key={a.id} className="flex items-center justify-between bg-white border border-blue-200 rounded-lg px-3 py-2">
                        <div>
                          <p className="text-sm font-medium text-slate-800">{student?.full_name || a.student_email}</p>
                          <p className="text-xs text-slate-400">{a.student_email}</p>
                        </div>
                        <button
                          onClick={() => handleRemoveAssignment(a.id)}
                          className="text-red-400 hover:text-red-600 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Assign new student */}
              {unassignedStudents.length > 0 && (
                <div className="flex gap-2">
                  <select
                    value={selectedStudentId}
                    onChange={e => setSelectedStudentId(e.target.value)}
                    className="flex-1 border border-blue-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
                  >
                    <option value="">Select a student…</option>
                    {unassignedStudents.map(s => (
                      <option key={s.id} value={s.id}>{s.full_name}</option>
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

              {unassignedStudents.length === 0 && allStudents.length > 0 && existingAssignments.length === allStudents.length && (
                <p className="text-xs text-blue-600">All students are assigned to this coach.</p>
              )}
            </div>
          )}
        </div>

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