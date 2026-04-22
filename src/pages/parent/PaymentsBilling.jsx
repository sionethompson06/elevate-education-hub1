import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/api/apiClient";
import { Link, useSearchParams } from "react-router-dom";
import {
  CreditCard, DollarSign, CheckCircle, Clock, XCircle, AlertCircle,
  Users, ExternalLink, RefreshCw, Loader2
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import FamilyInvoiceCard from "@/components/parent/FamilyInvoiceCard";
import UpcomingChargesPanel from "@/components/parent/UpcomingChargesPanel";
import PaymentHistory from "@/components/parent/PaymentHistory";

const STATUS_CONFIG = {
  active:          { label: "Active",    color: "bg-green-100 text-green-700 border-green-200",    icon: CheckCircle },
  active_override: { label: "Active",    color: "bg-green-100 text-green-700 border-green-200",    icon: CheckCircle },
  pending_payment: { label: "Pending",   color: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: Clock },
  pending:         { label: "Pending",   color: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: Clock },
  payment_failed:  { label: "Past Due",  color: "bg-red-100 text-red-700 border-red-200",           icon: AlertCircle },
  cancelled:       { label: "Cancelled", color: "bg-slate-100 text-slate-500 border-slate-200",    icon: XCircle },
  paused:          { label: "Paused",    color: "bg-orange-100 text-orange-600 border-orange-200", icon: Clock },
};

const FILTER_TABS = [
  { key: "all",       label: "All" },
  { key: "active",    label: "Active" },
  { key: "pending",   label: "Pending" },
  { key: "past_due",  label: "Past Due" },
  { key: "cancelled", label: "Cancelled" },
];

export default function PaymentsBilling() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const paymentSuccess = searchParams.get("payment") === "success";
  const sessionId = searchParams.get("session_id");
  const enrollmentParam = searchParams.get("enrollment");
  const familyInvoiceParam = searchParams.get("family_invoice");

  const [statusFilter, setStatusFilter] = useState("all");
  const [studentFilter, setStudentFilter] = useState("all");
  const [showSuccess, setShowSuccess] = useState(paymentSuccess);
  const [portalLoading, setPortalLoading] = useState(false);
  const [consolidating, setConsolidating] = useState(false);
  const didConsolidate = useRef(false);

  // Verify payment on success redirect
  useEffect(() => {
    if (!paymentSuccess || !sessionId || !user?.id) return;

    if (familyInvoiceParam) {
      // Family invoice payment verification
      apiPost("/stripe/verify-family-payment", {
        family_invoice_id: Number(familyInvoiceParam),
        session_id: sessionId,
      }).then(() => {
        qc.invalidateQueries({ queryKey: ["parent-my-students"] });
        qc.invalidateQueries({ queryKey: ["parent-family-invoices"] });
      }).catch(err => console.error("[verify-family-payment]", err));
    } else if (enrollmentParam) {
      // Single enrollment payment verification (legacy / admin-initiated)
      apiPost("/stripe/verify-payment", {
        enrollment_id: Number(enrollmentParam),
        session_id: sessionId,
      }).then(() => {
        qc.invalidateQueries({ queryKey: ["parent-my-students"] });
        qc.invalidateQueries({ queryKey: ["parent-family-invoices"] });
      }).catch(err => console.error("[verify-payment]", err));
    }
  }, [paymentSuccess, sessionId, user?.id, familyInvoiceParam, enrollmentParam]);

  // Auto-dismiss success banner after 6 seconds
  useEffect(() => {
    if (showSuccess) {
      qc.invalidateQueries({ queryKey: ["parent-my-students"] });
      qc.invalidateQueries({ queryKey: ["parent-family-invoices"] });
      const t = setTimeout(() => setShowSuccess(false), 6000);
      return () => clearTimeout(t);
    }
  }, [showSuccess]);

  // Enrollment data
  const { data: myData = { students: [], enrollments: [] }, isLoading, refetch } = useQuery({
    queryKey: ["parent-my-students", user?.id],
    queryFn: () => apiGet("/enrollments/my-students"),
    enabled: !!user?.id,
  });

  // Family invoices
  const { data: fiData, isLoading: fiLoading, refetch: refetchFi } = useQuery({
    queryKey: ["parent-family-invoices", user?.id],
    queryFn: () => apiGet("/billing/family-invoices"),
    enabled: !!user?.id,
  });

  // Billing account for Stripe portal
  const { data: accountData } = useQuery({
    queryKey: ["parent-billing-account", user?.id],
    queryFn: () => apiGet("/billing/my-account"),
    enabled: !!user?.id,
  });

  const students = myData.students || [];
  const enrollments = myData.enrollments || [];
  const billingAccount = accountData?.account || null;
  const allFamilyInvoices = fiData?.familyInvoices || [];

  // Pending family invoice (the most recent pending one)
  const pendingFamilyInvoice = allFamilyInvoices.find(fi => fi.status === "pending") || null;

  // Paid family invoices for history
  const paidFamilyInvoices = allFamilyInvoices.filter(fi => fi.status === "paid");

  // Enrollments with failed payments (shown separately — not in family invoice flow)
  const failedEnrollments = enrollments.filter(e => e.status === "payment_failed");

  // Auto-consolidate: if there are pending enrollments, ensure a family invoice exists
  useEffect(() => {
    if (!user?.id || isLoading) return;
    if (didConsolidate.current) return;

    const hasPendingInvoices = enrollments.some(e =>
      ["pending_payment", "pending"].includes(e.status) ||
      (e.status === "active_override" && e.invoiceStatus !== "paid" && e.invoiceStatus !== "waived")
    );
    if (!hasPendingInvoices) return;

    didConsolidate.current = true;
    setConsolidating(true);
    apiPost("/billing/family-invoice", {})
      .then(() => {
        qc.invalidateQueries({ queryKey: ["parent-family-invoices"] });
      })
      .catch(err => {
        didConsolidate.current = false;
        console.error("[auto-consolidate]", err);
      })
      .finally(() => setConsolidating(false));
  }, [user?.id, isLoading, enrollments.length]);

  // Stats
  const activeEnrollments = enrollments.filter(e =>
    ["active", "active_override"].includes(e.status) && e.invoiceStatus === "paid"
  );
  const pendingCount = pendingFamilyInvoice ? (pendingFamilyInvoice.lineItems?.length || 0) : 0;
  const activeCount = activeEnrollments.length;

  const monthlySpend = activeEnrollments
    .filter(e => (e.billingCycleOverride || e.programBillingCycle) === "monthly")
    .reduce((sum, e) => sum + (e.invoiceAmount != null ? parseFloat(e.invoiceAmount) : (parseFloat(e.programTuition) || 0)), 0);

  const annualSpend = activeEnrollments.reduce((sum, e) => {
    const cycle = e.billingCycleOverride || e.programBillingCycle;
    const amount = e.invoiceAmount != null ? parseFloat(e.invoiceAmount) : (parseFloat(e.programTuition) || 0);
    if (cycle === "annual") return sum + amount;
    if (cycle === "monthly") return sum + amount * 12;
    return sum;
  }, 0);

  // Filtered enrollments for the card list
  const filtered = enrollments.filter(e => {
    const statusMatch =
      statusFilter === "all" ||
      (statusFilter === "active"    && ["active", "active_override"].includes(e.status)) ||
      (statusFilter === "pending"   && ["pending_payment", "pending"].includes(e.status)) ||
      (statusFilter === "past_due"  && e.status === "payment_failed") ||
      (statusFilter === "cancelled" && e.status === "cancelled");
    const studentMatch = studentFilter === "all" || e.studentId === studentFilter;
    return statusMatch && studentMatch;
  });

  const openBillingPortal = async () => {
    setPortalLoading(true);
    try {
      const res = await apiPost("/stripe/portal", { return_url: window.location.href });
      if (res.url) window.open(res.url, "_blank");
    } catch (err) {
      console.error("Billing portal error:", err);
    } finally {
      setPortalLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-[#1a3c5e]">Payments & Billing</h1>
          <p className="text-slate-500 text-sm mt-0.5">Manage your enrollments and payment history</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => { refetch(); refetchFi(); }} disabled={isLoading}>
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Refresh
          </Button>
          {billingAccount?.stripeCustomerId && (
            <Button variant="outline" className="gap-2" onClick={openBillingPortal} disabled={portalLoading}>
              {portalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
              Manage Subscription
            </Button>
          )}
        </div>
      </div>

      {/* Payment success banner */}
      {showSuccess && (
        <div className="flex items-center justify-between gap-3 bg-green-50 border border-green-200 rounded-xl px-5 py-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
            <div>
              <p className="font-semibold text-green-800">Payment Successful!</p>
              <p className="text-sm text-green-700">Your enrollment{pendingCount > 1 ? "s are" : " is"} now active. Welcome aboard!</p>
            </div>
          </div>
          <button onClick={() => { setShowSuccess(false); refetch(); refetchFi(); }} className="text-green-600 hover:text-green-800">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-green-700">{activeCount}</p>
          <p className="text-xs text-slate-500 mt-0.5">Active</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
          <p className="text-xs text-slate-500 mt-0.5">Pending Payment</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-[#1a3c5e]">${monthlySpend.toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-0.5">Monthly</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-slate-700">${annualSpend.toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-0.5">Annual Equiv.</p>
        </div>
      </div>

      {/* ── Consolidated pending invoice ───────────────────────────────────── */}
      {(fiLoading || consolidating) && !pendingFamilyInvoice && (
        <div className="flex items-center gap-2 text-sm text-slate-500 py-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Preparing invoice…
        </div>
      )}

      {pendingFamilyInvoice && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Payment Due</p>
          <FamilyInvoiceCard
            familyInvoice={pendingFamilyInvoice}
            onPaymentStarted={() => {}}
          />
        </div>
      )}

      {/* Failed payment banner */}
      {failedEnrollments.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <p className="text-sm font-semibold text-red-800">Payment Failed</p>
          </div>
          <p className="text-sm text-red-700 mb-3">
            {failedEnrollments.length} enrollment{failedEnrollments.length > 1 ? "s have" : " has"} a failed payment. Please retry or update your billing method.
          </p>
          <div className="flex flex-wrap gap-2">
            {failedEnrollments.map(e => (
              <Link key={e.id} to={`/parent/checkout?enrollment_id=${e.id}`}>
                <button className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 transition-colors flex items-center gap-1">
                  <CreditCard className="w-3.5 h-3.5" /> Retry — {e.programName || `Program #${e.programId}`}
                </button>
              </Link>
            ))}
            {billingAccount?.stripeCustomerId && (
              <button
                onClick={openBillingPortal}
                className="text-xs border border-red-300 text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors flex items-center gap-1"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Manage Billing
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Upcoming charges ────────────────────────────────────────────────── */}
      <UpcomingChargesPanel enrollments={enrollments} />

      {/* ── Enrollment detail cards ─────────────────────────────────────────── */}
      <div>
        <div className="flex flex-wrap gap-3 items-center mb-3">
          <div className="flex gap-1.5 flex-wrap">
            {FILTER_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  statusFilter === tab.key
                    ? "bg-[#1a3c5e] text-white border-[#1a3c5e]"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {students.length > 1 && (
            <div className="flex gap-1.5 flex-wrap ml-auto">
              <button
                onClick={() => setStudentFilter("all")}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border flex items-center gap-1 transition-colors ${
                  studentFilter === "all"
                    ? "bg-slate-800 text-white border-slate-800"
                    : "bg-white text-slate-600 border-slate-200"
                }`}
              >
                <Users className="w-3 h-3" /> All Students
              </button>
              {students.map(s => (
                <button
                  key={s.id}
                  onClick={() => setStudentFilter(s.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    studentFilter === s.id
                      ? "bg-slate-800 text-white border-slate-800"
                      : "bg-white text-slate-600 border-slate-200"
                  }`}
                >
                  {s.firstName} {s.lastName}
                </button>
              ))}
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-5 h-5 border-4 border-slate-200 border-t-[#1a3c5e] rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <p className="text-slate-400 text-sm">No enrollments found.</p>
              <Link to="/parent/programs" className="text-xs text-[#1a3c5e] hover:underline mt-1 block">
                Browse Programs →
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map(e => {
              const sc = STATUS_CONFIG[e.status] || STATUS_CONFIG.pending_payment;
              const Icon = sc.icon;
              const studentName = e.studentFirstName
                ? `${e.studentFirstName} ${e.studentLastName || ""}`.trim()
                : null;
              const effectiveCycle = e.billingCycleOverride || e.programBillingCycle;
              const displayAmount = e.invoiceAmount != null ? parseFloat(e.invoiceAmount) : (parseFloat(e.programTuition) || null);
              const enrolledDate = e.startDate || e.createdAt;
              const isPendingPayment = ["pending_payment", "pending"].includes(e.status) ||
                (e.status === "active_override" && e.invoiceStatus !== "paid" && e.invoiceStatus !== "waived");

              return (
                <div key={e.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-slate-800">
                          {e.programName || `Program #${e.programId}`}
                        </p>
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium flex items-center gap-1 ${sc.color}`}>
                          <Icon className="w-3 h-3" /> {sc.label}
                        </span>
                      </div>
                      {studentName && (
                        <p className="text-xs text-slate-500 mb-2">Student: {studentName}</p>
                      )}
                      <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                        {effectiveCycle && (
                          <span className="capitalize">💳 {effectiveCycle.replace(/_/g, " ")} billing</span>
                        )}
                        {displayAmount != null && (
                          <span>
                            <DollarSign className="w-3 h-3 inline" />
                            {effectiveCycle === "annual"
                              ? `$${displayAmount.toLocaleString()} / year`
                              : `$${displayAmount.toLocaleString()} / month`}
                          </span>
                        )}
                        {e.invoiceStatus && (
                          <span className="capitalize">Invoice: {e.invoiceStatus.replace(/_/g, " ")}</span>
                        )}
                        {e.invoiceDueDate && !e.invoicePaidDate && (
                          <span>Due: {new Date(e.invoiceDueDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                        )}
                        {e.invoicePaidDate && (
                          <span className="text-green-600">Paid: {new Date(e.invoicePaidDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                        )}
                        {enrolledDate && (
                          <span>Enrolled: {new Date(enrolledDate).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                    {/* Only show individual pay button for payment_failed; pending are handled by FamilyInvoiceCard */}
                    {e.status === "payment_failed" && (
                      <Link to={`/parent/checkout?enrollment_id=${e.id}`}>
                        <Button size="sm" className="bg-red-600 hover:bg-red-700">
                          <CreditCard className="w-3.5 h-3.5 mr-1" /> Retry Payment
                        </Button>
                      </Link>
                    )}
                    {isPendingPayment && e.status !== "payment_failed" && (
                      <span className="text-xs text-slate-400 italic">See invoice above</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Paid family invoice history ────────────────────────────────────── */}
      {paidFamilyInvoices.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Payment History</p>
          <div className="space-y-3">
            {paidFamilyInvoices.map(fi => (
              <FamilyInvoiceCard key={fi.id} familyInvoice={fi} />
            ))}
          </div>
        </div>
      )}

      {/* Individual invoice history (for single-enrollment payments made before family billing) */}
      <PaymentHistory />
    </div>
  );
}
