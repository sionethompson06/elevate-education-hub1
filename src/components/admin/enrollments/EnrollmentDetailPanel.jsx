import { useState } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { X, CreditCard, ShieldCheck, Pencil, Save, X as XIcon, Loader2, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { apiPatch, apiGet, apiPost, apiDelete } from "@/api/apiClient";
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

export default function EnrollmentDetailPanel({ enrollment, studentEnrollments = [], statusColors, onClose, onUpdated }) {
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
    discountPercent: enrollment.invoiceDiscountPercent != null ? String(parseFloat(enrollment.invoiceDiscountPercent)) : "",
  });

  const [form, setForm] = useState({ ...data });
  const setF = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  // When program dropdown changes — update amount from program's default price for current cycle
  const handleProgramChange = (e) => {
    const newId = e.target.value;
    const prog = programsList.find(p => String(p.id) === newId);
    const cycle = form.billingCycle || prog?.billingCycle || "monthly";
    const cyclePrice = prog?.metadata?.prices?.[cycle] ?? prog?.tuitionAmount;
    setForm(f => ({
      ...f,
      programId: newId,
      invoiceAmount: cyclePrice != null ? String(cyclePrice) : f.invoiceAmount,
      discountPercent: "",
    }));
  };

  // When billing cycle changes — update amount from program metadata per-cycle pricing
  const handleBillingCycleChange = (e) => {
    const newCycle = e.target.value;
    const prog = programsList.find(p => String(p.id) === String(form.programId));
    const cyclePrice = prog?.metadata?.prices?.[newCycle] ?? prog?.tuitionAmount;
    setForm(f => ({
      ...f,
      billingCycle: newCycle,
      invoiceAmount: cyclePrice != null ? String(cyclePrice) : f.invoiceAmount,
      discountPercent: "",
    }));
  };

  // Live discount calculation
  const baseAmount = parseFloat(form.invoiceAmount) || 0;
  const discountPct = parseFloat(form.discountPercent) || 0;
  const discountAmt = Math.round(baseAmount * discountPct) / 100;
  const finalAmt = Math.round((baseAmount - discountAmt) * 100) / 100;

  // Additional program enrollment state
  const enrolledProgramIds = new Set(studentEnrollments.map(e => String(e.programId)));
  const availablePrograms = programsList.filter(p => p.status !== "inactive" && !enrolledProgramIds.has(String(p.id)));
  const [addProgramIds, setAddProgramIds] = useState([]);
  const [addingPrograms, setAddingPrograms] = useState(false);
  const [addProgramsResult, setAddProgramsResult] = useState(null);

  const toggleAddProgram = (id) => {
    setAddProgramIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleAddPrograms = async () => {
    if (addProgramIds.length === 0) return;
    setAddingPrograms(true);
    setAddProgramsResult(null);
    let created = 0, skipped = 0;
    for (const programId of addProgramIds) {
      try {
        await apiPost("/enrollments", {
          studentId: parseInt(enrollment.studentId),
          programId: parseInt(programId),
        });
        created++;
      } catch (err) {
        if (err.message?.toLowerCase().includes("already enrolled")) skipped++;
        else toast({ title: "Enrollment error", description: err.message, variant: "destructive" });
      }
    }
    qc.invalidateQueries({ queryKey: ["admin-enrollments"] });
    setAddProgramIds([]);
    setAddProgramsResult(`${created} program${created !== 1 ? "s" : ""} added${skipped > 0 ? `, ${skipped} already existed` : ""}.`);
    setAddingPrograms(false);
  };

  const handleEdit = () => {
    const storedAmt = parseFloat(data.invoiceAmount) || 0;
    const storedPct = parseFloat(data.discountPercent) || 0;
    // Reconstruct pre-discount base so editing again doesn't compound the discount
    const baseAmt = storedPct > 0
      ? Math.round(storedAmt / (1 - storedPct / 100) * 100) / 100
      : storedAmt;
    setForm({ ...data, invoiceAmount: baseAmt ? String(baseAmt) : "" });
    setEditing(true);
  };

  const handleCancel = () => setEditing(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await apiDelete(`/enrollments/${enrollment.id}`);
      toast({ title: "Enrollment deleted" });
      qc.invalidateQueries({ queryKey: ["admin-enrollments"] });
      if (onUpdated) onUpdated();
    } catch (err) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiPatch(`/enrollments/${enrollment.id}/invoice`, {
        description: form.invoiceDescription || undefined,
        amount: form.invoiceAmount !== "" ? parseFloat(form.invoiceAmount) : undefined,
        dueDate: form.invoiceDueDate || null,
        paidDate: form.invoicePaidDate || null,
        discountPercent: form.discountPercent !== "" ? parseFloat(form.discountPercent) : null,
      });
      await apiPatch(`/enrollments/${enrollment.id}`, {
        startDate: form.startDate || null,
        billingCycleOverride: form.billingCycle || null,
        programId: form.programId || null,
      });
      const selectedProg = programsList.find(p => String(p.id) === String(form.programId));
      // After save: display the final discounted amount as the stored invoice amount
      const savedAmount = discountPct > 0 ? String(finalAmt) : form.invoiceAmount;
      setData({ ...form, programName: selectedProg?.name ?? form.programName, invoiceAmount: savedAmount });
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
          <div className="flex items-center gap-2">
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-600 font-medium">Delete this enrollment?</span>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="text-xs px-2.5 py-1 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 flex items-center gap-1"
                >
                  {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                  Yes, delete
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-xs px-2.5 py-1 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                title="Delete enrollment"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded hover:bg-slate-100">
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
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
                    onChange={handleProgramChange}
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
                      onChange={e => setForm(f => ({ ...f, invoiceAmount: e.target.value, discountPercent: "" }))}
                      placeholder="0.00"
                    />
                  </EditRow>
                  <EditRow label="Discount (%)">
                    <div className="flex flex-col items-end gap-1 w-full max-w-[220px]">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        className={inputCls}
                        value={form.discountPercent}
                        onChange={setF("discountPercent")}
                        placeholder="0"
                      />
                      {discountPct > 0 && baseAmount > 0 && (
                        <p className="text-xs text-purple-700 text-right">
                          {discountPct}% of ${baseAmount.toLocaleString()} = −${discountAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} → <span className="font-semibold">${finalAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> due
                        </p>
                      )}
                    </div>
                  </EditRow>
                  <EditRow label="Due Date">
                    <input type="date" className={inputCls} value={form.invoiceDueDate} onChange={setF("invoiceDueDate")} />
                  </EditRow>
                  <EditRow label="Pay Date">
                    <input type="date" className={inputCls} value={form.invoicePaidDate} onChange={setF("invoicePaidDate")} />
                  </EditRow>
                  <EditRow label="Billing Cycle">
                    <select className={inputCls} value={form.billingCycle} onChange={handleBillingCycleChange}>
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
                      ? `$${parseFloat(data.invoiceAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : null}
                  />
                  {data.discountPercent && parseFloat(data.discountPercent) > 0 && (() => {
                    const pct = parseFloat(data.discountPercent);
                    const final = parseFloat(data.invoiceAmount) || 0;
                    const original = Math.round(final / (1 - pct / 100) * 100) / 100;
                    const saved = Math.round((original - final) * 100) / 100;
                    return <ReadRow label="Discount Applied" value={`${pct}% (−$${saved.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} off $${original.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`} />;
                  })()}
                  <ReadRow label="Due Date" value={safeDate(data.invoiceDueDate)} />
                  <ReadRow label="Pay Date" value={safeDate(data.invoicePaidDate)} />
                  <ReadRow label="Billing Cycle" value={data.billingCycle?.replace(/_/g, " ")} />
                  <ReadRow label="Enrolled Date" value={safeDate(data.startDate) !== "—" ? safeDate(data.startDate) : safeDate(enrollment.createdAt)} />
                  <ReadRow label="Enrollment ID" value={`#${enrollment.id}`} />
                </>
              )}
            </div>
          </div>

          {/* Additional Program Enrollment */}
          {availablePrograms.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Enroll in Additional Programs
              </p>
              <div className="border border-slate-200 rounded-xl divide-y max-h-44 overflow-y-auto">
                {availablePrograms.map(p => (
                  <label key={p.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={addProgramIds.includes(String(p.id))}
                      onChange={() => toggleAddProgram(String(p.id))}
                      className="rounded border-slate-300 text-[#1a3c5e]"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800">{p.name}</p>
                      <p className="text-xs text-slate-400">
                        ${parseFloat(p.tuitionAmount || 0).toLocaleString()}/{p.billingCycle?.replace(/_/g, " ") || "mo"}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
              {addProgramsResult && (
                <p className="text-xs text-green-700 mt-1.5">{addProgramsResult}</p>
              )}
              {addProgramIds.length > 0 && (
                <Button
                  size="sm"
                  className="mt-2 bg-[#1a3c5e] hover:bg-[#0d2540] gap-1.5 text-xs"
                  onClick={handleAddPrograms}
                  disabled={addingPrograms}
                >
                  {addingPrograms ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Enroll in {addProgramIds.length} More Program{addProgramIds.length !== 1 ? "s" : ""}
                </Button>
              )}
            </div>
          )}

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
