import { Check } from "lucide-react";

export default function StepIndicator({ steps, current }) {
  return (
    <div className="flex items-center justify-center gap-0">
      {steps.map((label, i) => (
        <div key={i} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${
                i < current
                  ? "bg-[#1a3c5e] border-[#1a3c5e] text-white"
                  : i === current
                  ? "border-[#1a3c5e] text-[#1a3c5e] bg-white"
                  : "border-slate-200 text-slate-400 bg-white"
              }`}
            >
              {i < current ? <Check className="w-4 h-4" /> : i + 1}
            </div>
            <span className={`text-xs mt-1 font-medium ${i === current ? "text-[#1a3c5e]" : "text-slate-400"}`}>
              {label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`h-0.5 w-12 mx-1 mb-4 ${i < current ? "bg-[#1a3c5e]" : "bg-slate-200"}`} />
          )}
        </div>
      ))}
    </div>
  );
}