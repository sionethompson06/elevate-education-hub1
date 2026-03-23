import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { X, Loader2, UserPlus } from "lucide-react";

const PROGRAM_OPTIONS = [
  "Microschool (In-Person Hybrid)",
  "Athletic Performance Training",
  "Virtual Homeschool Support",
];

const GRADE_OPTIONS = ["K","1","2","3","4","5","6","7","8","9","10","11","12"];

export default function AddStudentModal({ parent, onClose, onAdded }) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    date_of_birth: "",
    grade_level: "",
    sport: "",
    program_interest: "",
    notes: "",
  });

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    let currentParent = parent;

    // If no parent record exists yet, create one
    if (!currentParent) {
      currentParent = await base44.entities.Parent.create({
        user_id: user.id,
        user_email: user.email,
        full_name: user.full_name || user.email,
        student_ids: [],
        is_primary_contact: true,
        billing_email: user.email,
      });
    }

    // Create student
    const student = await base44.entities.Student.create({
      user_id: user.id,
      user_email: user.email,
      full_name: `${form.first_name.trim()} ${form.last_name.trim()}`,
      date_of_birth: form.date_of_birth || undefined,
      grade_level: form.grade_level || undefined,
      sport: form.sport || undefined,
      parent_ids: [currentParent.id],
      is_active: true,
      notes: form.notes || "",
    });

    // Link student to parent
    const updatedIds = [...(currentParent.student_ids || []), student.id];
    await base44.entities.Parent.update(currentParent.id, { student_ids: updatedIds });

    setSaving(false);
    onAdded();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-[#1a3c5e]" />
            <h2 className="font-bold text-[#1a3c5e] text-lg">Add a Student</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">First Name *</label>
              <input
                required
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
                value={form.first_name}
                onChange={e => set("first_name", e.target.value)}
                placeholder="First name"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Last Name *</label>
              <input
                required
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
                value={form.last_name}
                onChange={e => set("last_name", e.target.value)}
                placeholder="Last name"
              />
            </div>
          </div>

          {/* DOB + Grade */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Date of Birth</label>
              <input
                type="date"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
                value={form.date_of_birth}
                onChange={e => set("date_of_birth", e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Grade Level</label>
              <select
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
                value={form.grade_level}
                onChange={e => set("grade_level", e.target.value)}
              >
                <option value="">Select grade…</option>
                {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g === "K" ? "Kindergarten" : `Grade ${g}`}</option>)}
              </select>
            </div>
          </div>

          {/* Sport */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Sport (if applicable)</label>
            <input
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
              value={form.sport}
              onChange={e => set("sport", e.target.value)}
              placeholder="e.g. Basketball, Soccer…"
            />
          </div>

          {/* Program Interest */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Program Interest</label>
            <select
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
              value={form.program_interest}
              onChange={e => set("program_interest", e.target.value)}
            >
              <option value="">Select a program…</option>
              {PROGRAM_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Additional Notes</label>
            <textarea
              rows={2}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30 resize-none"
              value={form.notes}
              onChange={e => set("notes", e.target.value)}
              placeholder="Any additional information…"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <Button type="submit" disabled={saving} className="flex-1 bg-[#1a3c5e] hover:bg-[#0d2540]">
              {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : "Add Student"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}