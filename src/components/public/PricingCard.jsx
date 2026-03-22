import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

export default function PricingCard({ plan, features = [], billingMode = "monthly" }) {
  const price = billingMode === "annual" ? plan.price_annual : plan.price_monthly;
  const perLabel = billingMode === "annual" ? "/year" : "/month";

  return (
    <div className={`relative rounded-2xl p-8 flex flex-col ${
      plan.is_featured
        ? "bg-[#1a3c5e] text-white shadow-2xl scale-105 border-2 border-yellow-400"
        : "bg-white border border-slate-200 shadow-sm"
    }`}>
      {plan.badge_label && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <span className="bg-yellow-400 text-[#1a3c5e] text-xs font-bold px-4 py-1.5 rounded-full">
            {plan.badge_label}
          </span>
        </div>
      )}
      <h3 className={`text-xl font-bold mb-2 ${plan.is_featured ? "text-white" : "text-slate-800"}`}>
        {plan.name}
      </h3>
      <div className="mb-4">
        <span className="text-4xl font-bold">${price?.toLocaleString()}</span>
        <span className={`text-sm ml-1 ${plan.is_featured ? "text-slate-300" : "text-slate-500"}`}>{perLabel}</span>
      </div>
      {plan.billing_note && (
        <p className={`text-xs mb-6 ${plan.is_featured ? "text-slate-300" : "text-slate-500"}`}>
          {plan.billing_note}
        </p>
      )}
      <ul className="space-y-2 flex-1 mb-8">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <Check className={`w-4 h-4 mt-0.5 shrink-0 ${plan.is_featured ? "text-yellow-400" : "text-green-500"}`} />
            <span className={plan.is_featured ? "text-slate-200" : "text-slate-600"}>{f.label}</span>
          </li>
        ))}
      </ul>
      <Link to={plan.cta_href || "/apply"}>
        <Button
          className={`w-full font-semibold ${
            plan.is_featured
              ? "bg-yellow-400 text-[#1a3c5e] hover:bg-yellow-300"
              : "bg-[#1a3c5e] text-white hover:bg-[#0d2540]"
          }`}
        >
          {plan.cta_label || "Enroll Now"}
        </Button>
      </Link>
    </div>
  );
}