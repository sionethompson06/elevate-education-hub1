import { useState } from "react";
import { CreditCard, CheckCircle, Clock, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiPost } from "@/api/apiClient";

export default function FamilyInvoiceCard({ familyInvoice, onPaymentStarted }) {
  const [paying, setPaying] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [error, setError] = useState("");

  const isPaid = familyInvoice.status === "paid";
  const totalAmount = parseFloat(familyInvoice.totalAmount || 0);
  const lineItems = familyInvoice.lineItems || [];
  const paymentHistory = familyInvoice.payments || [];

  const handlePay = async () => {
    setPaying(true);
    setError("");
    try {
      const res = await apiPost("/stripe/family-checkout", {
        family_invoice_id: familyInvoice.id,
      });
      if (res.url) {
        if (onPaymentStarted) onPaymentStarted();
        window.location.href = res.url;
      } else {
        setError("Failed to start checkout. Please try again.");
      }
    } catch (err) {
      setError(err.message || "Checkout failed. Please try again.");
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className={`rounded-xl border-2 shadow-sm overflow-hidden ${isPaid ? "border-green-200 bg-green-50" : "border-[#1a3c5e]/20 bg-white"}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          {isPaid
            ? <CheckCircle className="w-5 h-5 text-green-600" />
            : <CreditCard className="w-5 h-5 text-[#1a3c5e]" />}
          <div>
            <p className="font-bold text-slate-800 text-base">
              {isPaid ? "Invoice Paid" : "Outstanding Balance"}
            </p>
            <p className="text-xs text-slate-500">
              {lineItems.length} program{lineItems.length !== 1 ? "s" : ""}
              {familyInvoice.dueDate && !isPaid
                ? ` · Due ${new Date(familyInvoice.dueDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                : ""}
              {familyInvoice.paidDate && isPaid
                ? ` · Paid ${new Date(familyInvoice.paidDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <p className={`text-xl font-bold ${isPaid ? "text-green-700" : "text-[#1a3c5e]"}`}>
            ${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <button
            onClick={() => setExpanded(e => !e)}
            className="p-1 rounded hover:bg-slate-100 text-slate-400"
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Line items */}
      {expanded && (
        <div className="divide-y divide-slate-100">
          {lineItems.map((item, i) => {
            const studentName = item.studentFirstName
              ? `${item.studentFirstName} ${item.studentLastName || ""}`.trim()
              : null;
            return (
              <div key={item.invoiceId || i} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {item.programName || item.description || "Program"}
                  </p>
                  {studentName && (
                    <p className="text-xs text-slate-400">Student: {studentName}</p>
                  )}
                </div>
                <p className="text-sm font-semibold text-slate-700">
                  ${parseFloat(item.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            );
          })}

          {/* Total row */}
          <div className="flex items-center justify-between px-5 py-3 bg-slate-50">
            <p className="text-sm font-semibold text-slate-700">Total</p>
            <p className={`text-sm font-bold ${isPaid ? "text-green-700" : "text-[#1a3c5e]"}`}>
              ${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>

          {/* Pay button (unpaid only) */}
          {!isPaid && (
            <div className="px-5 py-4 flex flex-col gap-2">
              {error && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
              )}
              <Button
                onClick={handlePay}
                disabled={paying}
                className="w-full bg-[#1a3c5e] hover:bg-[#0d2540] text-white font-semibold"
              >
                {paying
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing…</>
                  : <><CreditCard className="w-4 h-4 mr-2" />Pay ${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>}
              </Button>
              <p className="text-xs text-center text-slate-400">Secure payment via Stripe · All programs paid in one transaction</p>
            </div>
          )}

          {/* Payment history (paid invoice) */}
          {isPaid && paymentHistory.length > 0 && (
            <div className="px-5 py-3">
              {paymentHistory.map((p, i) => (
                <div key={i} className="flex items-center justify-between text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {p.processedAt
                      ? new Date(p.processedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                      : "—"}
                    &nbsp;·&nbsp;{p.method === "stripe" ? "Stripe" : "Manual"}
                  </span>
                  <span className="font-semibold text-green-700">${parseFloat(p.amount || 0).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
