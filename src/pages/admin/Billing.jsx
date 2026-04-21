import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/api/apiClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2, CreditCard, Receipt } from "lucide-react";

const INVOICE_STATUS = {
  paid:     { label: "Paid",     color: "bg-green-100 text-green-700 border-green-200" },
  pending:  { label: "Pending",  color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  past_due: { label: "Past Due", color: "bg-red-100 text-red-700 border-red-200" },
  waived:   { label: "Waived",   color: "bg-slate-100 text-slate-500 border-slate-200" },
};

const PAYMENT_STATUS = {
  paid:      { label: "Paid",     color: "bg-green-100 text-green-700" },
  completed: { label: "Paid",     color: "bg-green-100 text-green-700" },
  pending:   { label: "Pending",  color: "bg-yellow-100 text-yellow-700" },
  failed:    { label: "Failed",   color: "bg-red-100 text-red-700" },
  refunded:  { label: "Refunded", color: "bg-slate-100 text-slate-500" },
};

const INVOICE_FILTERS = [
  { key: "all",      label: "All" },
  { key: "pending",  label: "Pending" },
  { key: "paid",     label: "Paid" },
  { key: "past_due", label: "Past Due" },
  { key: "waived",   label: "Waived" },
];

function fmtDate(str) {
  if (!str) return "—";
  return new Date(str.includes("T") ? str : str + "T00:00:00").toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function fmtDateTime(str) {
  if (!str) return "—";
  return new Date(str).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

export default function AdminBilling() {
  const [tab, setTab] = useState("invoices");
  const [invoiceFilter, setInvoiceFilter] = useState("all");

  const {
    data: invoiceData, isLoading: invoicesLoading, refetch: refetchInvoices,
  } = useQuery({
    queryKey: ["admin-billing-invoices"],
    queryFn: () => apiGet("/billing/invoices"),
  });

  const {
    data: paymentData, isLoading: paymentsLoading, refetch: refetchPayments,
  } = useQuery({
    queryKey: ["admin-billing-payments"],
    queryFn: () => apiGet("/billing/payments"),
  });

  const allInvoices = invoiceData?.invoices || [];
  const allPayments = paymentData?.payments || [];
  const isLoading = invoicesLoading || paymentsLoading;

  const filteredInvoices = invoiceFilter === "all"
    ? allInvoices
    : allInvoices.filter(i => i.status === invoiceFilter);

  const totalCollected = allPayments
    .filter(p => p.status === "paid" || p.status === "completed")
    .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
  const paidCount    = allInvoices.filter(i => i.status === "paid").length;
  const pendingCount = allInvoices.filter(i => i.status === "pending").length;
  const pastDueCount = allInvoices.filter(i => i.status === "past_due").length;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-[#1a3c5e]">Payments & Billing</h1>
          <p className="text-slate-500 text-sm mt-0.5">All invoice and payment records across the platform</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2"
          onClick={() => { refetchInvoices(); refetchPayments(); }} disabled={isLoading}>
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-green-700">
            ${totalCollected.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">Total Collected</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-[#1a3c5e]">{paidCount}</p>
          <p className="text-xs text-slate-500 mt-0.5">Paid Invoices</p>
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
          { key: "invoices",  label: "Invoices",         icon: Receipt },
          { key: "payments",  label: "Payment Records",  icon: CreditCard },
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

      {/* ── Invoices tab ─────────────────────────────────────────────────────── */}
      {tab === "invoices" && (
        <div className="space-y-4">
          <div className="flex gap-1.5 flex-wrap">
            {INVOICE_FILTERS.map(f => (
              <button key={f.key} onClick={() => setInvoiceFilter(f.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  invoiceFilter === f.key
                    ? "bg-[#1a3c5e] text-white border-[#1a3c5e]"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                }`}
              >
                {f.label}
                {f.key !== "all" && (
                  <span className="ml-1 opacity-60">
                    ({allInvoices.filter(i => i.status === f.key).length})
                  </span>
                )}
              </button>
            ))}
          </div>

          {invoicesLoading ? (
            <div className="flex justify-center py-10">
              <div className="w-5 h-5 border-4 border-slate-200 border-t-[#1a3c5e] rounded-full animate-spin" />
            </div>
          ) : filteredInvoices.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-slate-400">No invoices found.</CardContent>
            </Card>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs text-slate-400 uppercase tracking-wide">
                      <th className="text-left px-5 py-3 font-semibold">Program / Student</th>
                      <th className="text-left px-5 py-3 font-semibold">Description</th>
                      <th className="text-right px-5 py-3 font-semibold">Amount</th>
                      <th className="text-left px-5 py-3 font-semibold">Status</th>
                      <th className="text-left px-5 py-3 font-semibold">Due</th>
                      <th className="text-left px-5 py-3 font-semibold">Paid</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredInvoices.map(inv => {
                      const sc = INVOICE_STATUS[inv.status] || INVOICE_STATUS.pending;
                      const student = [inv.studentFirstName, inv.studentLastName].filter(Boolean).join(" ");
                      return (
                        <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-3">
                            <p className="font-medium text-slate-800">{inv.programName || "—"}</p>
                            {student && <p className="text-xs text-slate-400 mt-0.5">{student}</p>}
                          </td>
                          <td className="px-5 py-3 text-slate-500 max-w-[180px] truncate">{inv.description || "—"}</td>
                          <td className="px-5 py-3 text-right font-semibold text-slate-800">
                            ${parseFloat(inv.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-5 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${sc.color}`}>
                              {sc.label}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-xs text-slate-500">{fmtDate(inv.dueDate)}</td>
                          <td className="px-5 py-3 text-xs">
                            {inv.paidDate
                              ? <span className="text-green-600 font-medium">{fmtDate(inv.paidDate)}</span>
                              : <span className="text-slate-400">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── Payments tab ─────────────────────────────────────────────────────── */}
      {tab === "payments" && (
        <div className="space-y-4">
          {paymentsLoading ? (
            <div className="flex justify-center py-10">
              <div className="w-5 h-5 border-4 border-slate-200 border-t-[#1a3c5e] rounded-full animate-spin" />
            </div>
          ) : allPayments.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-slate-400">No payment records found.</CardContent>
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
                      const stripeRef = p.stripePaymentIntentId
                        ? `…${p.stripePaymentIntentId.slice(-14)}`
                        : null;
                      return (
                        <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-3">
                            {parent
                              ? <><p className="font-medium text-slate-800">{parent}</p>
                                  {p.parentEmail && <p className="text-xs text-slate-400">{p.parentEmail}</p>}</>
                              : <span className="text-slate-400 text-xs">—</span>}
                          </td>
                          <td className="px-5 py-3 text-right font-semibold text-slate-800">
                            ${parseFloat(p.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-5 py-3">
                            <span className="capitalize text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full font-medium">
                              {p.method || "—"}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${sc.color}`}>
                              {sc.label}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-xs text-slate-500">{fmtDateTime(p.processedAt || p.createdAt)}</td>
                          <td className="px-5 py-3 text-xs font-mono text-slate-400">{stripeRef || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
