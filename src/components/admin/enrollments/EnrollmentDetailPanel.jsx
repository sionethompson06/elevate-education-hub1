import { useState } from "react";
import { X, CreditCard, ShieldCheck, Pencil, Save, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { apiPatch } from "@/api/apiClient";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import EnrollmentOverridePanel from "./EnrollmentOverridePanel";

const Row = ({ label, value }) => (
  <div className="flex justify-between py-2 border-b border-slate-100 last:border-0 gap-4">
    <span className="text-sm text-slate-500 shrink-0">{label}</span>
    <span className="text-sm font-medium text-slate-800 text-right">{value || "—"}</span>
  </div>
);

const inputCls = "w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30";

const BILLING_CYCLES = ["monthly", "annual", "one_time", "quarterly"];

export default function EnrollmentDetailPanel({ enrollment, statusColors, onClose, onUpdated }) {
  const { toast } = useToast();
  const sc = statusColors[enrollment.status] || "bg-slate-100 text-slate-500";
  const studentName = enrollment.studentFirstName
    ? `${enrollment.studentFirstName} ${enrollment.studentLastName || ""}`.trim()
    : `Student #${enrollment.studentId}`;
  const parentName = enrollment.parentFirstName
    ? `${enrollment.parentFirstName} ${enrollment.parentLastName || ""}`.trim()
    : enrollment.parentEmail || null;

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    invoiceDescription: enrollment.invoiceDescription || "",
    invoiceAmount: enrollment.invoiceAmount != null ? String(parseFloat(enrollment.invoiceAmount)) : "",
    invoiceDueDate: enrollment.invoiceDueDate || "",
    invoicePaidDate: enrollment.invoicePaidDate || "",
    billingCycle: enrollment.billingCycle || enrollment.programBillingCycle || "",
    startDate: enrollment.startDate || "",
  });

  const setF = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiPatch(`/enrollments/${enrollment.id}/invoice`, {
        description: form.invoiceDescription,
        amount: form.invoiceAmount ? parseFloat(form.invoiceAmount) : undefined,
        dueDate: form.invoiceDueDate || null,
        paidDate: form.invoicePaidDate || null,
      });
      await apiPatch(`/enrollments/${enrollment.id}`, {
        startDate: form.startDate || null,
        billingCycleOverride: form.billingCycle || null,
      });
      toast({ title: "Enrollment details updated" });
      setEditing(false);
      onUpdated();
    } catch (err) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setForm({
      invoiceDescription: enrollment.invoiceDescription || "",
      invoiceAmount: enrollment.invoiceAmount != null ? String(parseFloat(enrollment.invoiceAmount)) : "",
      invoiceDueDate: enrollment.invoiceDueDate || "",
      invoicePaidDate: enrollment.invoicePaidDate || "",
      billingCycle: enrollment.billingCycle || enrollment.programBillingCycle || "",
      startDate: enrollment.startDate || "",
    });
    setEditing(false);
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
              {enrollment.status?.replace(/_/g, " ")}
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
                  onClick={() => setEditing(true)}
                  className="text-xs text-[#1a3c5e] flex items-center gap-1 hover:underline"
                >
                  <Pencil className="w-3 h-3" /> Edit Details
                </button>
              )}
            </div>

            <div className="bg-slate-50 rounded-xl p-4">
              <Row label="Student" value={studentName} />
              <Row label="Parent / Guardian" value={parentName} />
              <Row label="Parent Email" value={enrollment.parentEmail} />
              <Row label="Program" value={enrollment.programName} />
              <Row label="Enrollment Status" value={enrollment.status?.replace(/_/g, " ")} />
              <Row label="Invoice Status" value={enrollment.invoiceStatus?.replace(/_/g, " ")} />

              {editing ? (
                <>
                  {/* Editable fields */}
                  <div className="flex justify-between py-2 border-b border-slate-100 gap-4 items-center">
                    <span className="text-sm text-slate-500 shrink-0">Invoice Description</span>
                    <input className={`${inputCls} max-w-[240px]`} value={form.invoiceDescription} onChange={setF("invoiceDescription")} />
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100 gap-4 items-center">
                    <span className="text-sm text-slate-500 shrink-0">Amount Due ($)</span>
                    <input type="number" step="0.01" min="0" className={`${inputCls} max-w-[160px]`} value={form.invoiceAmount} onChange={setF("invoiceAmount")} />
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100 gap-4 items-center">
                    <span className="text-sm text-slate-500 shrink-0">Due Date</span>
                    <input type="date" className={`${inputCls} max-w-[180px]`} value={form.invoiceDueDate} onChange={setF("invoiceDueDate")} />
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100 gap-4 items-center">
                    <span className="text-sm text-slate-500 shrink-0">Pay Date</span>
                    <input type="date" className={`${inputCls} max-w-[180px]`} value={form.invoicePaidDate} onChange={setF("invoicePaidDate")} />
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100 gap-4 items-center">
                    <span className="text-sm text-slate-500 shrink-0">Billing Cycle</span>
                    <select className={`${inputCls} max-w-[180px] bg-white`} value={form.billingCycle} onChange={setF("billingCycle")}>
                      <option value="">— inherit from program —</option>
                      {BILLING_CYCLES.map(c => (
                        <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100 gap-4 items-center">
                    <span className="text-sm text-slate-500 shrink-0">Enrollment Date</span>
                    <input type="date" className={`${inputCls} max-w-[180px]`} value={form.startDate} onChange={setF("startDate")} />
                  </div>
                  <Row label="Enrollment ID" value={`#${enrollment.id}`} />

                  <div className="flex gap-2 mt-3 justify-end">
                    <button onClick={handleCancel} className="text-xs text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded border border-slate-200">
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
                  <Row label="Invoice Description" value={enrollment.invoiceDescription} />
                  <Row
                    label="Amount Due"
                    value={enrollment.invoiceAmount != null ? `$${parseFloat(enrollment.invoiceAmount).toLocaleString()}` : null}
                  />
                  <Row label="Due Date" value={enrollment.invoiceDueDate} />
                  <Row label="Paid Date" value={enrollment.invoicePaidDate} />
                  <Row label="Billing Cycle" value={(enrollment.billingCycle || enrollment.programBillingCycle)?.replace(/_/g, " ")} />
                  <Row
                    label="Enrolled Date"
                    value={enrollment.startDate || (enrollment.createdAt ? format(new Date(enrollment.createdAt), "MMM d, yyyy") : null)}
                  />
                  <Row label="Enrollment ID" value={`#${enrollment.id}`} />
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
