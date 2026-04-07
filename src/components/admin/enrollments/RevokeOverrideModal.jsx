import { useState } from "react";
import { apiPatch } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { X, Loader2, AlertTriangle } from "lucide-react";

export default function RevokeOverrideModal({ override, onClose, onSuccess }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) { setError("Revoke reason is required."); return; }
    setSaving(true);
    setError(null);
    try {
      await apiPatch(`/enrollments/overrides/${override.id}/revoke`, {
        revokeReason: reason.trim(),
      });
      onSuccess();
    } catch (err) {
      setError(err.message || "Failed to revoke override.");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-bold text-red-700 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" /> Revoke Override
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
            Revoking this override will revert the enrollment to{" "}
            <strong>Pending Payment</strong> and require the parent to complete payment.
            Any waived invoices will be re-opened.
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Revoke Reason *</label>
            <textarea
              required
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 min-h-[80px]"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Explain why this override is being revoked…"
            />
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving} className="bg-red-600 hover:bg-red-700">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <AlertTriangle className="w-4 h-4 mr-2" />}
              Confirm Revoke
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
