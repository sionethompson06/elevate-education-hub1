import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { X, Loader2, UserPlus } from "lucide-react";

const PROGRAM_OPTIONS = [
  "Microschool (In-Person Hybrid)",
  "Athletic Performance Training",
  "Virtual School 1-Day",
  "Virtual School 2-Days",
];

const GRADE_OPTIONS = ["K","1","2","3","4","5","6","7","8","9","10","11","12"];

export default function AddStudentModal({ onClose, onAdded }) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    grade: "",
    sport: "",
    programInterest: "",
    notes: "",
  });

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const token = localStorage.getItem("elevate_auth_token");
      const res = await fetch("/api/students/add-my-student", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          dateOfBirth: form.dateOfBirth || null,
          grade: form.grade || null,
          sport: form.sport || null,
          programInterest: form.programInterest || null,
          notes: form.notes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Failed to add student. Please try again.");
        return;
      }
      onAdded(data.student);
    } catch (err) {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setSaving(false);
    }
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">First Name *</label>
              <input
                required
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
                value={form.firstName}
                onChange={e => set("firstName", e.target.value)}
                placeholder="First name"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Last Name *</label>
              <input
                required
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
                value={form.lastName}
                onChange={e => set("lastName", e.target.value)}
                placeholder="Last name"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Date of Birth</label>
              <input
                type="date"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
                value={form.dateOfBirth}
                onChange={e => set("dateOfBirth", e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Grade Level</label>
              <select
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
                value={form.grade}
                onChange={e => set("grade", e.target.value)}
              >
                <option value="">Select grade…</option>
                {GRADE_OPTIONS.map(g => (
                  <option key={g} value={g}>{g === "K" ? "Kindergarten" : `Grade ${g}`}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Sport (if applicable)</label>
            <input
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
              value={form.sport}
              onChange={e => set("sport", e.target.value)}
              placeholder="e.g. Basketball, Soccer…"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Program Interest</label>
            <select
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
              value={form.programInterest}
              onChange={e => set("programInterest", e.target.value)}
            >
              <option value="">Select a program…</option>
              {PROGRAM_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

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

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

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
