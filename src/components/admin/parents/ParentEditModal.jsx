import { useState } from "react";
import { apiPatch, apiPost, apiDelete } from "@/api/apiClient";
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

  // Split fullName into firstName/lastName for the form
  const initialFirstName = parent?.firstName || (parent?.fullName ? parent.fullName.split(' ')[0] : '');
  const initialLastName = parent?.lastName || (parent?.fullName ? parent.fullName.split(' ').slice(1).join(' ') : '');

  const [form, setForm] = useState({
    firstName: initialFirstName,
    lastName: initialLastName,
    email: parent?.email || "",
    studentIds: parent?.studentIds || [],
  });
  const [saving, setSaving] = useState(false);

  const set = (field, val) => setForm(f => ({ ...f, [field]: val }));

  const toggleStudent = (studentId) => {
    setForm(f => ({
      ...f,
      studentIds: f.studentIds.includes(studentId)
        ? f.studentIds.filter(id => id !== studentId)
        : [...f.studentIds, studentId],
    }));
  };

  const handleSave = async () => {
    if (!form.firstName.trim()) {
      toast({ title: "First name required", variant: "destructive" });
      return;
    }
    if (!form.email.trim()) {
      toast({ title: "Email required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      let parentId;

      if (isNew) {
        // Create via invite endpoint — generates user + invite token
        const res = await apiPost('/users/invite', {
          email: form.email.trim().toLowerCase(),
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          role: 'parent',
        });
        parentId = res.user?.id;
        if (!parentId) throw new Error('Failed to create parent user');
      } else {
        parentId = parent.id;
        // Update name and email
        await apiPatch(`/users/${parentId}`, {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim().toLowerCase(),
        });
      }

      // Sync student links: add newly linked, remove unlinked
      const previousIds = parent?.studentIds || [];
      const added = form.studentIds.filter(id => !previousIds.includes(id));
      const removed = previousIds.filter(id => !form.studentIds.includes(id));

      for (const sid of added) {
        await apiPost(`/users/${parentId}/link-student`, { studentId: sid });
      }
      for (const sid of removed) {
        await apiDelete(`/users/${parentId}/unlink-student/${sid}`);
      }

      toast({
        title: isNew ? "Parent created" : "Parent updated",
        description: isNew
          ? "Account created. You can send an invite from User Management."
          : "Profile and student links updated.",
      });

      qc.invalidateQueries({ queryKey: ["admin-parents"] });
      qc.invalidateQueries({ queryKey: ["admin-students-lookup"] });
      qc.invalidateQueries({ queryKey: ["admin-students"] });

      onUpdated();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const fullName = `${form.firstName} ${form.lastName}`.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold text-sm">
              {fullName?.charAt(0) || <UserPlus className="w-4 h-4" />}
            </div>
            <h2 className="font-bold text-[#1a3c5e] text-lg">
              {isNew ? "Add Parent / Guardian" : `Edit: ${parent.fullName || fullName}`}
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
              <div className="grid grid-cols-2 gap-3">
                <Field label="First Name *" value={form.firstName} onChange={v => set("firstName", v)} placeholder="First" />
                <Field label="Last Name" value={form.lastName} onChange={v => set("lastName", v)} placeholder="Last" />
              </div>
              <Field label="Email *" value={form.email} onChange={v => set("email", v)} type="email" placeholder="parent@email.com" />
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Linked Students</p>
            {allStudents.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No students in the system yet.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {allStudents.map(s => {
                  const linked = form.studentIds.includes(s.id);
                  const displayName = s.fullName || `${s.firstName} ${s.lastName}`.trim();
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
                          {displayName?.charAt(0) || "?"}
                        </div>
                        <div>
                          <p className={`text-sm font-semibold ${linked ? "text-[#1a3c5e]" : "text-slate-700"}`}>{displayName}</p>
                          {s.grade && (
                            <p className="text-xs text-slate-400">Grade {s.grade}</p>
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
