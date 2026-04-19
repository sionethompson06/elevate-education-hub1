import { useState } from "react";
import { apiPost } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { X, Loader2, BookOpen } from "lucide-react";

const SUBJECTS = ["Math", "English", "Science", "History", "Reading", "Writing", "PE", "General"];

export default function CreateLessonModal({ assignedStudents, onClose, onSuccess }) {
  const [form, setForm] = useState({
    title: "",
    subject: "General",
    instructions: "",
    due_at: "",
    points_possible: 10,
    student_ids: [],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const toggle = (id) => setForm(f => ({
    ...f,
    student_ids: f.student_ids.includes(id) ? f.student_ids.filter(x => x !== id) : [...f.student_ids, id],
  }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { setError("Title is required"); return; }
    if (!form.student_ids.length) { setError("Select at least one student"); return; }
    setSaving(true);
    setError(null);
    try {
      await apiPost("/gradebook/lessons", {
        title: form.title,
        subject: form.subject,
        instructions: form.instructions,
        due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
        points_possible: Number(form.points_possible),
        student_ids: form.student_ids,
      });
      onSuccess();
    } catch (err) {
      setError(err.message || "Failed to assign lesson");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-bold text-[#1a3c5e] flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-600" /> Assign Lesson
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100"><X className="w-5 h-5 text-slate-500" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
            <input
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Lesson title…"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
              <select
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
                value={form.subject}
                onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
              >
                {SUBJECTS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Points Possible</label>
              <input
                type="number" min="0"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
                value={form.points_possible}
                onChange={e => setForm(f => ({ ...f, points_possible: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
            <input
              type="datetime-local"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
              value={form.due_at}
              onChange={e => setForm(f => ({ ...f, due_at: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Instructions</label>
            <textarea
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30 min-h-[70px]"
              value={form.instructions}
              onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))}
              placeholder="Describe the assignment…"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Assign to Students * ({form.student_ids.length} selected)
            </label>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {assignedStudents.map(s => (
                <label key={s.student_id} className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={form.student_ids.includes(s.student_id)}
                    onChange={() => toggle(s.student_id)}
                    className="rounded"
                  />
                  <span className="text-sm text-slate-800">{s.student_name}</span>
                  {s.kpis?.intervention && (
                    <span className="text-xs text-red-600 font-medium">⚠ Intervention</span>
                  )}
                </label>
              ))}
            </div>
          </div>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving} className="bg-[#1a3c5e] hover:bg-[#0d2540]">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BookOpen className="w-4 h-4 mr-2" />}
              Assign Lesson
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
