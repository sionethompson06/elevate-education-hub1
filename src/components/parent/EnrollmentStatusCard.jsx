import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CheckCircle, Clock, AlertCircle, XCircle, CreditCard } from "lucide-react";

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
    icon: Clock,
    bg: "border-slate-200 bg-slate-50",
    iconColor: "text-slate-400",
    badge: "bg-slate-100 text-slate-500",
    label: "Paused",
    showPay: false,
  },
};

export default function EnrollmentStatusCard({ enrollment }) {
  const sc = STATUS_CONFIG[enrollment.status] || STATUS_CONFIG.pending_payment;
  const Icon = sc.icon;

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
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Enrolled {enrollment.enrolled_date}
              {enrollment.billing_cycle ? ` · ${enrollment.billing_cycle.replace("_", " ")}` : ""}
              {enrollment.payment_status ? ` · Payment: ${enrollment.payment_status}` : ""}
            </p>
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