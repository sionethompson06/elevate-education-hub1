import { useState } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { X, CreditCard, ShieldCheck, Pencil, Save, X as XIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { apiPatch, apiGet } from "@/api/apiClient";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import EnrollmentOverridePanel from "./EnrollmentOverridePanel";

const BILLING_CYCLES = ["monthly", "annual", "one_time", "quarterly"];

function safeDate(val) {
  if (!val) return "—";
  try { return format(new Date(val), "MMM d, yyyy"); } catch { return val; }
}

function ReadRow({ label, value }) {
  return (
    <div className="flex justify-between py-2.5 border-b border-slate-100 last:border-0 gap-4">
      <span className="text-sm text-slate-500 shrink-0">{label}</span>
      <span className="text-sm font-medium text-slate-800 text-right">{value || "—"}</span>
    </div>
  );
}

function EditRow({ label, children }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0 gap-4">
      <span className="text-sm text-slate-500 shrink-0 w-40">{label}</span>
      <div className="flex-1 flex justify-end">{children}</div>
    </div>
  );
}

const inputCls = "border border-slate-300 rounded-lg px-3 py-1.5 text-sm w-full max-w-[220px] focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30 bg-white";

export default function EnrollmentDetailPanel({ enrollment, statusColors, onClose, onUpdated }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const sc = statusColors[enrollment.status] || "bg-slate-100 text-slate-500";

  const studentName = enrollment.studentFirstName
    ? `${enrollment.studentFirstName} ${enrollment.studentLastName || ""}`.trim()
    : `Student #${enrollment.studentId}`;
  const parentName = enrollment.parentFirstName
    ? `${enrollment.parentFirstName} ${enrollment.parentLastName || ""}`.trim()
    : enrollment.parentEmail || "—";

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: programsData } = useQuery({
    queryKey: ["admin-programs-list"],
    queryFn: () => apiGet("/programs"),
  });
  const programsList = programsData?.programs || programsData || [];

  // Local display state — updated after save so panel stays open
  const [data, setData] = useState({
    invoiceDescription: enrollment.invoiceDescription ?? "",
    invoiceAmount: enrollment.invoiceAmount != null ? String(parseFloat(enrollment.invoiceAmount)) : "",
    invoiceDueDate: enrollment.invoiceDueDate ?? "",
    invoicePaidDate: enrollment.invoicePaidDate ?? "",
    billingCycle: enrollment.billingCycle ?? enrollment.programBillingCycle ?? "",
    startDate: enrollment.startDate ?? "",
    programId: enrollment.programId ?? "",
    programName: enrollment.programName ?? "",
  });

  const [form, setForm] = useState({ ...data });
  const setF = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleEdit = () => {
    setForm({ ...data });
    setEditing(true);
  };

  const handleCancel = () => setEditing(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiPatch(`/enrollments/${enrollment.id}/invoice`, {
        description: form.invoiceDescription || undefined,
        amount: form.invoiceAmount !== "" ? parseFloat(form.invoiceAmount) : undefined,
        dueDate: form.invoiceDueDate || null,
        paidDate: form.invoicePaidDate || null,
      });
      await apiPatch(`/enrollments/${enrollment.id}`, {
        startDate: form.startDate || null,
        billingCycleOverride: form.billingCycle || null,
        programId: form.programId || null,
      });
      // Derive updated program name from the programs list
      const selectedProg = programsList.find(p => String(p.id) === String(form.programId));
      setData({ ...form, programName: selectedProg?.name ?? form.programName });
      setEditing(false);
      toast({ title: "Enrollment details saved" });
      qc.invalidateQueries({ queryKey: ["admin-enrollments"] });
      if (onUpdated) onUpdated();
    } catch (err) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div>
            <h2 className="font-bold text-[#1a3c5e] text-lg">
              {enrollment.programName || `Program #${enrollment.programId}`}
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">{studentName}</p>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold capitalize mt-1 ${sc}`}>
              {enrollment.status?.replace(/_/g, " ")}
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">

          {/* Enrollment & Payment Details */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5" /> Enrollment &amp; Payment Details
              </p>
              {!editing ? (
                <button
                  onClick={handleEdit}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1a3c5e] text-white text-xs font-semibold hover:bg-[#0d2540] transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit Details
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={handleCancel}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50"
                  >
                    <XIcon className="w-3.5 h-3.5" /> Cancel
                  </button>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-green-700 hover:bg-green-800 gap-1.5 text-xs"
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Save Changes
                  </Button>
                </div>
              )}
            </div>

            <div className="bg-slate-50 rounded-xl px-4 py-1">
              {/* Always read-only */}
              <ReadRow label="Student" value={studentName} />
              <ReadRow label="Parent / Guardian" value={parentName} />
              <ReadRow label="Parent Email" value={enrollment.parentEmail} />
              {editing ? (
                <EditRow label="Program">
                  <select
                    className={inputCls}
                    value={form.programId}
                    onChange={e => setForm(f => ({ ...f, programId: e.target.value }))}
                  >
                    <option value="">— select program —</option>
                    {programsList.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </EditRow>
              ) : (
                <ReadRow label="Program" value={data.programName || enrollment.programName} />
              )}
              <ReadRow label="Enrollment Status" value={enrollment.status?.replace(/_/g, " ")} />
              <ReadRow label="Invoice Status" value={enrollment.invoiceStatus?.replace(/_/g, " ")} />

              {editing ? (
                <>
                  <EditRow label="Invoice Description">
                    <input
                      type="text"
                      className={inputCls}
                      value={form.invoiceDescription}
                      onChange={setF("invoiceDescription")}
                      placeholder="e.g. Tuition – Hybrid Program"
                    />
                  </EditRow>
                  <EditRow label="Amount Due ($)">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className={inputCls}
                      value={form.invoiceAmount}
                      onChange={setF("invoiceAmount")}
                      placeholder="0.00"
                    />
                  </EditRow>
                  <EditRow label="Due Date">
                    <input type="date" className={inputCls} value={form.invoiceDueDate} onChange={setF("invoiceDueDate")} />
                  </EditRow>
                  <EditRow label="Pay Date">
                    <input type="date" className={inputCls} value={form.invoicePaidDate} onChange={setF("invoicePaidDate")} />
                  </EditRow>
                  <EditRow label="Billing Cycle">
                    <select className={inputCls} value={form.billingCycle} onChange={setF("billingCycle")}>
                      <option value="">— inherit from program —</option>
                      {BILLING_CYCLES.map(c => (
                        <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
                      ))}
                    </select>
                  </EditRow>
                  <EditRow label="Enrollment Date">
                    <input type="date" className={inputCls} value={form.startDate} onChange={setF("startDate")} />
                  </EditRow>
                  <ReadRow label="Enrollment ID" value={`#${enrollment.id}`} />
                </>
              ) : (
                <>
                  <ReadRow label="Invoice Description" value={data.invoiceDescription} />
                  <ReadRow
                    label="Amount Due"
                    value={data.invoiceAmount !== "" && data.invoiceAmount != null
                      ? `$${parseFloat(data.invoiceAmount).toLocaleString()}`
                      : null}
                  />
                  <ReadRow label="Due Date" value={safeDate(data.invoiceDueDate)} />
                  <ReadRow label="Pay Date" value={safeDate(data.invoicePaidDate)} />
                  <ReadRow label="Billing Cycle" value={data.billingCycle?.replace(/_/g, " ")} />
                  <ReadRow label="Enrolled Date" value={safeDate(data.startDate) !== "—" ? safeDate(data.startDate) : safeDate(enrollment.createdAt)} />
                  <ReadRow label="Enrollment ID" value={`#${enrollment.id}`} />
                </>
              )}
            </div>
          </div>

          {/* Override Management */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" /> Override Management
            </p>
            <EnrollmentOverridePanel enrollment={enrollment} onUpdated={onUpdated} />
          </div>
        </div>
      </div>
    </div>
  );
}
