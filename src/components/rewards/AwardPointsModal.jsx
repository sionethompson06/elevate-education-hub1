import { useState } from "react";
import { apiPost } from "@/api/apiClient";
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
    setError(null);
    try {
      await apiPost("/rewards/award", {
        studentId: student.student_id,
        points: Number(points),
        reason: reason.trim(),
      });
      onSuccess();
    } catch (err) {
      setError(err.message || "Failed to award points");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-bold text-[#1a3c5e] flex items-center gap-2">
            <Star className="w-4 h-4 text-yellow-500" /> Award Points
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-sm text-slate-500">
            Awarding points to <strong>{student?.student_name || "this student"}</strong>
          </p>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Points</label>
            <input
              type="number"
              min="1"
              max="1000"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
              value={points}
              onChange={e => setPoints(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Reason *</label>
            <input
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
              placeholder="e.g. Completed all lessons this week"
              value={reason}
              onChange={e => setReason(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button type="submit" disabled={saving} className="flex-1 bg-yellow-500 hover:bg-yellow-600">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Star className="w-4 h-4 mr-1" /> Award</>}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
