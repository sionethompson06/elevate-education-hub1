export default function TuitionSummary({ billingCycle, program }) {
  // Use the invoice/override amount as the authoritative price
  const amount = parseFloat(program?.tuitionAmount) || 0;

  let label, note;
  if (billingCycle === "annual") {
    label = "Annual Tuition";
    note = amount > 0
      ? `Equivalent to $${Math.round(amount / 12).toLocaleString()}/month`
      : "Billed once per year";
  } else if (billingCycle === "one_time") {
    label = "Enrollment Deposit";
    note = "Non-refundable deposit to reserve your spot";
  } else {
    label = "Monthly Tuition";
    note = "Billed automatically each month";
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Order Summary</p>
      <div className="flex justify-between items-center py-2 border-b border-slate-100">
        <span className="text-sm text-slate-700">{label}</span>
        <span className="font-semibold text-slate-800">${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
      </div>
      <div className="flex justify-between items-center py-2">
        <span className="text-sm font-bold text-slate-800">Total Due Today</span>
        <span className="text-lg font-bold text-[#1a3c5e]">${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
      </div>
      <p className="text-xs text-slate-400 mt-1">{note}</p>
    </div>
  );
}
