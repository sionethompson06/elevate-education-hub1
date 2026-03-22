import { X, CreditCard, ShieldCheck } from "lucide-react";
import EnrollmentOverridePanel from "./EnrollmentOverridePanel";

const Row = ({ label, value }) => (
  <div className="flex justify-between py-2 border-b border-slate-100 last:border-0 gap-4">
    <span className="text-sm text-slate-500 shrink-0">{label}</span>
    <span className="text-sm font-medium text-slate-800 text-right">{value || "—"}</span>
  </div>
);

export default function EnrollmentDetailPanel({ enrollment, statusColors, onClose, onUpdated }) {
  const sc = statusColors[enrollment.status] || "bg-slate-100 text-slate-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="font-bold text-[#1a3c5e] text-lg">{enrollment.program_name}</h2>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold capitalize mt-1 ${sc}`}>
              {enrollment.status?.replace(/_/g, " ")}
            </span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">
          {/* Enrollment details */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1">
              <CreditCard className="w-3.5 h-3.5" /> Payment Details
            </p>
            <div className="bg-slate-50 rounded-xl p-4">
              <Row label="Status" value={enrollment.status?.replace(/_/g, " ")} />
              <Row label="Payment Status" value={enrollment.payment_status} />
              <Row label="Payment Method" value={enrollment.payment_method?.replace(/_/g, " ")} />
              <Row label="Billing Cycle" value={enrollment.billing_cycle?.replace(/_/g, " ")} />
              <Row label="Amount Due" value={enrollment.amount_due != null ? `$${enrollment.amount_due.toLocaleString()}` : null} />
              <Row label="Stripe Subscription" value={enrollment.stripe_subscription_id} />
              <Row label="Stripe Customer" value={enrollment.stripe_customer_id} />
              <Row label="Enrolled Date" value={enrollment.enrolled_date} />
              <Row label="Override ID" value={enrollment.override_id} />
            </div>
          </div>

          {/* Override panel */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Override Management
            </p>
            <EnrollmentOverridePanel enrollment={enrollment} />
          </div>
        </div>
      </div>
    </div>
  );
}