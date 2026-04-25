import { X, Printer, CheckCircle, Clock, AlertCircle } from "lucide-react";

function fmtDate(str) {
  if (!str) return "—";
  const d = str.includes("T") ? new Date(str) : new Date(str + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function fmtAmt(n) {
  if (n == null || n === "") return "—";
  return "$" + parseFloat(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const METHOD_LABEL = { stripe: "Stripe", manual: "Manual", credit: "Account Credit" };

export default function ReceiptModal({ familyInvoice, parentName, onClose }) {
  const handlePrint = () => window.print();

  const lineItems = familyInvoice.lineItems || [];
  const pmts = (familyInvoice.payments || []).filter(p => p.status === "paid");
  const totalPaid = pmts.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
  const totalDue = parseFloat(familyInvoice.totalAmount || 0);
  const remaining = Math.max(0, totalDue - totalPaid);

  const StatusIcon = familyInvoice.status === "paid" ? CheckCircle
    : familyInvoice.status === "past_due" ? AlertCircle : Clock;
  const statusLabel = familyInvoice.status === "paid" ? "PAID"
    : familyInvoice.status === "past_due" ? "OVERDUE" : "PENDING";
  const statusCls = familyInvoice.status === "paid" ? "bg-green-100 text-green-700"
    : familyInvoice.status === "past_due" ? "bg-red-100 text-red-600" : "bg-yellow-100 text-yellow-700";

  return (
    <>
      {/*
        Print CSS: hide everything except #receipt-print-root.
        The overlay and buttons carry no-print; the receipt content is inside #receipt-print-root.
      */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #receipt-print-root, #receipt-print-root * { visibility: visible !important; }
          #receipt-print-root {
            position: fixed !important;
            inset: 0 !important;
            padding: 48px !important;
            background: white !important;
            z-index: 99999 !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Overlay — hidden on print */}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 no-print">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

          {/* Modal chrome — hidden on print */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 no-print">
            <h2 className="text-base font-bold text-slate-800">Payment Receipt</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <Printer className="w-3.5 h-3.5" /> Print / Save PDF
              </button>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ── Receipt content — visible on print ─────────────────────────── */}
          <div id="receipt-print-root" className="px-6 py-6 space-y-6">

            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xl font-bold text-[#1a3c5e]">Elevate Education Hub</p>
                <p className="text-xs text-slate-500 mt-0.5">Payment Receipt</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-slate-700">Receipt #FI-{familyInvoice.id}</p>
                <p className="text-xs text-slate-400 mt-0.5">{fmtDate(familyInvoice.paidDate || familyInvoice.dueDate)}</p>
                <span className={`mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${statusCls}`}>
                  <StatusIcon className="w-3 h-3" />{statusLabel}
                </span>
              </div>
            </div>

            {/* Bill To */}
            {parentName && (
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Bill To</p>
                <p className="text-sm font-semibold text-slate-800">{parentName}</p>
              </div>
            )}

            {/* Line items */}
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Items</p>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-600">
                    <th className="text-left py-2 font-semibold">Program</th>
                    <th className="text-left py-2 font-semibold">Student</th>
                    <th className="text-right py-2 font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.length === 0 ? (
                    <tr><td colSpan={3} className="py-3 text-slate-400 text-center text-xs">No line items</td></tr>
                  ) : lineItems.map((item, i) => {
                    const studentName = item.studentFirstName
                      ? `${item.studentFirstName} ${item.studentLastName || ""}`.trim()
                      : item.studentName || "—";
                    const ov = item.activeOverride || item.waiver;
                    const isWaived = item.status === "waived" || item.invoiceStatus === "waived";
                    return (
                      <tr key={item.invoiceId || i} className="border-b border-slate-100">
                        <td className="py-2.5 pr-4">
                          <p className="font-medium text-slate-800">{item.programName || item.description || "Program"}</p>
                          {ov && (ov.amountWaivedCents > 0 || ov.amountWaived > 0) && (
                            <p className="text-xs text-amber-600 mt-0.5">
                              Scholarship: −{fmtAmt((ov.amountWaivedCents ? ov.amountWaivedCents / 100 : ov.amountWaived))} waived
                              {ov.approvedByName && ` · ${ov.approvedByName}`}
                            </p>
                          )}
                          {item.discountPercent && parseFloat(item.discountPercent) > 0 && (
                            <p className="text-xs text-blue-600 mt-0.5">{parseFloat(item.discountPercent)}% discount applied</p>
                          )}
                        </td>
                        <td className="py-2.5 text-slate-500 pr-4">{studentName}</td>
                        <td className={`py-2.5 text-right font-semibold ${isWaived ? "text-slate-400 line-through" : "text-slate-800"}`}>
                          {fmtAmt(item.amount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-72 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Invoice Total</span>
                  <span className="font-medium text-slate-700">{fmtAmt(totalDue)}</span>
                </div>
                {totalPaid > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Amount Paid</span>
                    <span className="font-semibold text-green-700">−{fmtAmt(totalPaid)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold border-t border-slate-200 pt-1.5">
                  <span className="text-slate-700">Balance Due</span>
                  <span className={remaining <= 0 ? "text-green-700" : "text-red-600"}>{fmtAmt(remaining)}</span>
                </div>
              </div>
            </div>

            {/* Payment details */}
            {pmts.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Payment Details</p>
                <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
                  {pmts.map((p, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-700">
                          {METHOD_LABEL[p.method] || p.method}
                        </p>
                        {p.paidAt && (
                          <p className="text-xs text-slate-400 mt-0.5">
                            {new Date(p.paidAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </p>
                        )}
                        {p.stripePaymentIntentId && (
                          <p className="text-[10px] font-mono text-slate-300 mt-0.5">{p.stripePaymentIntentId}</p>
                        )}
                      </div>
                      <span className="font-semibold text-green-700 text-sm">{fmtAmt(p.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Due date info for unpaid */}
            {familyInvoice.status !== "paid" && familyInvoice.dueDate && (
              <p className="text-xs text-slate-500">
                {familyInvoice.status === "past_due" ? "Was due" : "Due"}: {fmtDate(familyInvoice.dueDate)}
              </p>
            )}

            {/* Footer */}
            <div className="pt-4 border-t border-slate-100 text-center space-y-1">
              <p className="text-xs text-slate-400">Elevate Education Hub · Thank you for your payment</p>
              {familyInvoice.stripeSessionId && (
                <p className="text-[10px] font-mono text-slate-300">Ref: {familyInvoice.stripeSessionId}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
