import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

const FALLBACK = { monthly: 250, annual: 2400, deposit: 500 };

export default function TuitionSummary({ billingCycle, programName }) {
  const { data: programs = [] } = useQuery({
    queryKey: ["program-pricing", programName],
    queryFn: () => base44.entities.Program.filter({ name: programName }),
    enabled: !!programName,
  });
  const program = programs[0];

  const monthly = program?.price_monthly || FALLBACK.monthly;
  const annual = program?.price_annual || FALLBACK.annual;

  let amount, label, note;
  if (billingCycle === "annual") {
    amount = annual;
    label = "Annual Tuition";
    note = `Equivalent to $${Math.round(annual / 12).toLocaleString()}/month`;
  } else if (billingCycle === "one_time") {
    amount = FALLBACK.deposit;
    label = "Enrollment Deposit";
    note = "Non-refundable deposit to reserve your spot";
  } else {
    amount = monthly;
    label = "Monthly Tuition";
    note = "Billed automatically each month";
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Order Summary</p>
      <div className="flex justify-between items-center py-2 border-b border-slate-100">
        <span className="text-sm text-slate-700">{label}</span>
        <span className="font-semibold text-slate-800">${amount.toLocaleString()}</span>
      </div>
      <div className="flex justify-between items-center py-2">
        <span className="text-sm font-bold text-slate-800">Total Due Today</span>
        <span className="text-lg font-bold text-[#1a3c5e]">${amount.toLocaleString()}</span>
      </div>
      <p className="text-xs text-slate-400 mt-1">{note}</p>
    </div>
  );
}