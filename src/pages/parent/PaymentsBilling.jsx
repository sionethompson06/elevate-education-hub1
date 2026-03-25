import { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link, useSearchParams } from "react-router-dom";
import {
  CreditCard, DollarSign, CheckCircle, Clock, XCircle, AlertCircle,
  Users, ExternalLink, RefreshCw, Loader2
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import PaymentHistory from "@/components/parent/PaymentHistory";

const STATUS_CONFIG = {
  active:          { label: "Active",        color: "bg-green-100 text-green-700 border-green-200",   icon: CheckCircle },
  active_override: { label: "Active",        color: "bg-green-100 text-green-700 border-green-200",   icon: CheckCircle },
  pending_payment: { label: "Pending",       color: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: Clock },
  payment_failed:  { label: "Past Due",      color: "bg-red-100 text-red-700 border-red-200",          icon: AlertCircle },
  cancelled:       { label: "Cancelled",     color: "bg-slate-100 text-slate-500 border-slate-200",   icon: XCircle },
  paused:          { label: "Paused",        color: "bg-orange-100 text-orange-600 border-orange-200", icon: Clock },
};

const FILTER_TABS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "pending", label: "Pending" },
  { key: "past_due", label: "Past Due" },
  { key: "cancelled", label: "Cancelled" },
];

