import { Check } from "lucide-react";

export default function BillingCycleSelector({ value, onChange, program }) {
  // Use the admin-edited invoice amount (or program default) as the base price
  const baseAmount = parseFloat(program?.tuitionAmount) || 0;
  const effectiveCycle = program?.billingCycle || "monthly";

  const options = [
    {
      id: "monthly",
      label: "Monthly",
      price: baseAmount > 0 ? `$${baseAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}/mo` : "—",
      sub: "Billed each month",
      badge: null,
    },
    {
      id: "annual",
      label: "Annual",
      price: baseAmount > 0 ? `$${(baseAmount * 12).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}/yr` : "—",
      sub: `$${baseAmount > 0 ? baseAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : "—"}/mo equivalent`,
      badge: null,
    },
    {
      id: "one_time",
      label: "One-Time Deposit",
      price: baseAmount > 0 ? `$${baseAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : "—",
      sub: "Enrollment deposit only",
      badge: null,
    },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Payment Plan</p>
      <div className="space-y-3">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`w-full text-left rounded-xl border-2 px-4 py-3 flex items-center justify-between transition-all ${
              value === opt.id
                ? "border-[#1a3c5e] bg-[#1a3c5e]/5"
                : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-800">{opt.label}</span>
                {opt.badge && (
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                    {opt.badge}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{opt.sub}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-bold text-slate-800">{opt.price}</span>
              {value === opt.id && <Check className="w-5 h-5 text-[#1a3c5e]" />}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
