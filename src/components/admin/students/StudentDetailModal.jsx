import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { X, Plus, Trash2, BookOpen, Activity, Users, Pencil, Save, Loader2, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

const GRADE_OPTIONS = ["K","1","2","3","4","5","6","7","8","9","10","11","12"];

const Row = ({ label, value }) => (
  <div className="flex gap-2 text-sm">
    <span className="text-slate-400 w-32 shrink-0">{label}</span>
    <span className="text-slate-800 font-medium">{value || "—"}</span>
  </div>
);

export default function StudentDetailModal({ student: initialStudent, onClose, onUpdated }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [addingType, setAddingType] = useState(null);
  const [coachEmail, setCoachEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingStudent, setEditingStudent] = useState(false);
  const [editingParent, setEditingParent] = useState(false);

  // Live student data (refetch after edits)
  const { data: studentData, refetch: refetchStudent } = useQuery({
    queryKey: ["student-detail", initialStudent.id],
    queryFn: () => base44.entities.Student.filter({ id: initialStudent.id }).then(r => r[0]),
    initialData: initialStudent,
  });
  const student = studentData || initialStudent;

  const [studentForm, setStudentForm] = useState({
    full_name: student.full_name || "",
    grade_level: student.grade_level || "",
    sport: student.sport || "",
    date_of_birth: student.date_of_birth || "",
    notes: student.notes || "",
    is_active: student.is_active ?? true,
  });

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

  // Load linked parent
  const { data: parents = [], refetch: refetchParent } = useQuery({
    queryKey: ["student-parents", student.id],
    queryFn: async () => {
      if (!student.parent_ids?.length) return [];
      const results = await Promise.all(
        student.parent_ids.map(pid => base44.entities.Parent.filter({ id: pid }))
      );
      return results.flat();
    },
    enabled: !!student.parent_ids?.length,
  });
  const parent = parents[0];

  const [parentForm, setParentForm] = useState(null);

  const startEditParent = () => {
    setParentForm({
      full_name: parent?.full_name || "",
      user_email: parent?.user_email || "",
      phone: parent?.phone || "",
      billing_email: parent?.billing_email || "",
      is_primary_contact: parent?.is_primary_contact ?? true,
    });
    setEditingParent(true);
  };

  const coaches = allUsers.filter(u => ["academic_coach", "performance_coach"].includes(u.role));
  const eligibleCoaches = coaches.filter(c => !addingType || c.role === addingType);

  const saveStudent = async () => {
    setSaving(true);
    await base44.entities.Student.update(student.id, studentForm);
    await refetchStudent();
    setEditingStudent(false);
    onUpdated?.();
    toast({ title: "Student info updated" });
    setSaving(false);
  };

  const saveParent = async () => {
    if (!parent) return;
    setSaving(true);
    const emailChanged = parentForm.user_email !== parent.user_email;
    await base44.entities.Parent.update(parent.id, parentForm);

    // Propagate email change to student record
    if (emailChanged && student.user_email === parent.user_email) {
      await base44.entities.Student.update(student.id, { user_email: parentForm.user_email });
    }

    // Propagate email change to enrollments
    if (emailChanged) {
      const enrs = await base44.entities.Enrollment.filter({ student_id: student.id });
      for (const enr of enrs) {
        if (enr.student_email === parent.user_email) {
          await base44.entities.Enrollment.update(enr.id, { student_email: parentForm.user_email });
        }
      }

      // Propagate to application records
      const apps = await base44.entities.Application.filter({ email: parent.user_email });
      for (const app of apps) {
        await base44.entities.Application.update(app.id, { email: parentForm.user_email, applicant_email: parentForm.user_email });
      }
    }

    await refetchParent();
    await refetchStudent();
    setEditingParent(false);
    onUpdated?.();
    toast({ title: "Parent info updated — all linked records synced." });
    setSaving(false);
  };

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
            <p className="text-xs text-slate-400">{parent?.user_email || student.user_email}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100"><X className="w-5 h-5 text-slate-500" /></button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">

          {/* ── Student Info ────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-slate-700">Student Info</h3>
              {!editingStudent && (
                <button onClick={() => setEditingStudent(true)} className="text-xs text-[#1a3c5e] flex items-center gap-1 hover:underline">
                  <Pencil className="w-3 h-3" /> Edit
                </button>
              )}
            </div>

            {editingStudent ? (
              <div className="space-y-3 bg-slate-50 rounded-xl p-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Full Name</label>
                    <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
                      value={studentForm.full_name} onChange={e => setStudentForm(f => ({ ...f, full_name: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Grade</label>
                    <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                      value={studentForm.grade_level} onChange={e => setStudentForm(f => ({ ...f, grade_level: e.target.value }))}>
                      <option value="">—</option>
                      {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g === "K" ? "Kindergarten" : `Grade ${g}`}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Sport</label>
                    <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
                      value={studentForm.sport} onChange={e => setStudentForm(f => ({ ...f, sport: e.target.value }))} placeholder="e.g. Basketball" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Date of Birth</label>
                    <input type="date" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                      value={studentForm.date_of_birth} onChange={e => setStudentForm(f => ({ ...f, date_of_birth: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Notes</label>
                  <textarea rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
                    value={studentForm.notes} onChange={e => setStudentForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={studentForm.is_active} onChange={e => setStudentForm(f => ({ ...f, is_active: e.target.checked }))} className="accent-[#1a3c5e]" />
                  Active student
                </label>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setEditingStudent(false)} className="text-xs text-slate-500 hover:text-slate-700">Cancel</button>
                  <Button size="sm" onClick={saveStudent} disabled={saving} className="bg-[#1a3c5e] hover:bg-[#0d2540]">
                    {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />} Save
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-2">
                <Row label="Full Name" value={student.full_name} />
                <Row label="Sport" value={student.sport} />
                <Row label="Grade" value={student.grade_level} />
                <Row label="Date of Birth" value={student.date_of_birth} />
                <Row label="Status" value={student.is_active ? "Active" : "Inactive"} />
                {student.notes && <Row label="Notes" value={student.notes} />}
              </div>
            )}
          </div>

          {/* ── Parent / Guardian Info ──────────── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Users className="w-4 h-4" /> Parent / Guardian
              </h3>
              {parent && !editingParent && (
                <button onClick={startEditParent} className="text-xs text-[#1a3c5e] flex items-center gap-1 hover:underline">
                  <Pencil className="w-3 h-3" /> Edit
                </button>
              )}
            </div>

            {!parent && !editingParent && (
              <p className="text-xs text-slate-400 italic">No parent linked to this student.</p>
            )}

            {parent && !editingParent && (
              <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 space-y-2">
                <p className="text-sm font-semibold text-slate-800">{parent.full_name}</p>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Mail className="w-3.5 h-3.5" /> {parent.user_email || "—"}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Phone className="w-3.5 h-3.5" /> {parent.phone || "—"}
                </div>
                {parent.billing_email && parent.billing_email !== parent.user_email && (
                  <div className="text-xs text-slate-400">Billing: {parent.billing_email}</div>
                )}
                {parent.is_primary_contact && (
                  <span className="inline-block text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Primary Contact</span>
                )}
              </div>
            )}

            {editingParent && parentForm && (
              <div className="space-y-3 bg-slate-50 rounded-xl p-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Full Name</label>
                  <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
                    value={parentForm.full_name} onChange={e => setParentForm(f => ({ ...f, full_name: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Email</label>
                    <input type="email" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
                      value={parentForm.user_email} onChange={e => setParentForm(f => ({ ...f, user_email: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Phone</label>
                    <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
                      value={parentForm.phone} onChange={e => setParentForm(f => ({ ...f, phone: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Billing Email</label>
                  <input type="email" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
                    value={parentForm.billing_email} onChange={e => setParentForm(f => ({ ...f, billing_email: e.target.value }))} placeholder="Leave blank to use email" />
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={parentForm.is_primary_contact} onChange={e => setParentForm(f => ({ ...f, is_primary_contact: e.target.checked }))} className="accent-[#1a3c5e]" />
                  Primary Contact
                </label>
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  ⚠ Saving will sync the email change across all linked enrollments and applications.
                </p>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setEditingParent(false)} className="text-xs text-slate-500 hover:text-slate-700">Cancel</button>
                  <Button size="sm" onClick={saveParent} disabled={saving} className="bg-[#1a3c5e] hover:bg-[#0d2540]">
                    {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />} Save & Sync
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* ── Enrollments ─────────────────────── */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
              <Users className="w-4 h-4" /> Enrollments ({enrollments.length})
            </h3>
            {enrollments.length === 0 ? (
              <p className="text-xs text-slate-400">No enrollments.</p>
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

          {/* ── Coach Assignments ────────────────── */}
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
                <select value={coachEmail} onChange={e => setCoachEmail(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
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