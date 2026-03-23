import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { X, Loader2, Save, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

const Field = ({ label, value, onChange, type = "text", placeholder = "" }) => (
  <div>
    <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
    />
  </div>
);

export default function ParentEditModal({ parent, allStudents = [], onClose, onUpdated }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const isNew = !parent;

  const [form, setForm] = useState({
    full_name: parent?.full_name || "",
    user_email: parent?.user_email || "",
    billing_email: parent?.billing_email || "",
    phone: parent?.phone || "",
    is_primary_contact: parent?.is_primary_contact ?? true,
    student_ids: parent?.student_ids || [],
    notes: parent?.notes || "",
  });
  const [saving, setSaving] = useState(false);

  const set = (field, val) => setForm(f => ({ ...f, [field]: val }));

  const toggleStudent = (studentId) => {
    setForm(f => ({
      ...f,
      student_ids: f.student_ids.includes(studentId)
        ? f.student_ids.filter(id => id !== studentId)
        : [...f.student_ids, studentId],
    }));
  };

  const handleSave = async () => {
    if (!form.full_name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        await base44.entities.Parent.create({
          ...form,
          user_id: `admin_created_${Date.now()}`,
        });
        toast({ title: "Parent created successfully" });
      } else {
        await base44.entities.Parent.update(parent.id, form);

        const previousIds = parent.student_ids || [];
        const added = form.student_ids.filter(id => !previousIds.includes(id));
        const removed = previousIds.filter(id => !form.student_ids.includes(id));
        const emailChanged = form.user_email !== parent.user_email;

        // Sync all currently linked students
        for (const sid of form.student_ids) {
          const student = allStudents.find(s => s.id === sid);
          if (!student) continue;

          const studentUpdate = {};

          // Keep parent_ids in sync for newly added
          if (added.includes(sid)) {
            const updatedParentIds = [...(student.parent_ids || [])];
            if (!updatedParentIds.includes(parent.id)) updatedParentIds.push(parent.id);
            studentUpdate.parent_ids = updatedParentIds;
          }

          // Propagate email change to student's user_email
          if (emailChanged && student.user_email === parent.user_email) {
            studentUpdate.user_email = form.user_email;
          }

          if (Object.keys(studentUpdate).length > 0) {
            await base44.entities.Student.update(sid, studentUpdate);
          }

          // Propagate email change to enrollments for this student
          if (emailChanged) {
            const enrollments = await base44.entities.Enrollment.filter({ student_id: sid });
            for (const enr of enrollments) {
              if (enr.student_email === parent.user_email) {
                await base44.entities.Enrollment.update(enr.id, { student_email: form.user_email });
              }
            }
          }

          // Invalidate student detail cache so modal header email refreshes
          qc.invalidateQueries({ queryKey: ["student-detail", sid] });
        }

        // Remove parent link from unlinked students
        for (const sid of removed) {
          const student = allStudents.find(s => s.id === sid);
          if (student) {
            const updatedParentIds = (student.parent_ids || []).filter(id => id !== parent.id);
            await base44.entities.Student.update(sid, { parent_ids: updatedParentIds });
          }
          qc.invalidateQueries({ queryKey: ["student-detail", sid] });
        }

        // Propagate email change to Application records
        if (emailChanged) {
          const apps = await base44.entities.Application.filter({ email: parent.user_email });
          for (const app of apps) {
            await base44.entities.Application.update(app.id, { email: form.user_email, applicant_email: form.user_email });
          }
        }

        toast({ title: "Parent profile updated — all linked records synced." });
      }

      // Invalidate parent + student list caches
      qc.invalidateQueries({ queryKey: ["admin-parents"] });
      qc.invalidateQueries({ queryKey: ["admin-students-lookup"] });
      qc.invalidateQueries({ queryKey: ["admin-students"] });

      onUpdated();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold text-sm">
              {form.full_name?.charAt(0) || <UserPlus className="w-4 h-4" />}
            </div>
            <h2 className="font-bold text-[#1a3c5e] text-lg">
              {isNew ? "Add Parent / Guardian" : `Edit: ${parent.full_name}`}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Contact Information</p>
            <div className="space-y-3">
              <Field label="Full Name *" value={form.full_name} onChange={v => set("full_name", v)} placeholder="First Last" />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Email" value={form.user_email} onChange={v => set("user_email", v)} type="email" placeholder="parent@email.com" />
                <Field label="Phone" value={form.phone} onChange={v => set("phone", v)} placeholder="(555) 000-0000" />
              </div>
              <Field label="Billing Email" value={form.billing_email} onChange={v => set("billing_email", v)} type="email" placeholder="Same as email if blank" />
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_primary_contact}
                  onChange={e => set("is_primary_contact", e.target.checked)}
                  className="accent-[#1a3c5e]"
                />
                <span className="text-sm text-slate-700">Primary Contact</span>
              </label>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Linked Students</p>
            {allStudents.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No students in the system yet.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {allStudents.map(s => {
                  const linked = form.student_ids.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleStudent(s.id)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border-2 text-left transition-all ${
                        linked ? "border-[#1a3c5e] bg-[#1a3c5e]/5" : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${linked ? "bg-[#1a3c5e] text-white" : "bg-slate-100 text-slate-600"}`}>
                          {s.full_name?.charAt(0)}
                        </div>
                        <div>
                          <p className={`text-sm font-semibold ${linked ? "text-[#1a3c5e]" : "text-slate-700"}`}>{s.full_name}</p>
                          {(s.grade_level || s.sport) && (
                            <p className="text-xs text-slate-400">
                              {s.grade_level ? `Grade ${s.grade_level}` : ""}
                              {s.grade_level && s.sport ? " · " : ""}
                              {s.sport || ""}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${linked ? "border-[#1a3c5e] bg-[#1a3c5e]" : "border-slate-300"}`}>
                        {linked && <div className="w-2 h-2 bg-white rounded-sm" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Admin Notes</p>
            <textarea
              rows={3}
              value={form.notes}
              onChange={e => set("notes", e.target.value)}
              placeholder="Internal notes about this parent/guardian..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30 resize-none"
            />
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <Button className="flex-1 bg-[#1a3c5e] hover:bg-[#0d2540]" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            {isNew ? "Create Parent" : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}