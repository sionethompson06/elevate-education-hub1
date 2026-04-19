import { Check } from "lucide-react";

const FALLBACK_PRICING = { monthly: 250, annual: 2400 };

export default function BillingCycleSelector({ value, onChange, program }) {
  const monthly = program?.price_monthly || program?.tuitionAmount || FALLBACK_PRICING.monthly;
  const annual = program?.price_annual || FALLBACK_PRICING.annual;
  const annualMonthly = Math.round(annual / 12);
  const savings = Math.round(((monthly * 12 - annual) / (monthly * 12)) * 100);

  const options = [
    {
      id: "monthly",
      label: "Monthly",
      price: `$${Number(monthly).toLocaleString()}/mo`,
      sub: "Billed each month",
      badge: null,
    },
    {
      id: "annual",
      label: "Annual",
      price: `$${annualMonthly.toLocaleString()}/mo`,
      sub: `$${Number(annual).toLocaleString()} billed once per year`,
      badge: savings > 0 ? `Save ${savings}%` : null,
    },
    {
      id: "one_time",
      label: "One-Time Deposit",
      price: "$500",
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
