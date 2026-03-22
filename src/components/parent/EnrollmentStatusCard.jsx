import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CheckCircle, Clock, AlertCircle, XCircle, CreditCard, ShieldCheck, PauseCircle } from "lucide-react";

const STATUS_CONFIG = {
  pending_payment: {
    icon: Clock,
    bg: "border-yellow-200 bg-yellow-50",
    iconColor: "text-yellow-600",
    badge: "bg-yellow-100 text-yellow-700",
    label: "Pending Payment",
    showPay: true,
  },
  active: {
    icon: CheckCircle,
    bg: "border-green-200 bg-green-50",
    iconColor: "text-green-600",
    badge: "bg-green-100 text-green-700",
    label: "Active",
    showPay: false,
  },
  active_override: {
    icon: ShieldCheck,
    bg: "border-purple-200 bg-purple-50",
    iconColor: "text-purple-600",
    badge: "bg-purple-100 text-purple-700",
    label: "Admin Approved Enrollment",
    showPay: false,
  },
  payment_failed: {
    icon: AlertCircle,
    bg: "border-red-200 bg-red-50",
    iconColor: "text-red-500",
    badge: "bg-red-100 text-red-700",
    label: "Payment Failed",
    showPay: true,
  },
  cancelled: {
    icon: XCircle,
    bg: "border-slate-200 bg-slate-50",
    iconColor: "text-slate-400",
    badge: "bg-slate-100 text-slate-500",
    label: "Cancelled",
    showPay: false,
  },
  paused: {
    icon: PauseCircle,
    bg: "border-slate-200 bg-slate-50",
    iconColor: "text-slate-400",
    badge: "bg-slate-100 text-slate-500",
    label: "Paused",
    showPay: false,
  },
};

const PAYMENT_STATUS_LABELS = {
  waived: "Scholarship Applied",
  deferred: "Deferred Balance",
  partial: "Partial Balance Due",
  paid: null,
  unpaid: null,
};

export default function EnrollmentStatusCard({ enrollment }) {
  const sc = STATUS_CONFIG[enrollment.status] || STATUS_CONFIG.pending_payment;
  const Icon = sc.icon;
  const paymentLabel = PAYMENT_STATUS_LABELS[enrollment.payment_status];

  return (
    <div className={`rounded-2xl border-2 p-5 ${sc.bg}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5">
            <Icon className={`w-5 h-5 ${sc.iconColor}`} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-slate-800">{enrollment.program_name}</p>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${sc.badge}`}>
                {sc.label}
              </span>
              {paymentLabel && (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                  {paymentLabel}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Enrolled {enrollment.enrolled_date}
              {enrollment.billing_cycle ? ` · ${enrollment.billing_cycle.replace(/_/g, " ")}` : ""}
            </p>
            {/* Show remaining due for partial/deferred */}
            {["partial", "deferred"].includes(enrollment.payment_status) && enrollment.amount_due > 0 && (
              <p className="text-sm font-semibold text-slate-700 mt-1">
                Remaining balance: <span className="text-[#1a3c5e]">${enrollment.amount_due.toLocaleString()}</span>
              </p>
            )}
          </div>
        </div>

        {sc.showPay && (
          <Link to={`/parent/checkout?enrollment_id=${enrollment.id}`} className="shrink-0">
            <Button size="sm" className="bg-[#1a3c5e] hover:bg-[#0d2540]">
              <CreditCard className="w-4 h-4 mr-2" />
              {enrollment.status === "payment_failed" ? "Retry Payment" : "Complete Payment"}
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}