import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch } from "@/api/apiClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2, CreditCard, BookOpen, ChevronDown, ChevronRight, Search, Pencil, Check, X, CheckCircle, XCircle, RotateCcw, Tag, ShieldAlert, Calendar, Scale, Bell } from "lucide-react";

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
  const qc = useQueryClient();

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

  // Past-due reminder
  const [sendingReminder, setSendingReminder] = useState(false);
  const [reminderMsg, setReminderMsg] = useState(null); // { ok: bool, text: string }

  const isPastDue = row.invoiceStatus === "past_due" || row.enrollmentStatus === "payment_failed";

  const handleSendReminder = async (e) => {
    e.stopPropagation();
    setSendingReminder(true);
    setReminderMsg(null);
    try {
      const body = row.familyInvoiceId
        ? { familyInvoiceId: row.familyInvoiceId }
        : { billingAccountId: row.billingAccountId };
      await apiPost("/billing/send-past-due-reminder", body);
      setReminderMsg({ ok: true, text: `Reminder sent to ${row.parentEmail || row.parentName}.` });
    } catch (err) {
      setReminderMsg({ ok: false, text: err.message || "Failed to send reminder." });
    } finally {
      setSendingReminder(false);
    }
  };

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
      await onRefetch();
      setEditingDue(false);
      qc.invalidateQueries({ queryKey: ["admin-enrollments"] });
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
      // Await refetch so cache is updated before closing edit mode — prevents stale
      // display when navigating away and back before the background fetch completes.
      await onRefetch();
      setEditingAmt(false);
      qc.invalidateQueries({ queryKey: ["admin-enrollments"] });
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
      await onRefetch();
      qc.invalidateQueries({ queryKey: ["admin-enrollments"] });
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

          {/* Override / Scholarship section */}
          {row.activeOverride && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Override / Scholarship</p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 capitalize">
                    <Tag className="w-3 h-3" />
                    {row.activeOverride.overrideType?.replace(/_/g, " ") || "Override"}
                  </span>
                  {row.activeOverride.approvedByName && (
                    <span className="text-xs text-slate-500">Approved by {row.activeOverride.approvedByName}</span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  {row.activeOverride.amountWaivedCents > 0 && (
                    <div>
                      <p className="text-slate-400 mb-0.5">Waived</p>
                      <p className="font-semibold text-amber-700">{fmtMoney(row.activeOverride.amountWaivedCents / 100)}</p>
                    </div>
                  )}
                  {row.activeOverride.amountDeferredCents > 0 && (
                    <div>
                      <p className="text-slate-400 mb-0.5">Deferred</p>
                      <p className="font-semibold text-blue-700">{fmtMoney(row.activeOverride.amountDeferredCents / 100)}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-slate-400 mb-0.5">Amount Due</p>
                    <p className="font-semibold text-slate-800">{fmtMoney(row.activeOverride.amountDueNowCents / 100)}</p>
                  </div>
                </div>
                {row.activeOverride.reason && (
                  <p className="text-xs text-slate-600 italic">"{row.activeOverride.reason}"</p>
                )}
                {row.activeOverride.notes && row.activeOverride.notes !== row.activeOverride.reason && (
                  <p className="text-xs text-slate-500">{row.activeOverride.notes}</p>
                )}
              </div>
            </div>
          )}

          {/* Past-due reminder */}
          {isPastDue && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Notifications</p>
              <div className="flex flex-wrap items-center gap-3" onClick={e => e.stopPropagation()}>
                <button
                  onClick={handleSendReminder}
                  disabled={sendingReminder}
                  className="flex items-center gap-1.5 text-xs font-semibold bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                >
                  {sendingReminder
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Bell className="w-3.5 h-3.5" />}
                  Send Past-Due Reminder
                </button>
                {reminderMsg && (
                  <span className={`text-xs px-2.5 py-1 rounded-lg border font-medium ${
                    reminderMsg.ok
                      ? "bg-green-50 text-green-700 border-green-200"
                      : "bg-red-50 text-red-600 border-red-200"
                  }`}>
                    {reminderMsg.ok ? "✓ " : "✕ "}{reminderMsg.text}
                  </span>
                )}
              </div>
            </div>
          )}

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

// ── Billing Audit Panel ───────────────────────────────────────────────────────
const SEVERITY_STYLES = {
  critical: { badge: "bg-red-100 text-red-700 border-red-200",    card: "border-red-200 bg-red-50",    label: "Critical" },
  high:     { badge: "bg-orange-100 text-orange-700 border-orange-200", card: "border-orange-200 bg-orange-50", label: "High" },
  medium:   { badge: "bg-yellow-100 text-yellow-700 border-yellow-200", card: "border-yellow-200 bg-yellow-50", label: "Medium" },
  low:      { badge: "bg-slate-100 text-slate-600 border-slate-200", card: "border-slate-200 bg-slate-50", label: "Low" },
};

// ── Reconciliation helpers ────────────────────────────────────────────────────
const RECON_SEV = {
  critical: "bg-red-100 text-red-700 border border-red-200",
  high:     "bg-orange-100 text-orange-700 border border-orange-200",
  medium:   "bg-yellow-100 text-yellow-700 border border-yellow-200",
  low:      "bg-slate-100 text-slate-600 border border-slate-200",
  none:     "bg-green-50 text-green-700 border border-green-200",
};

const ALLOC_LABEL = {
  allocated:           { text: "Allocated",    cls: "text-green-600" },
  partial_allocation:  { text: "Partial",       cls: "text-orange-600" },
  missing_allocation:  { text: "Missing",       cls: "text-red-600" },
  none:                { text: "—",             cls: "text-slate-400" },
};

function fmt(n) {
  if (n == null) return "—";
  return "$" + parseFloat(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ReconciliationPanel() {
  const [hasRun, setHasRun] = useState(false);
  const [sevFilter, setSevFilter] = useState("all");
  const { data, isFetching, refetch } = useQuery({
    queryKey: ["admin-billing-reconciliation"],
    queryFn: () => apiGet("/billing/reconciliation?limit=50"),
    enabled: false,
    staleTime: 0,
  });

  const handleRun = () => { setHasRun(true); refetch(); };

  const allRows = data?.rows || [];
  const counts = data?.counts || {};

  const visibleRows = allRows.filter(r => {
    if (sevFilter === "all") return true;
    if (sevFilter === "issues") return r.severity !== "none";
    if (sevFilter === "critical_high") return r.severity === "critical" || r.severity === "high";
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm text-slate-600">
            Compares local billing records against Stripe — read-only, no records are modified.
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Checks family invoices and payments against Stripe checkout sessions and payment intents. Stripe calls are made server-side only.
          </p>
        </div>
        <Button size="sm" onClick={handleRun} disabled={isFetching} className="shrink-0">
          {isFetching ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Scale className="w-4 h-4 mr-2" />}
          {isFetching ? "Checking…" : hasRun ? "Recheck" : "Run Reconciliation"}
        </Button>
      </div>

      {hasRun && isFetching && (
        <div className="flex items-center gap-2 text-sm text-slate-500 py-4">
          <Loader2 className="w-4 h-4 animate-spin" /> Looking up Stripe records…
        </div>
      )}

      {hasRun && !isFetching && data && (
        <>
          {/* Summary badges */}
          <div className="flex flex-wrap gap-2 items-center">
            {counts.total === 0 ? (
              <span className="px-3 py-1 bg-green-100 text-green-700 border border-green-200 rounded-full text-xs font-semibold">
                ✓ No records found
              </span>
            ) : (
              <>
                <span className="text-xs text-slate-500">{counts.total} records</span>
                {counts.critical > 0 && <span className={`px-3 py-1 border rounded-full text-xs font-semibold ${SEVERITY_STYLES.critical.badge}`}>{counts.critical} Critical</span>}
                {counts.high     > 0 && <span className={`px-3 py-1 border rounded-full text-xs font-semibold ${SEVERITY_STYLES.high.badge}`}>{counts.high} High</span>}
                {counts.medium   > 0 && <span className={`px-3 py-1 border rounded-full text-xs font-semibold ${SEVERITY_STYLES.medium.badge}`}>{counts.medium} Medium</span>}
                {counts.none     > 0 && <span className="px-3 py-1 bg-green-50 text-green-700 border border-green-200 rounded-full text-xs font-semibold">{counts.none} OK</span>}
              </>
            )}
            {!data.stripeAvailable && (
              <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                Stripe unavailable — local data only
              </span>
            )}
          </div>

          {/* Filter bar */}
          {counts.total > 0 && (
            <div className="flex gap-1.5">
              {[
                { key: "all",           label: "All" },
                { key: "issues",        label: "Issues Only" },
                { key: "critical_high", label: "Critical / High" },
              ].map(f => (
                <button key={f.key} onClick={() => setSevFilter(f.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    sevFilter === f.key
                      ? "bg-[#1a3c5e] text-white border-[#1a3c5e]"
                      : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}

          {/* Table */}
          {visibleRows.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">No records match this filter.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {["Type", "ID", "Local Status", "Local Amt", "Stripe Status", "Stripe Amt", "Allocation", "Severity", "Issue"].map(h => (
                      <th key={h} className="text-left px-3 py-2.5 font-semibold text-slate-600 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleRows.map((row, i) => {
                    const sevCls = RECON_SEV[row.severity] || RECON_SEV.none;
                    const allocInfo = ALLOC_LABEL[row.allocationStatus] || ALLOC_LABEL.none;
                    const typeLabel = row.type === "family_invoice" ? "Family Inv." : "Payment";
                    const typeColor = row.type === "family_invoice" ? "text-blue-700" : "text-purple-700";
                    return (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                        <td className={`px-3 py-2.5 font-semibold ${typeColor}`}>{typeLabel}</td>
                        <td className="px-3 py-2.5 font-mono text-slate-500">#{row.localId}</td>
                        <td className="px-3 py-2.5">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-mono">{row.localStatus}</span>
                        </td>
                        <td className="px-3 py-2.5 font-medium text-slate-700">{fmt(row.localAmount)}</td>
                        <td className="px-3 py-2.5">
                          {row.stripeStatus ? (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                              row.stripeStatus === "paid" || row.stripeStatus === "succeeded"
                                ? "bg-green-100 text-green-700"
                                : row.stripeStatus === "lookup_failed" || row.stripeStatus === "no_intent_id"
                                  ? "bg-red-100 text-red-600"
                                  : row.stripeStatus === "not_applicable" || row.stripeStatus === "stripe_unavailable"
                                    ? "bg-slate-100 text-slate-400"
                                    : "bg-yellow-100 text-yellow-700"
                            }`}>{row.stripeStatus}</span>
                          ) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-3 py-2.5 font-medium text-slate-700">{fmt(row.stripeAmount)}</td>
                        <td className={`px-3 py-2.5 font-medium ${allocInfo.cls}`}>{allocInfo.text}</td>
                        <td className="px-3 py-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${sevCls}`}>
                            {row.severity === "none" ? "OK" : row.severity}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-slate-500 max-w-xs truncate" title={row.issue || ""}>
                          {row.issue || <span className="text-slate-300">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function BillingAuditPanel() {
  const [hasRun, setHasRun] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const [recognizeResult, setRecognizeResult] = useState(null);
  const { data, isFetching, refetch } = useQuery({
    queryKey: ["admin-billing-audit"],
    queryFn: () => apiGet("/billing/audit"),
    enabled: false,
    staleTime: 0,
  });

  const handleRun = () => { setHasRun(true); refetch(); };

  const handleRunRecognition = async () => {
    setRecognizing(true);
    setRecognizeResult(null);
    try {
      const now = new Date();
      const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const result = await apiPost("/accounting/recognize-revenue", { period });
      setRecognizeResult({ success: true, period, recognized: result.recognized ?? 0, skipped: result.skipped ?? 0 });
      refetch();
    } catch (err) {
      setRecognizeResult({ success: false, error: err.message });
    } finally {
      setRecognizing(false);
    }
  };

  const issues = data?.issues || [];
  const counts = data?.counts || {};
  const lastRecognitionDate = data?.lastRecognitionDate
    ? new Date(data.lastRecognitionDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm text-slate-600">
            Read-only check for billing data inconsistencies. Does not modify any records.
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Checks: paid invoice/inactive enrollment · active enrollment/unpaid invoice · paid family invoice/unpaid child · missing payment allocations · credit balances · payment_failed enrollments · revenue recognition staleness
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <Button size="sm" variant="outline" onClick={handleRunRecognition} disabled={recognizing} title="Recognize revenue for the current month">
            {recognizing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Calendar className="w-4 h-4 mr-2" />}
            {recognizing ? "Running…" : "Run Recognition"}
          </Button>
          <Button size="sm" onClick={handleRun} disabled={isFetching} className="shrink-0">
            {isFetching ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShieldAlert className="w-4 h-4 mr-2" />}
            {isFetching ? "Running…" : "Run Audit"}
          </Button>
        </div>
      </div>

      {/* Recognition result flash */}
      {recognizeResult && (
        <div className={`px-4 py-2 rounded-lg text-sm border ${recognizeResult.success ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}>
          {recognizeResult.success
            ? `Revenue recognition ${recognizeResult.period}: ${recognizeResult.recognized} entries posted, ${recognizeResult.skipped} skipped.`
            : `Recognition failed: ${recognizeResult.error}`}
        </div>
      )}

      {/* Last recognition date */}
      {hasRun && !isFetching && lastRecognitionDate && (
        <p className="text-xs text-slate-400 flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          Last revenue recognition: {lastRecognitionDate}
        </p>
      )}

      {hasRun && !isFetching && data && (
        <>
          {/* Summary badges */}
          <div className="flex flex-wrap gap-2">
            {counts.total === 0 ? (
              <span className="px-3 py-1 bg-green-100 text-green-700 border border-green-200 rounded-full text-xs font-semibold">
                ✓ No issues found
              </span>
            ) : (
              <>
                {counts.critical > 0 && <span className={`px-3 py-1 border rounded-full text-xs font-semibold ${SEVERITY_STYLES.critical.badge}`}>{counts.critical} Critical</span>}
                {counts.high     > 0 && <span className={`px-3 py-1 border rounded-full text-xs font-semibold ${SEVERITY_STYLES.high.badge}`}>{counts.high} High</span>}
                {counts.medium   > 0 && <span className={`px-3 py-1 border rounded-full text-xs font-semibold ${SEVERITY_STYLES.medium.badge}`}>{counts.medium} Medium</span>}
                {counts.low      > 0 && <span className={`px-3 py-1 border rounded-full text-xs font-semibold ${SEVERITY_STYLES.low.badge}`}>{counts.low} Low</span>}
              </>
            )}
          </div>

          {/* Issues grouped by severity */}
          {["critical", "high", "medium", "low"].map(sev => {
            const group = issues.filter(i => i.severity === sev);
            if (!group.length) return null;
            const s = SEVERITY_STYLES[sev];
            return (
              <div key={sev} className={`rounded-xl border p-4 ${s.card}`}>
                <p className="text-sm font-semibold text-slate-700 mb-3">{s.label} ({group.length})</p>
                <div className="space-y-2">
                  {group.map((issue, i) => (
                    <div key={i} className="bg-white rounded-lg border border-slate-200 p-3 space-y-1">
                      <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wide">{issue.type}</p>
                      <p className="text-sm text-slate-700">{issue.message}</p>
                      <p className="text-[10px] font-mono text-slate-400">{JSON.stringify(issue.ids)}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </>
      )}

      {hasRun && isFetching && (
        <div className="flex items-center gap-2 text-sm text-slate-500 py-4">
          <Loader2 className="w-4 h-4 animate-spin" /> Running audit checks…
        </div>
      )}
    </div>
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
          { key: "accounting",      label: "Accounting",      icon: BookOpen },
          { key: "transactions",    label: "Transaction Log",  icon: CreditCard },
          { key: "reconciliation",  label: "Reconciliation",   icon: Scale },
          { key: "audit",           label: "Billing Audit",    icon: ShieldAlert },
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

      {/* ── Reconciliation tab ───────────────────────────────────────────────── */}
      {tab === "reconciliation" && (
        <div className="space-y-4">
          <ReconciliationPanel />
        </div>
      )}

      {/* ── Billing Audit tab ────────────────────────────────────────────────── */}
      {tab === "audit" && (
        <div>
          <BillingAuditPanel />
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
