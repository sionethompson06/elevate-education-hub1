import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { X, Loader2, Star } from "lucide-react";

export default function AwardPointsModal({ student, track, onClose, onSuccess }) {
  const [points, setPoints] = useState(10);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) { setError("Reason is required"); return; }
    setSaving(true);
    const res = await base44.functions.invoke("rewards", {
      action: "award_points",
      student_id: student.student_id,
      track,
      points: Number(points),
      reason,
      source_type: "manual_award",
    });
    if (res.data?.error) { setError(res.data.error); setSaving(false); return; }
    onSuccess();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-bold text-[#1a3c5e] flex items-center gap-2">
            <Star className="w-4 h-4 text-yellow-500" /> Award {track === 'academic' ? 'Academic' : 'Performance'} Points
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100"><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-sm text-slate-600">Student: <strong>{student.student_name}</strong></p>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Points</label>
            <input type="number" min="1" max="1000"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
              value={points} onChange={e => setPoints(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Reason *</label>
            <textarea
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30 min-h-[70px]"
              value={reason} onChange={e => setReason(e.target.value)}
              placeholder="Why are these points being awarded?" />
          </div>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving} className="bg-yellow-500 hover:bg-yellow-600">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Star className="w-4 h-4 mr-2" />}
              Award Points
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}