import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X, Loader2, UserCheck, BookOpen, Activity, Save } from "lucide-react";
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

  // Coach profile state
  const [coachNotes, setCoachNotes] = useState("");
  const isCoach = ["academic_coach", "performance_coach"].includes(role);

  // Fetch existing coach profile if coach role
  const { data: existingAssignments = [] } = useQuery({
    queryKey: ["coach-assignments-user", user.id],
    queryFn: () => base44.entities.CoachAssignment.filter({ coach_user_id: user.id, is_active: true }),
    enabled: ["academic_coach", "performance_coach"].includes(user.role),
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.auth.updateMe ? null : null; // not available for other users
      // Update via User entity directly
      await base44.entities.User.update(user.id, { role });

      // If assigning a coach role for the first time, log it
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
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

        <div className="px-6 py-5 space-y-5">
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
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    role === r.value ? "border-[#1a3c5e] bg-[#1a3c5e]" : "border-slate-300"
                  }`}>
                    {role === r.value && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Coach info panel */}
          {isCoach && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                {role === "academic_coach"
                  ? <BookOpen className="w-4 h-4 text-blue-600" />
                  : <Activity className="w-4 h-4 text-orange-600" />}
                <p className="text-sm font-semibold text-blue-800">
                  {role === "academic_coach" ? "Academic Coach" : "Performance Coach"} Setup
                </p>
              </div>
              <p className="text-xs text-blue-700">
                Setting this role grants access to the coach portal. You can then assign students to this coach from the <strong>Students</strong> page by clicking on a student → Coach Assignments.
              </p>
              {existingAssignments.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-blue-700 mb-1">Currently assigned students:</p>
                  <div className="flex flex-wrap gap-1">
                    {existingAssignments.map(a => (
                      <span key={a.id} className="text-xs bg-white border border-blue-200 text-blue-700 px-2 py-0.5 rounded-full">
                        {a.student_email}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3 px-6 pb-5">
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