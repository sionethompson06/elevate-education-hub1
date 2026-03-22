import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { X, Loader2, Target } from "lucide-react";

export default function CreateGoalModal({ student, track, onClose, onSuccess }) {
  const [form, setForm] = useState({ title: "", description: "", target_points: 50 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { setError("Title is required"); return; }
    setSaving(true);
    const res = await base44.functions.invoke("rewards", {
      action: "create_goal",
      student_id: student.student_id,
      track,
      title: form.title,
      description: form.description,
      target_points: Number(form.target_points),
    });
    if (res.data?.error) { setError(res.data.error); setSaving(false); return; }
    onSuccess();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-bold text-[#1a3c5e] flex items-center gap-2">
            <Target className="w-4 h-4 text-blue-500" /> Create Goal
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100"><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-sm text-slate-600">Student: <strong>{student.student_name}</strong> · Track: <strong className="capitalize">{track}</strong></p>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Goal Title *</label>
            <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
              value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Complete 10 Math lessons" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Target Points</label>
            <input type="number" min="1"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
              value={form.target_points} onChange={e => setForm(f => ({ ...f, target_points: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30 min-h-[60px]"
              value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving} className="bg-[#1a3c5e] hover:bg-[#0d2540]">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Target className="w-4 h-4 mr-2" />}
              Create Goal
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}