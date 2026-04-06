import { X, CreditCard, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import EnrollmentOverridePanel from "./EnrollmentOverridePanel";

const Row = ({ label, value }) => (
  <div className="flex justify-between py-2 border-b border-slate-100 last:border-0 gap-4">
    <span className="text-sm text-slate-500 shrink-0">{label}</span>
    <span className="text-sm font-medium text-slate-800 text-right">{value || "—"}</span>
  </div>
);

export default function EnrollmentDetailPanel({ enrollment, statusColors, onClose, onUpdated }) {
  const sc = statusColors[enrollment.status] || "bg-slate-100 text-slate-500";
  const studentName = enrollment.studentFirstName
    ? `${enrollment.studentFirstName} ${enrollment.studentLastName || ""}`.trim()
    : `Student #${enrollment.studentId}`;
  const parentName = enrollment.parentFirstName
    ? `${enrollment.parentFirstName} ${enrollment.parentLastName || ""}`.trim()
    : enrollment.parentEmail || null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="font-bold text-[#1a3c5e] text-lg">
              {enrollment.programName || `Program #${enrollment.programId}`}
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">{studentName}</p>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold capitalize mt-1 ${sc}`}>
              {enrollment.status?.replace(/_/g, " ")}
            </span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">
          {/* Enrollment & payment details */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1">
              <CreditCard className="w-3.5 h-3.5" /> Enrollment & Payment Details
            </p>
            <div className="bg-slate-50 rounded-xl p-4">
              <Row label="Student" value={studentName} />
              <Row label="Parent / Guardian" value={parentName} />
              <Row label="Parent Email" value={enrollment.parentEmail} />
              <Row label="Program" value={enrollment.programName} />
              <Row label="Enrollment Status" value={enrollment.status?.replace(/_/g, " ")} />
              <Row label="Invoice Status" value={enrollment.invoiceStatus?.replace(/_/g, " ")} />
              <Row label="Invoice Description" value={enrollment.invoiceDescription} />
              <Row
                label="Amount Due"
                value={enrollment.invoiceAmount != null ? `$${parseFloat(enrollment.invoiceAmount).toLocaleString()}` : null}
              />
              <Row label="Due Date" value={enrollment.invoiceDueDate} />
              <Row label="Paid Date" value={enrollment.invoicePaidDate} />
              <Row label="Billing Cycle" value={enrollment.programBillingCycle?.replace(/_/g, " ")} />
              <Row
                label="Enrolled Date"
                value={enrollment.createdAt ? format(new Date(enrollment.createdAt), "MMM d, yyyy") : null}
              />
              <Row label="Enrollment ID" value={`#${enrollment.id}`} />
            </div>
          </div>

          {/* Override panel */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Override Management
            </p>
            <EnrollmentOverridePanel enrollment={enrollment} onUpdated={onUpdated} />
          </div>
        </div>
      </div>
    </div>
  );
}
