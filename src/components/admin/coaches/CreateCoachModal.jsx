import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiPost, apiPatch } from "@/api/apiClient";

export default function CreateCoachModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    role: "academic_coach",
    title: "",
    bio: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      setError("First name, last name, and email are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      // Create user + send invite email via admin invite endpoint
      const { user: createdUser } = await apiPost("/users/invite", {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim().toLowerCase(),
        role: form.role,
      });

      // Save title/bio to staff profile if provided
      if ((form.title || form.bio) && createdUser?.id) {
        await apiPatch(`/users/${createdUser.id}`, {
          title: form.title || null,
          bio: form.bio || null,
        }).catch(() => {});
      }

      onCreated?.();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to create coach.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-base font-bold text-slate-800">Create New Coach</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">First Name *</label>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
                value={form.firstName}
                onChange={e => set("firstName", e.target.value)}
                placeholder="Jane"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Last Name *</label>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
                value={form.lastName}
                onChange={e => set("lastName", e.target.value)}
                placeholder="Smith"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Email *</label>
            <input
              type="email"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
              value={form.email}
              onChange={e => set("email", e.target.value)}
              placeholder="coach@example.com"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Coach Type *</label>
            <select
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
              value={form.role}
              onChange={e => set("role", e.target.value)}
            >
              <option value="academic_coach">Academic Coach</option>
              <option value="performance_coach">Performance Coach</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Title (optional)</label>
            <input
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
              value={form.title}
              onChange={e => set("title", e.target.value)}
              placeholder="e.g. Head Math Coach"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Bio (optional)</label>
            <textarea
              rows={3}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30 resize-none"
              value={form.bio}
              onChange={e => set("bio", e.target.value)}
              placeholder="Short biography..."
            />
          </div>
          <p className="text-xs text-slate-400">An invite email will be sent automatically upon creation.</p>
          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
          )}
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1 bg-[#1a3c5e] hover:bg-[#0d2540] text-white" disabled={saving}>
              {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating…</> : "Create Coach"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
