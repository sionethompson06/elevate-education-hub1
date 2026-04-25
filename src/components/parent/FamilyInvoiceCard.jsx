import { useState } from "react";
import { CreditCard, CheckCircle, Clock, ChevronDown, ChevronUp, Loader2, AlertCircle, ExternalLink } from "lucide-react";
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

export default function FamilyInvoiceCard({
  familyInvoice,
  variant = "pending",
  onPaymentStarted,
  creditBalance = 0,
  onNeedsPortal,
}) {
  const [paying, setPaying] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [error, setError] = useState("");
  const [needsPortal, setNeedsPortal] = useState(false);
  const [paidWithCredit, setPaidWithCredit] = useState(false);

  const isPaid = paidWithCredit || variant === "paid" || familyInvoice.status === "paid";
  const isOverdueProp = variant === "past_due";
  const totalAmount = parseFloat(familyInvoice.totalAmount || 0);
  const lineItems = familyInvoice.lineItems || [];
  const paymentHistory = familyInvoice.payments || [];

  // Credit that can be applied — capped at the outstanding total
  const credit = Math.min(parseFloat(creditBalance || 0), totalAmount);
  const netCharge = Math.max(0, totalAmount - credit);

  const cardClass = isPaid
    ? "border-green-200 bg-green-50"
    : isOverdueProp
      ? "border-red-300 bg-red-50/60"
      : "border-[#1a3c5e]/20 bg-white";

  const headerLabel = isPaid
    ? "Invoice Paid"
    : isOverdueProp
      ? "Overdue Balance"
      : "Outstanding Balance";
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
    setNeedsPortal(false);
    try {
      const res = await apiPost("/stripe/family-checkout", {
        family_invoice_id: familyInvoice.id,
      });

      if (res.activated) {
        // Credit covered the full balance — no Stripe redirect needed
        setPaidWithCredit(true);
        if (onPaymentStarted) onPaymentStarted();
        return;
      }

      if (res.url) {
        if (onPaymentStarted) onPaymentStarted();
        window.location.href = res.url;
      } else {
        setError("Failed to start checkout. Please try again.");
      }
    } catch (err) {
      if (err.message === "subscription_retry_required") {
        // Don't auto-trigger portal here — just show the portal button.
        // The auto-trigger silently fails if Stripe portal isn't configured.
        setNeedsPortal(true);
      } else {
        setError(err.message || "Checkout failed. Please try again.");
      }
    } finally {
      setPaying(false);
    }
  };

  const handlePortal = async () => {
    setPaying(true);
    setError("");
    try {
      const res = await apiPost("/stripe/portal", { return_url: window.location.href });
      if (res.url) {
        window.location.href = res.url;
      } else {
        setError("Billing portal is not available. Please contact support.");
      }
    } catch (err) {
      setError(err.message || "Could not open billing portal. The portal may not be configured yet.");
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

          {/* Credit line item */}
          {!isPaid && credit > 0 && (
            <div className="flex items-center justify-between px-5 py-3 bg-emerald-50">
              <p className="text-sm text-emerald-700 font-medium">Account Credit Applied</p>
              <p className="text-sm font-semibold text-emerald-700">
                −${credit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          )}

          {/* Total row */}
          <div className="flex items-center justify-between px-5 py-3 bg-slate-50">
            <p className="text-sm font-semibold text-slate-700">
              {credit > 0 && !isPaid ? "Total Due After Credit" : "Total"}
            </p>
            <p className={`text-sm font-bold ${isPaid ? "text-green-700" : isOverdueProp ? "text-red-700" : "text-[#1a3c5e]"}`}>
              ${(isPaid ? totalAmount : netCharge).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>

          {/* Paid with credit notice */}
          {paidWithCredit && (
            <div className="px-5 py-3 flex items-center gap-2 text-emerald-700 bg-emerald-50">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <p className="text-sm font-medium">Paid with account credit</p>
            </div>
          )}

          {/* Pay button or portal redirect (unpaid only) */}
          {!isPaid && (
            <div className="px-5 py-4 flex flex-col gap-2">
              {error && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
              )}

              {needsPortal ? (
                <>
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                    This payment is managed through your Stripe subscription. Please update your payment method via the billing portal.
                  </p>
                  <Button
                    onClick={handlePortal}
                    disabled={paying}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                  >
                    {paying
                      ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Opening Portal…</>
                      : <><ExternalLink className="w-4 h-4 mr-2" />Update Payment Method</>}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    onClick={handlePay}
                    disabled={paying}
                    className={`w-full text-white font-semibold ${isOverdueProp ? "bg-red-600 hover:bg-red-700" : "bg-[#1a3c5e] hover:bg-[#0d2540]"}`}
                  >
                    {paying
                      ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing…</>
                      : <><CreditCard className="w-4 h-4 mr-2" />
                          {isOverdueProp ? "Pay Overdue Balance" : "Pay"}{" "}
                          ${netCharge.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </>}
                  </Button>
                  <p className="text-xs text-center text-slate-400">
                    {credit > 0
                      ? `$${credit.toLocaleString(undefined, { minimumFractionDigits: 2 })} account credit applied · Secure payment via Stripe`
                      : "Secure payment via Stripe · All programs paid in one transaction"}
                  </p>
                </>
              )}
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
                    &nbsp;·&nbsp;{p.method === "stripe" ? "Stripe" : p.method === "credit" ? "Account Credit" : "Manual"}
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
