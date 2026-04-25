import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/api/apiClient";
import { FileText, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import ReceiptModal from "@/components/parent/ReceiptModal";

function fmtAmt(n) {
  return "$" + parseFloat(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(str) {
  if (!str) return null;
  const d = str.includes("T") ? new Date(str) : new Date(str + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function isOverdue(fi) {
  if (fi.status === "past_due") return true;
  if (fi.status === "pending" && fi.dueDate) {
    const due = new Date(fi.dueDate + "T00:00:00");
    return due < new Date();
  }
  return false;
}

export default function StatementsReceipts() {
  const { user } = useAuth();
  const [receiptInvoice, setReceiptInvoice] = useState(null);

  const { data: fiData, isLoading, refetch } = useQuery({
    queryKey: ["parent-family-invoices-statements", user?.id],
    queryFn: () => apiGet("/billing/family-invoices"),
    enabled: !!user?.id,
  });

  const { data: accountData } = useQuery({
    queryKey: ["parent-billing-account-statements", user?.id],
    queryFn: () => apiGet("/billing/my-account"),
    enabled: !!user?.id,
  });

  const allInvoices = fiData?.familyInvoices || [];
  const paidInvoices = allInvoices.filter(fi => fi.status === "paid");
  const billingAccount = accountData?.account || null;

  const totalInvoiced = allInvoices.reduce((s, fi) => s + parseFloat(fi.totalAmount || 0), 0);
  const totalPaid = paidInvoices.reduce((s, fi) => s + parseFloat(fi.totalAmount || 0), 0);
  const creditBalance = parseFloat(billingAccount?.balance || 0);

  const parentName = user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : "";

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-[#1a3c5e]">Statements & Receipts</h1>
          <p className="text-slate-500 text-sm mt-0.5">View and print receipts for all your payments</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => refetch()} disabled={isLoading}>
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Refresh
        </Button>
      </div>

      {/* Account summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 px-5 py-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-slate-700">{fmtAmt(totalInvoiced)}</p>
          <p className="text-xs text-slate-400 mt-1 uppercase tracking-wide">Total Invoiced</p>
        </div>
        <div className="bg-green-50 rounded-xl border border-green-200 px-5 py-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-green-700">{fmtAmt(totalPaid)}</p>
          <p className="text-xs text-green-500 mt-1 uppercase tracking-wide">Total Paid</p>
        </div>
        <div className={`rounded-xl border px-5 py-4 text-center shadow-sm ${creditBalance > 0 ? "bg-emerald-50 border-emerald-200" : "bg-white border-slate-200"}`}>
          <p className={`text-2xl font-bold ${creditBalance > 0 ? "text-emerald-700" : "text-slate-400"}`}>{fmtAmt(creditBalance)}</p>
          <p className={`text-xs mt-1 uppercase tracking-wide ${creditBalance > 0 ? "text-emerald-500" : "text-slate-400"}`}>Account Credit</p>
        </div>
      </div>

      {/* Invoice list */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
          <FileText className="w-4 h-4 text-[#1a3c5e]" />
          <h2 className="text-sm font-bold text-slate-800">All Invoices</h2>
          {!isLoading && allInvoices.length > 0 && (
            <span className="ml-auto text-xs text-slate-400">{allInvoices.length} record{allInvoices.length !== 1 ? "s" : ""}</span>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading invoices…</span>
          </div>
        ) : allInvoices.length === 0 ? (
          <div className="py-16 text-center">
            <FileText className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-500">No invoices yet</p>
            <p className="text-xs text-slate-400 mt-1">Your invoices and receipts will appear here after enrollment.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {allInvoices.map(fi => {
              const isPaid = fi.status === "paid";
              const over = isOverdue(fi);
              const dateStr = fmtDate(fi.paidDate || fi.dueDate || fi.createdAt);
              const programs = (fi.lineItems || []).map(l => l.programName).filter(Boolean);
              const programLabel = programs.length === 0
                ? "Invoice"
                : programs.length === 1
                  ? programs[0]
                  : `${programs[0]} +${programs.length - 1} more`;

              return (
                <div key={fi.id} className="flex items-center gap-4 px-5 py-4">
                  {/* Status dot */}
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${isPaid ? "bg-green-500" : over ? "bg-red-500" : "bg-yellow-400"}`} />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{programLabel}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                      <span className={`text-xs font-medium ${isPaid ? "text-green-600" : over ? "text-red-600" : "text-yellow-600"}`}>
                        {isPaid ? "Paid" : over ? "Overdue" : "Pending"}
                      </span>
                      {dateStr && (
                        <span className="text-xs text-slate-400">
                          {isPaid ? `Paid ${dateStr}` : `Due ${dateStr}`}
                        </span>
                      )}
                      {(fi.lineItems?.length || 0) > 0 && (
                        <span className="text-xs text-slate-400">{fi.lineItems.length} item{fi.lineItems.length !== 1 ? "s" : ""}</span>
                      )}
                    </div>
                  </div>

                  {/* Amount */}
                  <span className={`text-sm font-bold shrink-0 ${isPaid ? "text-green-700" : over ? "text-red-700" : "text-slate-700"}`}>
                    {fmtAmt(fi.totalAmount)}
                  </span>

                  {/* Receipt button */}
                  <button
                    onClick={() => setReceiptInvoice(fi)}
                    className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-[#1a3c5e] border border-[#1a3c5e]/25 rounded-lg px-3 py-2 hover:bg-[#1a3c5e]/5 transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    {isPaid ? "Receipt" : "Statement"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Receipt modal */}
      {receiptInvoice && (
        <ReceiptModal
          familyInvoice={receiptInvoice}
          parentName={parentName}
          onClose={() => setReceiptInvoice(null)}
        />
      )}
    </div>
  );
}
