import { useState } from "react";
import { CreditCard, CheckCircle, Clock, ChevronDown, ChevronUp, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiPost } from "@/api/apiClient";

function daysOverdue(dueDate) {
  if (!dueDate) return 0;
  const due = new Date(dueDate + "T00:00:00");
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((today - due) / 86400000));
}

function daysUntilDue(dueDate) {
  if (!dueDate) return null;
  const due = new Date(dueDate + "T00:00:00");
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.floor((due - today) / 86400000);
}

function formatDate(str) {
  if (!str) return "";
  return new Date(str + "T00:00:00").toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

export default function FamilyInvoiceCard({ familyInvoice, variant = "pending", onPaymentStarted }) {
  const [paying, setPaying] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [error, setError] = useState("");

  const isPaid = variant === "paid" || familyInvoice.status === "paid";
  const isOverdueProp = variant === "past_due";
  const totalAmount = parseFloat(familyInvoice.totalAmount || 0);
  const lineItems = familyInvoice.lineItems || [];
  const paymentHistory = familyInvoice.payments || [];

  const cardClass = isPaid
    ? "border-green-200 bg-green-50"
    : isOverdueProp
      ? "border-red-300 bg-red-50/60"
      : "border-[#1a3c5e]/20 bg-white";

  const headerLabel = isPaid ? "Invoice Paid" : isOverdueProp ? "Overdue Balance" : "Outstanding Balance";
  const HeaderIcon = isPaid ? CheckCircle : isOverdueProp ? AlertCircle : CreditCard;
  const iconColor = isPaid ? "text-green-600" : isOverdueProp ? "text-red-500" : "text-[#1a3c5e]";
  const amountColor = isPaid ? "text-green-700" : isOverdueProp ? "text-red-700" : "text-[#1a3c5e]";

  const dueLabelNode = (() => {
    if (isPaid) {
      return familyInvoice.paidDate
        ? <span className="text-slate-500">Paid {formatDate(familyInvoice.paidDate)}</span>
        : null;
    }
    if (!familyInvoice.dueDate) return null;
    if (isOverdueProp) {
      return <span className="text-red-600 font-medium">Overdue since {formatDate(familyInvoice.dueDate)}</span>;
    }
    const days = daysUntilDue(familyInvoice.dueDate);
    if (days === 0) return <span className="text-amber-600 font-medium">Due today</span>;
    if (days !== null && days > 0 && days <= 7) return <span className="text-amber-600">Due in {days} day{days !== 1 ? "s" : ""}</span>;
    return <span className="text-slate-500">Due {formatDate(familyInvoice.dueDate)}</span>;
  })();

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
    <div className={`rounded-xl border-2 shadow-sm overflow-hidden ${cardClass}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <HeaderIcon className={`w-5 h-5 shrink-0 ${iconColor}`} />
          <div>
            <p className="font-bold text-slate-800 text-base">{headerLabel}</p>
            <p className="text-xs flex items-center gap-1 flex-wrap">
              <span className="text-slate-500">
                {lineItems.length} program{lineItems.length !== 1 ? "s" : ""}
              </span>
              {dueLabelNode && <span className="text-slate-400">·</span>}
              {dueLabelNode}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <p className={`text-xl font-bold ${amountColor}`}>
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
            const ov = item.activeOverride;
            return (
              <div key={item.invoiceId || i} className="flex items-start justify-between px-5 py-3 gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800">
                    {item.programName || item.description || "Program"}
                  </p>
                  {studentName && (
                    <p className="text-xs text-slate-400">Student: {studentName}</p>
                  )}
                  {ov && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200 capitalize">
                        {ov.overrideType?.replace(/_/g, " ") || "Override"}
                      </span>
                      {ov.amountWaivedCents > 0 && (
                        <span className="text-[10px] text-amber-700 font-medium">
                          ${(ov.amountWaivedCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })} waived
                        </span>
                      )}
                      {ov.amountDeferredCents > 0 && (
                        <span className="text-[10px] text-blue-600 font-medium">
                          ${(ov.amountDeferredCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })} deferred
                        </span>
                      )}
                      {ov.approvedByName && (
                        <span className="text-[10px] text-slate-400">· {ov.approvedByName}</span>
                      )}
                    </div>
                  )}
                </div>
                <p className="text-sm font-semibold text-slate-700 shrink-0">
                  ${parseFloat(item.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            );
          })}

          {/* Total row */}
          <div className="flex items-center justify-between px-5 py-3 bg-slate-50">
            <p className="text-sm font-semibold text-slate-700">Total</p>
            <p className={`text-sm font-bold ${isPaid ? "text-green-700" : isOverdueProp ? "text-red-700" : "text-[#1a3c5e]"}`}>
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
                className={`w-full text-white font-semibold ${isOverdueProp ? "bg-red-600 hover:bg-red-700" : "bg-[#1a3c5e] hover:bg-[#0d2540]"}`}
              >
                {paying
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing…</>
                  : <><CreditCard className="w-4 h-4 mr-2" />{isOverdueProp ? "Pay Overdue Balance" : "Pay"} ${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>}
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