export default function PaymentsBilling() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const paymentSuccess = searchParams.get("payment") === "success";

  const [statusFilter, setStatusFilter] = useState("all");
  const [studentFilter, setStudentFilter] = useState("all");
  const [portalLoading, setPortalLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(paymentSuccess);

  // Auto-dismiss success banner after 6s
  useEffect(() => {
    if (showSuccess) {
      qc.invalidateQueries({ queryKey: ["billing-enrollments"] });
      const t = setTimeout(() => setShowSuccess(false), 6000);
      return () => clearTimeout(t);
    }
  }, [showSuccess]);

  const { data: parents = [] } = useQuery({
    queryKey: ["parent-record", user?.email],
    queryFn: () => base44.entities.Parent.filter({ user_email: user.email }),
    enabled: !!user?.email,
  });
  const parent = parents[0];
  const studentIds = parent?.student_ids || [];

  const { data: students = [] } = useQuery({
    queryKey: ["parent-students-billing", studentIds],
    queryFn: async () => {
      if (!studentIds.length) return [];
      const all = await Promise.all(studentIds.map(sid => base44.entities.Student.filter({ id: sid })));
      return all.flat();
    },
    enabled: studentIds.length > 0,
  });

  const { data: enrollments = [], isLoading, refetch } = useQuery({
    queryKey: ["billing-enrollments", studentIds],
    queryFn: async () => {
      if (!studentIds.length) return [];
      const all = await Promise.all(studentIds.map(sid => base44.entities.Enrollment.filter({ student_id: sid })));
      return all.flat();
    },
    enabled: studentIds.length > 0,
  });

  // Filter
  const filtered = enrollments.filter(e => {
    const statusMatch =
      statusFilter === "all" ||
      (statusFilter === "active" && ["active", "active_override"].includes(e.status)) ||
      (statusFilter === "pending" && e.status === "pending_payment") ||
      (statusFilter === "past_due" && e.status === "payment_failed") ||
      (statusFilter === "cancelled" && e.status === "cancelled");
    const studentMatch = studentFilter === "all" || e.student_id === studentFilter;
    return statusMatch && studentMatch;
  });

  // Stats
  const activeCount = enrollments.filter(e => ["active", "active_override"].includes(e.status)).length;
  const pendingCount = enrollments.filter(e => e.status === "pending_payment").length;
  const monthlySpend = enrollments
    .filter(e => ["active", "active_override"].includes(e.status) && e.billing_cycle === "monthly")
    .reduce((sum, e) => sum + (e.amount_due || 0), 0);
  const annualSpend = enrollments
    .filter(e => ["active", "active_override"].includes(e.status))
    .reduce((sum, e) => sum + (e.billing_cycle === "annual" ? (e.amount_due || 0) : (e.amount_due || 0) * 12), 0);

  const openStripePortal = async () => {
    setPortalLoading(true);
    try {
      const res = await base44.functions.invoke("stripePortal", {
        return_url: window.location.href,
      });
      if (res.data?.url) {
        window.location.href = res.data.url;
      } else {
        alert(res.data?.error || "Could not open billing portal.");
      }
    } catch (err) {
      alert("Billing portal is not available yet. Please complete a payment first.");
    } finally {
      setPortalLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-[#1a3c5e]">Payments & Billing</h1>
          <p className="text-slate-500 text-sm mt-0.5">Manage your enrollments and payment history</p>
        </div>
        {parent?.stripe_customer_id && (
          <Button
            variant="outline"
            className="gap-2"
            onClick={openStripePortal}
            disabled={portalLoading}
          >
            {portalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
            Manage Subscription
          </Button>
        )}
      </div>

      {/* Success banner */}
      {showSuccess && (
        <div className="flex items-center justify-between gap-3 bg-green-50 border border-green-200 rounded-xl px-5 py-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
            <div>
              <p className="font-semibold text-green-800">Payment Successful!</p>
              <p className="text-sm text-green-700">Your enrollment is now active. Welcome aboard!</p>
            </div>
          </div>
          <button onClick={() => { setShowSuccess(false); refetch(); }} className="text-green-600 hover:text-green-800">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 4-stat bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-green-700">{activeCount}</p>
          <p className="text-xs text-slate-500 mt-0.5">Active</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
          <p className="text-xs text-slate-500 mt-0.5">Pending</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-[#1a3c5e]">${monthlySpend.toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-0.5">Monthly Spend</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-slate-700">${annualSpend.toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-0.5">Annual Equiv.</p>
        </div>
      </div>

      {/* Pending action banner */}
      {pendingCount > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-5 py-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-yellow-600" />
            <p className="text-sm font-semibold text-yellow-800">Payment Required</p>
          </div>
          <p className="text-sm text-yellow-700 mb-3">{pendingCount} enrollment{pendingCount > 1 ? "s" : ""} awaiting payment.</p>
          <div className="flex flex-wrap gap-2">
            {enrollments.filter(e => e.status === "pending_payment").map(e => (
              <Link key={e.id} to={`/parent/checkout?enrollment_id=${e.id}`}>
                <button className="text-xs bg-[#1a3c5e] text-white px-3 py-1.5 rounded-lg hover:bg-[#0d2540] transition-colors flex items-center gap-1">
                  <CreditCard className="w-3.5 h-3.5" /> Pay for {e.program_name}
                </button>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-1.5 flex-wrap">
          {FILTER_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                statusFilter === tab.key ? "bg-[#1a3c5e] text-white border-[#1a3c5e]" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
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
                studentFilter === "all" ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200"
              }`}
            >
              <Users className="w-3 h-3" /> All Students
            </button>
            {students.map(s => (
              <button
                key={s.id}
                onClick={() => setStudentFilter(s.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  studentFilter === s.id ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200"
                }`}
              >
                {s.full_name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Enrollment cards */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="w-5 h-5 border-4 border-slate-200 border-t-[#1a3c5e] rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-10 text-center">
          <p className="text-slate-400 text-sm">No enrollments found.</p>
          <Link to="/parent/programs" className="text-xs text-[#1a3c5e] hover:underline mt-1 block">Browse Programs →</Link>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(e => {
            const sc = STATUS_CONFIG[e.status] || STATUS_CONFIG.pending_payment;
            const Icon = sc.icon;
            const student = students.find(s => s.id === e.student_id);
            return (
              <div key={e.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-slate-800">{e.program_name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium flex items-center gap-1 ${sc.color}`}>
                        <Icon className="w-3 h-3" /> {sc.label}
                      </span>
                    </div>
                    {student && <p className="text-xs text-slate-500 mb-2">Student: {student.full_name}</p>}
                    <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                      {e.billing_cycle && (
                        <span className="capitalize">💳 {e.billing_cycle} billing</span>
                      )}
                      {e.amount_due && (
                        <span>
                          <DollarSign className="w-3 h-3 inline" />
                          {e.billing_cycle === "annual" ? `$${e.amount_due?.toLocaleString()} / year` : `$${e.amount_due?.toLocaleString()} / month`}
                        </span>
                      )}
                      {e.enrolled_date && <span>Enrolled: {e.enrolled_date}</span>}
                      {e.stripe_subscription_id && (
                        <span className="font-mono text-slate-400 truncate max-w-[160px]">Sub: {e.stripe_subscription_id}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 items-end shrink-0">
                    {["pending_payment", "payment_failed"].includes(e.status) && (
                      <Link to={`/parent/checkout?enrollment_id=${e.id}`}>
                        <Button size="sm" className="bg-[#1a3c5e] hover:bg-[#0d2540]">
                          <CreditCard className="w-3.5 h-3.5 mr-1" /> Complete Payment
                        </Button>
                      </Link>
                    )}
                    {["active", "active_override"].includes(e.status) && parent?.stripe_customer_id && (
                      <Button size="sm" variant="outline" onClick={openStripePortal} disabled={portalLoading}>
                        <ExternalLink className="w-3.5 h-3.5 mr-1" /> Manage
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <PaymentHistory />
    </div>
  );
}