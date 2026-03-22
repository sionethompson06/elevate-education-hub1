import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { X, Loader2, ShieldCheck } from "lucide-react";

const OVERRIDE_TYPES = [
  { value: "scholarship", label: "Scholarship" },
  { value: "comped", label: "Comped (Full Waiver)" },
  { value: "deferred", label: "Deferred Payment" },
  { value: "manual_offline", label: "Manual / Offline Payment" },
  { value: "payment_plan_exception", label: "Payment Plan Exception" },
  { value: "admin_exception", label: "Admin Exception" },
];

export default function OverrideModal({ enrollment, onClose, onSuccess }) {
  const [form, setForm] = useState({
    override_type: "scholarship",
    reason: "",
    amount_waived_cents: 0,
    amount_deferred_cents: 0,
    amount_due_now_cents: 0,
    effective_start_at: new Date().toISOString().split("T")[0],
    effective_end_at: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.reason.trim()) { setError("Reason is required."); return; }
    setSaving(true);
    setError(null);
    const res = await base44.functions.invoke("adminOverride", {
      action: "create",
      enrollment_id: enrollment.id,
      ...form,
      amount_waived_cents: Number(form.amount_waived_cents) * 100,
      amount_deferred_cents: Number(form.amount_deferred_cents) * 100,
      amount_due_now_cents: Number(form.amount_due_now_cents) * 100,
    });
    if (res.data?.error) { setError(res.data.error); setSaving(false); return; }
    onSuccess();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-bold text-[#1a3c5e] flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-purple-600" /> Create Payment Override
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100"><X className="w-5 h-5 text-slate-500" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <p className="text-xs text-slate-500 mb-1">Enrollment</p>
            <p className="font-semibold text-slate-800">{enrollment.program_name}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Override Type *</label>
            <select
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
              value={form.override_type}
              onChange={(e) => update("override_type", e.target.value)}
            >
              {OVERRIDE_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Reason *</label>
            <textarea
              required
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30 min-h-[70px]"
              value={form.reason}
              onChange={(e) => update("reason", e.target.value)}
              placeholder="Describe the basis for this override…"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { key: "amount_waived_cents", label: "Amount Waived ($)" },
              { key: "amount_deferred_cents", label: "Amount Deferred ($)" },
              { key: "amount_due_now_cents", label: "Due Now ($)" },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-slate-700 mb-1">{label}</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
                  value={form[key]}
                  onChange={(e) => update(key, e.target.value)}
                />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Effective Start</label>
              <input
                type="date"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
                value={form.effective_start_at}
                onChange={(e) => update("effective_start_at", e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Effective End (optional)</label>
              <input
                type="date"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
                value={form.effective_end_at}
                onChange={(e) => update("effective_end_at", e.target.value)}
              />
            </div>
          </div>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving} className="bg-purple-700 hover:bg-purple-800">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
              Apply Override
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}