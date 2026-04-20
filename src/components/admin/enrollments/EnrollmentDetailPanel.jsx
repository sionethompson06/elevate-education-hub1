import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { X, CreditCard, ShieldCheck, Pencil, Save, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { apiPatch } from "@/api/apiClient";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import EnrollmentOverridePanel from "./EnrollmentOverridePanel";

const inputCls = "w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30";
const BILLING_CYCLES = ["monthly", "annual", "one_time", "quarterly"];

function formatDate(val) {
  if (!val) return null;
  try { return format(new Date(val), "MMM d, yyyy"); } catch { return val; }
}

export default function EnrollmentDetailPanel({ enrollment, statusColors, onClose, onUpdated }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const sc = statusColors[enrollment.status] || "bg-slate-100 text-slate-500";

  const studentName = enrollment.studentFirstName
    ? `${enrollment.studentFirstName} ${enrollment.studentLastName || ""}`.trim()
    : `Student #${enrollment.studentId}`;
  const parentName = enrollment.parentFirstName
    ? `${enrollment.parentFirstName} ${enrollment.parentLastName || ""}`.trim()
    : enrollment.parentEmail || null;

  // Local display data — updated optimistically after save so panel stays open
  const [display, setDisplay] = useState({
    invoiceDescription: enrollment.invoiceDescription || "",
    invoiceAmount: enrollment.invoiceAmount,
    invoiceDueDate: enrollment.invoiceDueDate || "",
    invoicePaidDate: enrollment.invoicePaidDate || "",
    billingCycle: enrollment.billingCycle || enrollment.programBillingCycle || "",
    startDate: enrollment.startDate || "",
    status: enrollment.status,
  });

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...display });

  const setF = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleEdit = () => {
    setForm({ ...display });
    setEditing(true);
  };

  const handleCancel = () => setEditing(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiPatch(`/enrollments/${enrollment.id}/invoice`, {
        description: form.invoiceDescription,
        amount: form.invoiceAmount !== "" ? parseFloat(form.invoiceAmount) : undefined,
        dueDate: form.invoiceDueDate || null,
        paidDate: form.invoicePaidDate || null,
      });
      await apiPatch(`/enrollments/${enrollment.id}`, {
        startDate: form.startDate || null,
        billingCycleOverride: form.billingCycle || null,
      });
      // Update local display — panel stays open
      setDisplay({ ...form });
      setEditing(false);
      toast({ title: "Enrollment details updated" });
      qc.invalidateQueries({ queryKey: ["admin-enrollments"] });
    } catch (err) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="font-bold text-[#1a3c5e] text-lg">
              {enrollment.programName || `Program #${enrollment.programId}`}
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">{studentName}</p>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold capitalize mt-1 ${sc}`}>
              {display.status?.replace(/_/g, " ")}
            </span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">
          {/* Enrollment & payment details */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5" /> Enrollment & Payment Details
              </p>
              {!editing && (
                <button
                  onClick={handleEdit}
                  className="text-xs text-[#1a3c5e] flex items-center gap-1 hover:underline"
                >
                  <Pencil className="w-3 h-3" /> Edit Details
                </button>
              )}
            </div>

            <div className="bg-slate-50 rounded-xl p-4 space-y-0">
              {/* Fixed read-only rows */}
              {[
                ["Student", studentName],
                ["Parent / Guardian", parentName],
                ["Parent Email", enrollment.parentEmail],
                ["Program", enrollment.programName],
                ["Enrollment Status", display.status?.replace(/_/g, " ")],
                ["Invoice Status", enrollment.invoiceStatus?.replace(/_/g, " ")],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between py-2 border-b border-slate-100 last:border-0 gap-4">
                  <span className="text-sm text-slate-500 shrink-0">{label}</span>
                  <span className="text-sm font-medium text-slate-800 text-right">{value || "—"}</span>
                </div>
              ))}

              {/* Editable rows */}
              {editing ? (
                <>
                  {[
                    { label: "Invoice Description", key: "invoiceDescription", type: "text" },
                    { label: "Amount Due ($)", key: "invoiceAmount", type: "number" },
                    { label: "Due Date", key: "invoiceDueDate", type: "date" },
                    { label: "Pay Date", key: "invoicePaidDate", type: "date" },
                    { label: "Enrollment Date", key: "startDate", type: "date" },
                  ].map(({ label, key, type }) => (
                    <div key={key} className="flex justify-between py-2 border-b border-slate-100 gap-4 items-center">
                      <span className="text-sm text-slate-500 shrink-0">{label}</span>
                      <input
                        type={type}
                        step={type === "number" ? "0.01" : undefined}
                        min={type === "number" ? "0" : undefined}
                        className={`${inputCls} max-w-[220px]`}
                        value={form[key]}
                        onChange={setF(key)}
                      />
                    </div>
                  ))}
                  <div className="flex justify-between py-2 border-b border-slate-100 gap-4 items-center">
                    <span className="text-sm text-slate-500 shrink-0">Billing Cycle</span>
                    <select className={`${inputCls} max-w-[180px] bg-white`} value={form.billingCycle} onChange={setF("billingCycle")}>
                      <option value="">— inherit from program —</option>
                      {BILLING_CYCLES.map(c => (
                        <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2 pt-3 justify-end">
                    <button
                      onClick={handleCancel}
                      className="text-xs text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded border border-slate-200"
                    >
                      Cancel
                    </button>
                    <Button size="sm" onClick={handleSave} disabled={saving} className="bg-[#1a3c5e] hover:bg-[#0d2540] gap-1">
                      {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                      Save
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  {[
                    ["Invoice Description", display.invoiceDescription],
                    ["Amount Due", display.invoiceAmount != null ? `$${parseFloat(display.invoiceAmount).toLocaleString()}` : null],
                    ["Due Date", formatDate(display.invoiceDueDate)],
                    ["Paid Date", formatDate(display.invoicePaidDate)],
                    ["Billing Cycle", (display.billingCycle)?.replace(/_/g, " ")],
                    ["Enrollment Date", formatDate(display.startDate) || formatDate(enrollment.createdAt)],
                    ["Enrollment ID", `#${enrollment.id}`],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between py-2 border-b border-slate-100 last:border-0 gap-4">
                      <span className="text-sm text-slate-500 shrink-0">{label}</span>
                      <span className="text-sm font-medium text-slate-800 text-right">{value || "—"}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Override panel */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Override Management
            </p>
            <EnrollmentOverridePanel enrollment={enrollment} onUpdated={onUpdated} />
          </div>
        </div>
      </div>
    </div>
  );
}
