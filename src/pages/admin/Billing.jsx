import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch } from "@/api/apiClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2, CreditCard, BookOpen, ChevronDown, ChevronRight, Search, Pencil, Check, X, CheckCircle, XCircle, RotateCcw } from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────
function daysOverdue(dueDate) {
  if (!dueDate) return 0;
  const due = new Date(dueDate.includes("T") ? dueDate : dueDate + "T00:00:00");
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((today - due) / 86400000));
}

const URGENCY_ORDER = {
  payment_failed: 0, past_due: 1,
  pending_payment: 2, pending: 3,
  active_override: 4, active: 5,
  paused: 6, cancelled: 7,
};

function urgencyKey(r) {
  if (r.enrollmentStatus === "payment_failed") return "payment_failed";
  if (r.invoiceStatus === "past_due" && !["active", "active_override", "cancelled"].includes(r.enrollmentStatus)) return "past_due";
  return r.enrollmentStatus;
}

// ── Status config ─────────────────────────────────────────────────────────────
const ENROLLMENT_STATUS = {
  active:          { label: "Active",    color: "bg-green-100 text-green-700 border-green-200" },
  active_override: { label: "Active",    color: "bg-green-100 text-green-700 border-green-200" },
  pending_payment: { label: "Pending",   color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  pending:         { label: "Pending",   color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  payment_failed:  { label: "Past Due",  color: "bg-red-100 text-red-700 border-red-200" },
  past_due:        { label: "Past Due",  color: "bg-red-100 text-red-700 border-red-200" },
  cancelled:       { label: "Cancelled", color: "bg-slate-100 text-slate-500 border-slate-200" },
  paused:          { label: "Paused",    color: "bg-orange-100 text-orange-600 border-orange-200" },
};

const CYCLE_BADGE = {
  monthly:  { label: "Monthly",  color: "bg-blue-50 text-blue-700" },
  annual:   { label: "Annual",   color: "bg-purple-50 text-purple-700" },
  one_time: { label: "One-Time", color: "bg-slate-100 text-slate-500" },
};

const PAYMENT_STATUS = {
  paid:      { label: "Paid",     color: "text-green-600" },
  completed: { label: "Paid",     color: "text-green-600" },
  pending:   { label: "Pending",  color: "text-yellow-600" },
  failed:    { label: "Failed",   color: "text-red-500" },
  refunded:  { label: "Refunded", color: "text-slate-500" },
};

// ── Filter config ─────────────────────────────────────────────────────────────
const STATUS_FILTERS = [
  { key: "all",      label: "All",       match: () => true },
  { key: "active",   label: "Active",    match: r => ["active","active_override"].includes(r.enrollmentStatus) },
  { key: "pending",  label: "Pending",   match: r => ["pending_payment","pending"].includes(r.enrollmentStatus) },
  { key: "past_due", label: "Past Due",  match: r => r.enrollmentStatus === "payment_failed" || (r.invoiceStatus === "past_due" && !["active", "active_override", "cancelled"].includes(r.enrollmentStatus)) },
  { key: "cancelled",label: "Cancelled", match: r => r.enrollmentStatus === "cancelled" },
];

const CYCLE_FILTERS = [
  { key: "all",      label: "All" },
  { key: "monthly",  label: "Monthly" },
  { key: "annual",   label: "Annual" },
  { key: "one_time", label: "One-Time" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(str) {
  if (!str) return "—";
  return new Date(str.includes("T") ? str : str + "T00:00:00").toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function fmtDateTime(str) {
  if (!str) return "—";
  return new Date(str).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  });
}

function fmtMoney(val) {
  const n = parseFloat(val || 0);
  return "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Expanded row detail ───────────────────────────────────────────────────────
function RowDetail({ row, onRefetch }) {
  // Due date editing (existing)
  const [editingDue, setEditingDue] = useState(false);
  const [dueDateInput, setDueDateInput] = useState(row.dueDate || "");
  const [savingDue, setSavingDue] = useState(false);
  const [dueError, setDueError] = useState("");

  // Amount editing
  const [editingAmt, setEditingAmt] = useState(false);
  const [amtBase, setAmtBase] = useState("");
  const [amtDiscount, setAmtDiscount] = useState("");
  const [savingAmt, setSavingAmt] = useState(false);
  const [amtError, setAmtError] = useState("");

  // Admin actions
  const [confirmAction, setConfirmAction] = useState(null);
  const [actionReason, setActionReason] = useState("");
  const [takingAction, setTakingAction] = useState(false);
  const [actionError, setActionError] = useState("");

  const isAmountEditable = row.invoiceId && !["paid", "waived"].includes(row.invoiceStatus);

  // Live discount preview
  const baseNum = parseFloat(amtBase) || 0;
  const discNum = parseFloat(amtDiscount) || 0;
  const finalNum = Math.round(baseNum * (1 - discNum / 100) * 100) / 100;

  const handleSaveDueDate = async (e) => {
    e.stopPropagation();
    setSavingDue(true); setDueError("");
    try {
      await apiPatch(`/enrollments/${row.enrollmentId}/invoice`, { dueDate: dueDateInput || null });
      setEditingDue(false);
      onRefetch();
    } catch (err) {
      setDueError(err.message || "Failed to save.");
    } finally { setSavingDue(false); }
  };

  const handleStartEditAmt = (e) => {
    e.stopPropagation();
    const stored = parseFloat(row.invoiceAmount) || 0;
    const storedPct = parseFloat(row.invoiceDiscountPercent) || 0;
    const base = storedPct > 0 ? Math.round(stored / (1 - storedPct / 100) * 100) / 100 : stored;
    setAmtBase(base ? String(base) : "");
    setAmtDiscount(storedPct ? String(storedPct) : "");
    setAmtError("");
    setEditingAmt(true);
  };

  const handleSaveAmt = async (e) => {
    e.stopPropagation();
    if (!amtBase || isNaN(parseFloat(amtBase))) { setAmtError("Enter a valid amount."); return; }
    setSavingAmt(true); setAmtError("");
    try {
      await apiPatch(`/enrollments/${row.enrollmentId}/invoice`, {
        amount: parseFloat(amtBase),
        discountPercent: amtDiscount !== "" ? parseFloat(amtDiscount) : null,
      });
      setEditingAmt(false);
      onRefetch();
    } catch (err) {
      setAmtError(err.message || "Failed to save.");
    } finally { setSavingAmt(false); }
  };

  const handleAdminAction = async () => {
    setTakingAction(true); setActionError("");
    try {
      await apiPost(`/billing/invoices/${row.invoiceId}/admin-action`, {
        action: confirmAction,
        reason: actionReason || undefined,
      });
      setConfirmAction(null); setActionReason("");
      onRefetch();
    } catch (err) {
      setActionError(err.message || "Action failed.");
    } finally { setTakingAction(false); }
  };

  return (
    <tr>
      <td colSpan={7} className="px-0 pb-0 bg-slate-50 border-b border-slate-200">
        <div className="px-6 py-4 space-y-5">

          {/* Summary grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">

            {/* Invoice Amount — editable */}
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Invoice Amount</p>
              {editingAmt ? (
                <div className="space-y-1.5" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-slate-400">$</span>
                      <input type="number" step="0.01" min="0" autoFocus
                        value={amtBase} onChange={e => setAmtBase(e.target.value)}
                        className="border border-slate-300 rounded px-2 py-0.5 text-sm w-24 focus:outline-none focus:ring-1 focus:ring-blue-400"
                        placeholder="0.00" />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-slate-400">Disc%</span>
                      <input type="number" step="1" min="0" max="100"
                        value={amtDiscount} onChange={e => setAmtDiscount(e.target.value)}
                        className="border border-slate-300 rounded px-2 py-0.5 text-sm w-14 focus:outline-none focus:ring-1 focus:ring-blue-400"
                        placeholder="0" />
                    </div>
                  </div>
                  {discNum > 0 && baseNum > 0 && (
                    <p className="text-xs text-purple-600">→ {fmtMoney(finalNum)} after {discNum}% off</p>
                  )}
                  <div className="flex items-center gap-1.5">
                    <button onClick={handleSaveAmt} disabled={savingAmt}
                      className="p-1 text-green-600 hover:text-green-700 disabled:opacity-40" title="Save">
                      {savingAmt ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={e => { e.stopPropagation(); setEditingAmt(false); setAmtError(""); }}
                      className="p-1 text-slate-400 hover:text-slate-600" title="Cancel">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {amtError && <p className="text-xs text-red-500">{amtError}</p>}
                </div>
              ) : (
                <div className="flex items-start gap-1.5 group">
                  <div>
                    <p className="font-semibold text-slate-800">
                      {row.invoiceAmount != null ? fmtMoney(row.invoiceAmount) : "—"}
                      {row.billingCycle !== "one_time" && row.invoiceAmount != null && (
                        <span className="text-xs text-slate-400 font-normal ml-1">
                          /{row.billingCycle === "annual" ? "yr" : "mo"}
                        </span>
                      )}
                    </p>
                    {row.invoiceDiscountPercent && parseFloat(row.invoiceDiscountPercent) > 0 && (
                      <p className="text-xs text-purple-600 mt-0.5">{parseFloat(row.invoiceDiscountPercent)}% discount applied</p>
                    )}
                  </div>
                  {isAmountEditable && (
                    <button onClick={handleStartEditAmt}
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-blue-500 transition-opacity mt-0.5"
                      title="Adjust amount">
                      <Pencil className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Last Paid */}
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Last Paid</p>
              <p className="font-semibold text-slate-800">{fmtDate(row.paidDate || row.lastPaymentDate)}</p>
            </div>

            {/* Invoice Due Date — editable */}
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Invoice Due Date</p>
              {editingDue ? (
                <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                  <input type="date" value={dueDateInput} autoFocus
                    onChange={e => setDueDateInput(e.target.value)}
                    className="border border-slate-300 rounded px-2 py-0.5 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                  <button onClick={handleSaveDueDate} disabled={savingDue}
                    className="p-1 text-green-600 hover:text-green-700 disabled:opacity-40" title="Save">
                    {savingDue ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={e => { e.stopPropagation(); setEditingDue(false); setDueDateInput(row.dueDate || ""); setDueError(""); }}
                    className="p-1 text-slate-400 hover:text-slate-600" title="Cancel">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 group">
                  <p className={`font-semibold ${row.dueDate ? "text-slate-800" : "text-slate-400"}`}>
                    {row.dueDate ? fmtDate(row.dueDate) : "—"}
                  </p>
                  <button onClick={e => { e.stopPropagation(); setEditingDue(true); }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-blue-500 transition-opacity"
                    title="Adjust due date">
                    <Pencil className="w-3 h-3" />
                  </button>
                </div>
              )}
              {dueError && <p className="text-xs text-red-500 mt-1">{dueError}</p>}
              {!editingDue && (row.enrollmentStatus === "payment_failed" || row.invoiceStatus === "past_due") && row.dueDate && daysOverdue(row.dueDate) > 0 && (
                <span className="inline-block mt-1 text-xs bg-red-100 text-red-700 rounded px-1.5 py-0.5 font-medium">
                  {daysOverdue(row.dueDate)}d overdue
                </span>
              )}
              {row.nextDueDate && row.nextDueDate !== row.dueDate && (
                <p className="text-xs text-slate-400 mt-0.5">Next renewal: {fmtDate(row.nextDueDate)}</p>
              )}
            </div>

            {/* Enrolled date */}
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Enrolled</p>
              <p className="font-semibold text-slate-800">{fmtDate(row.startDate)}</p>
            </div>
          </div>

          {/* Admin billing actions */}
          {row.invoiceId && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Billing Actions</p>
              {confirmAction ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2 max-w-md" onClick={e => e.stopPropagation()}>
                  <p className="text-xs font-semibold text-amber-800">
                    {confirmAction === "manual_pay" && "Mark this invoice as manually paid? This will activate the enrollment."}
                    {confirmAction === "waive" && "Waive this invoice? Enrollment will be activated without payment."}
                    {confirmAction === "reopen" && "Reopen this invoice? Enrollment will return to pending payment."}
                  </p>
                  <input type="text" placeholder="Reason (optional)…"
                    value={actionReason} onChange={e => setActionReason(e.target.value)}
                    className="w-full border border-amber-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white" />
                  {actionError && <p className="text-xs text-red-600">{actionError}</p>}
                  <div className="flex items-center gap-2">
                    <button onClick={handleAdminAction} disabled={takingAction}
                      className="text-xs bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded font-semibold disabled:opacity-40 flex items-center gap-1">
                      {takingAction && <Loader2 className="w-3 h-3 animate-spin" />}
                      Confirm
                    </button>
                    <button onClick={() => { setConfirmAction(null); setActionReason(""); setActionError(""); }}
                      className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1.5">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2" onClick={e => e.stopPropagation()}>
                  {["pending", "past_due"].includes(row.invoiceStatus) && (
                    <>
                      <button onClick={() => setConfirmAction("manual_pay")}
                        className="flex items-center gap-1.5 text-xs font-semibold bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 px-3 py-1.5 rounded-lg transition-colors">
                        <CheckCircle className="w-3.5 h-3.5" /> Mark as Paid
                      </button>
                      <button onClick={() => setConfirmAction("waive")}
                        className="flex items-center gap-1.5 text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-lg transition-colors">
                        <XCircle className="w-3.5 h-3.5" /> Waive Invoice
                      </button>
                    </>
                  )}
                  {["paid", "waived"].includes(row.invoiceStatus) && (
                    <button onClick={() => setConfirmAction("reopen")}
                      className="flex items-center gap-1.5 text-xs font-semibold bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 px-3 py-1.5 rounded-lg transition-colors">
                      <RotateCcw className="w-3.5 h-3.5" /> Reopen Invoice
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Family invoice context */}
          {row.familyInvoiceId && (
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700">
              <CreditCard className="w-3.5 h-3.5 shrink-0" />
              <span>
                Part of consolidated family invoice #{row.familyInvoiceId}
                {row.familyInvoiceTotal != null && ` · Family total: ${fmtMoney(row.familyInvoiceTotal)}`}
              </span>
            </div>
          )}

          {/* Payment history */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Payment History</p>
            {row.payments.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No payments on record.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 uppercase tracking-wide">
                      <th className="text-left px-4 py-2 font-semibold">Date</th>
                      <th className="text-right px-4 py-2 font-semibold">Amount</th>
                      <th className="text-left px-4 py-2 font-semibold">Method</th>
                      <th className="text-left px-4 py-2 font-semibold">Status</th>
                      <th className="text-left px-4 py-2 font-semibold">Stripe Ref</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {row.payments.map(p => {
                      const sc = PAYMENT_STATUS[p.status] || PAYMENT_STATUS.pending;
                      return (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className="px-4 py-2 text-slate-600">{fmtDateTime(p.processedAt || p.createdAt)}</td>
                          <td className="px-4 py-2 text-right font-semibold text-slate-800">{fmtMoney(p.amount)}</td>
                          <td className="px-4 py-2">
                            <span className="capitalize px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded font-medium">
                              {p.method || "—"}
                            </span>
                          </td>
                          <td className={`px-4 py-2 font-semibold ${sc.color}`}>{sc.label}</td>
                          <td className="px-4 py-2 font-mono text-slate-400">
                            {p.stripePaymentIntentId ? `…${p.stripePaymentIntentId.slice(-14)}` : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      </td>
    </tr>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AdminBilling() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("accounting");
  const [statusFilter, setStatusFilter] = useState("all");
  const [cycleFilter, setCycleFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [expandedRow, setExpandedRow] = useState(null);
  const [syncMsg, setSyncMsg] = useState("");

  const {
    data: accountingData, isLoading: accountingLoading, refetch: refetchAccounting,
  } = useQuery({
    queryKey: ["admin-accounting"],
    queryFn: () => apiGet("/billing/accounting"),
  });

  const {
    data: paymentData, isLoading: paymentsLoading, refetch: refetchPayments,
  } = useQuery({
    queryKey: ["admin-billing-payments"],
    queryFn: () => apiGet("/billing/payments"),
  });

  const allRows = accountingData?.rows || [];
  const allPayments = paymentData?.payments || [];
  const isLoading = accountingLoading || paymentsLoading;

  // ── Client-side filtering ──────────────────────────────────────────────────
  const statusMatcher = STATUS_FILTERS.find(f => f.key === statusFilter)?.match || (() => true);
  const filtered = allRows
    .filter(statusMatcher)
    .filter(r => cycleFilter === "all" || r.billingCycle === cycleFilter)
    .filter(r => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return r.studentName.toLowerCase().includes(q) || r.parentName.toLowerCase().includes(q);
    })
    .sort((a, b) =>
      (URGENCY_ORDER[urgencyKey(a)] ?? 9) - (URGENCY_ORDER[urgencyKey(b)] ?? 9) ||
      (a.dueDate || "").localeCompare(b.dueDate || "")
    );

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalCollected = allRows.reduce((s, r) => s + parseFloat(r.totalPaid || 0), 0);
  const activeCount  = allRows.filter(r => ["active","active_override"].includes(r.enrollmentStatus)).length;
  const pendingCount = allRows.filter(r => ["pending_payment","pending"].includes(r.enrollmentStatus)).length;
  const pastDueCount = allRows.filter(r =>
    r.enrollmentStatus === "payment_failed" ||
    (r.invoiceStatus === "past_due" && !["active", "active_override", "cancelled"].includes(r.enrollmentStatus))
  ).length;

  const handleRefresh = () => { refetchAccounting(); refetchPayments(); };
  const toggleRow = (id) => setExpandedRow(prev => prev === id ? null : id);

  const handleSyncPastDue = async () => {
    try {
      const res = await apiPost("/billing/sync-past-due", {});
      setSyncMsg(`Updated ${res.updated} record${res.updated !== 1 ? "s" : ""} to past due.`);
      qc.invalidateQueries({ queryKey: ["admin-accounting"] });
      setTimeout(() => setSyncMsg(""), 5000);
    } catch (err) {
      setSyncMsg("Sync failed: " + err.message);
      setTimeout(() => setSyncMsg(""), 5000);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-[#1a3c5e]">Payments & Billing</h1>
          <p className="text-slate-500 text-sm mt-0.5">Accounting records across all enrollments</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {syncMsg && (
            <span className="text-xs text-slate-600 bg-slate-100 border border-slate-200 rounded px-2 py-1">{syncMsg}</span>
          )}
          <Button variant="outline" size="sm" className="gap-2" onClick={handleSyncPastDue} disabled={isLoading}>
            <RefreshCw className="w-4 h-4" />
            Sync Past Due
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleRefresh} disabled={isLoading}>
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-green-700">{fmtMoney(totalCollected)}</p>
          <p className="text-xs text-slate-500 mt-0.5">Total Collected</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-[#1a3c5e]">{activeCount}</p>
          <p className="text-xs text-slate-500 mt-0.5">Active</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
          <p className="text-xs text-slate-500 mt-0.5">Pending</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-red-600">{pastDueCount}</p>
          <p className="text-xs text-slate-500 mt-0.5">Past Due</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-0 border-b border-slate-200">
        {[
          { key: "accounting",   label: "Accounting",      icon: BookOpen },
          { key: "transactions", label: "Transaction Log",  icon: CreditCard },
        ].map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === key
                ? "border-[#1a3c5e] text-[#1a3c5e]"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {/* ── Accounting tab ────────────────────────────────────────────────────── */}
      {tab === "accounting" && (
        <div className="space-y-4">

          {/* Filter bar */}
          <div className="flex flex-wrap gap-3 items-center">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Student or parent name…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-full bg-white focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/20 focus:border-[#1a3c5e] w-48"
              />
            </div>
            {/* Status pills */}
            <div className="flex gap-1.5 flex-wrap">
              {STATUS_FILTERS.map(f => (
                <button key={f.key} onClick={() => setStatusFilter(f.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    statusFilter === f.key
                      ? "bg-[#1a3c5e] text-white border-[#1a3c5e]"
                      : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {/* Cycle pills */}
            <div className="flex gap-1.5 flex-wrap ml-auto">
              {CYCLE_FILTERS.map(f => (
                <button key={f.key} onClick={() => setCycleFilter(f.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    cycleFilter === f.key
                      ? "bg-slate-800 text-white border-slate-800"
                      : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          {accountingLoading ? (
            <div className="flex justify-center py-10">
              <div className="w-5 h-5 border-4 border-slate-200 border-t-[#1a3c5e] rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-slate-400">
                {allRows.length === 0 ? "No enrollments on record yet." : "No records match the current filters."}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs text-slate-400 uppercase tracking-wide">
                      <th className="w-8 px-3 py-3" />
                      <th className="text-left px-4 py-3 font-semibold">Student</th>
                      <th className="text-left px-4 py-3 font-semibold">Parent</th>
                      <th className="text-left px-4 py-3 font-semibold">Program</th>
                      <th className="text-left px-4 py-3 font-semibold">Status</th>
                      <th className="text-right px-4 py-3 font-semibold">Total Paid</th>
                      <th className="text-right px-4 py-3 font-semibold">Owed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(row => {
                      const displayStatus = urgencyKey(row);
                      const sc = ENROLLMENT_STATUS[displayStatus] || ENROLLMENT_STATUS.pending_payment;
                      const cb = CYCLE_BADGE[row.billingCycle] || CYCLE_BADGE.one_time;
                      const isExpanded = expandedRow === row.enrollmentId;
                      const owed = parseFloat(row.totalOwed || 0);
                      return (
                        <>
                          <tr
                            key={row.enrollmentId}
                            onClick={() => toggleRow(row.enrollmentId)}
                            className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
                          >
                            <td className="px-3 py-3 text-slate-400">
                              {isExpanded
                                ? <ChevronDown className="w-4 h-4" />
                                : <ChevronRight className="w-4 h-4" />}
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-800">{row.studentName}</td>
                            <td className="px-4 py-3 text-slate-600">{row.parentName}</td>
                            <td className="px-4 py-3">
                              <p className="text-slate-800 font-medium leading-tight">{row.programName}</p>
                              <span className={`text-xs px-1.5 py-0.5 rounded font-medium mt-0.5 inline-block ${cb.color}`}>
                                {cb.label}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${sc.color}`}>
                                {sc.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-green-700">
                              {fmtMoney(row.totalPaid)}
                            </td>
                            <td className={`px-4 py-3 text-right font-semibold ${owed > 0 ? "text-red-600" : "text-slate-400"}`}>
                              {owed > 0 ? fmtMoney(owed) : "—"}
                            </td>
                          </tr>
                          {isExpanded && <RowDetail key={`detail-${row.enrollmentId}`} row={row} onRefetch={refetchAccounting} />}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400">
                {filtered.length} enrollment{filtered.length !== 1 ? "s" : ""}
                {filtered.length !== allRows.length && ` (filtered from ${allRows.length})`}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── Transaction Log tab ──────────────────────────────────────────────── */}
      {tab === "transactions" && (
        <div className="space-y-4">
          {paymentsLoading ? (
            <div className="flex justify-center py-10">
              <div className="w-5 h-5 border-4 border-slate-200 border-t-[#1a3c5e] rounded-full animate-spin" />
            </div>
          ) : allPayments.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-slate-400">No payment transactions on record.</CardContent>
            </Card>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs text-slate-400 uppercase tracking-wide">
                      <th className="text-left px-5 py-3 font-semibold">Parent</th>
                      <th className="text-right px-5 py-3 font-semibold">Amount</th>
                      <th className="text-left px-5 py-3 font-semibold">Method</th>
                      <th className="text-left px-5 py-3 font-semibold">Status</th>
                      <th className="text-left px-5 py-3 font-semibold">Processed</th>
                      <th className="text-left px-5 py-3 font-semibold">Stripe Ref</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {allPayments.map(p => {
                      const sc = PAYMENT_STATUS[p.status] || PAYMENT_STATUS.pending;
                      const parent = [p.parentFirstName, p.parentLastName].filter(Boolean).join(" ");
                      return (
                        <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-3">
                            {parent
                              ? <><p className="font-medium text-slate-800">{parent}</p>
                                  {p.parentEmail && <p className="text-xs text-slate-400">{p.parentEmail}</p>}</>
                              : <span className="text-slate-400 text-xs">—</span>}
                          </td>
                          <td className="px-5 py-3 text-right font-semibold text-slate-800">{fmtMoney(p.amount)}</td>
                          <td className="px-5 py-3">
                            <span className="capitalize text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full font-medium">
                              {p.method || "—"}
                            </span>
                          </td>
                          <td className={`px-5 py-3 font-semibold text-sm ${sc.color}`}>{sc.label}</td>
                          <td className="px-5 py-3 text-xs text-slate-500">{fmtDateTime(p.processedAt || p.createdAt)}</td>
                          <td className="px-5 py-3 text-xs font-mono text-slate-400">
                            {p.stripePaymentIntentId ? `…${p.stripePaymentIntentId.slice(-14)}` : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400">
                {allPayments.length} transaction{allPayments.length !== 1 ? "s" : ""}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
