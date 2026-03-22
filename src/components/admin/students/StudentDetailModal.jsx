import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { X, Plus, Trash2, BookOpen, Activity, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

const Row = ({ label, value }) => (
  <div className="flex gap-2 text-sm">
    <span className="text-slate-400 w-32 shrink-0">{label}</span>
    <span className="text-slate-800 font-medium">{value || "—"}</span>
  </div>
);

export default function StudentDetailModal({ student, onClose, onUpdated }) {
  const qc = useQueryClient();
  const [addingType, setAddingType] = useState(null);
  const [coachEmail, setCoachEmail] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: assignments = [], refetch: refetchAssignments } = useQuery({
    queryKey: ["student-assignments", student.id],
    queryFn: () => base44.entities.CoachAssignment.filter({ student_id: student.id }),
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ["student-enrollments", student.id],
    queryFn: () => base44.entities.Enrollment.filter({ student_id: student.id }),
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ["all-coaches"],
    queryFn: () => base44.entities.User.list("-created_date", 100),
  });

  const coaches = allUsers.filter(u => ["academic_coach", "performance_coach"].includes(u.role));
  const eligibleCoaches = coaches.filter(c =>
    !addingType || c.role === addingType
  );

  const assignCoach = async () => {
    if (!coachEmail || !addingType) return;
    const coach = coaches.find(c => c.email === coachEmail);
    if (!coach) return;
    setSaving(true);
    await base44.entities.CoachAssignment.create({
      coach_user_id: coach.id,
      coach_email: coach.email,
      coach_type: addingType,
      student_id: student.id,
      student_email: student.user_email,
      is_active: true,
      assigned_date: new Date().toISOString().split("T")[0],
    });
    setSaving(false);
    setAddingType(null);
    setCoachEmail("");
    refetchAssignments();
    onUpdated?.();
  };

  const revokeAssignment = async (id) => {
    await base44.entities.CoachAssignment.update(id, { is_active: false });
    refetchAssignments();
    onUpdated?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="font-bold text-[#1a3c5e] text-lg">{student.full_name}</h2>
            <p className="text-xs text-slate-400">{student.user_email}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100"><X className="w-5 h-5 text-slate-500" /></button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">
          {/* Student info */}
          <div className="grid sm:grid-cols-2 gap-2">
            <Row label="Sport" value={student.sport} />
            <Row label="Grade" value={student.grade_level} />
            <Row label="Date of Birth" value={student.date_of_birth} />
            <Row label="Status" value={student.is_active ? "Active" : "Inactive"} />
          </div>

          {/* Enrollments */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
              <Users className="w-4 h-4" /> Enrollments ({enrollments.length})
            </h3>
            {enrollments.length === 0 ? (
              <p className="text-xs text-slate-400">No active enrollments.</p>
            ) : (
              <div className="space-y-1">
                {enrollments.map(e => (
                  <div key={e.id} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg text-sm">
                    <span className="font-medium text-slate-800">{e.program_name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${e.status === "active" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>{e.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Coach assignments */}
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
                <select
                  value={coachEmail}
                  onChange={e => setCoachEmail(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                >
                  <option value="">Select coach...</option>
                  {eligibleCoaches.map(c => (
                    <option key={c.id} value={c.email}>{c.full_name} ({c.email})</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <button onClick={() => { setAddingType(null); setCoachEmail(""); }} className="text-xs text-slate-500 hover:text-slate-700">Cancel</button>
                  <Button size="sm" onClick={assignCoach} disabled={saving || !coachEmail} className="bg-[#1a3c5e] hover:bg-[#0d2540] text-xs">
                    {saving ? "Assigning..." : "Assign"}
                  </Button>
                </div>
              </div>
            )}

            {assignments.filter(a => a.is_active).length === 0 ? (
              <p className="text-xs text-slate-400">No coaches assigned.</p>
            ) : (
              <div className="space-y-2">
                {assignments.filter(a => a.is_active).map(a => (
                  <div key={a.id} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      {a.coach_type === "academic_coach"
                        ? <BookOpen className="w-3.5 h-3.5 text-blue-500" />
                        : <Activity className="w-3.5 h-3.5 text-orange-500" />}
                      <div>
                        <p className="text-sm font-medium text-slate-800">{a.coach_email}</p>
                        <p className="text-xs text-slate-400 capitalize">{a.coach_type.replace("_", " ")}</p>
                      </div>
                    </div>
                    <button onClick={() => revokeAssignment(a.id)} className="text-red-400 hover:text-red-600 p-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}