import { Button } from "@/components/ui/button";
import { BookOpen, Activity, Globe, Check } from "lucide-react";

const PROGRAMS = [
  {
    value: "Microschool (In-Person Hybrid)",
    icon: BookOpen,
    title: "Microschool",
    subtitle: "In-Person Hybrid",
    description: "Personalized academic instruction in a small-group, hybrid setting.",
    color: "border-blue-200 bg-blue-50",
    activeColor: "border-[#1a3c5e] bg-[#1a3c5e]/5",
    iconColor: "text-blue-600",
  },
  {
    value: "Athletic Performance Training",
    icon: Activity,
    title: "Athletic Performance",
    subtitle: "Training Program",
    description: "Elite sport-specific conditioning and performance coaching.",
    color: "border-green-200 bg-green-50",
    activeColor: "border-[#1a3c5e] bg-[#1a3c5e]/5",
    iconColor: "text-green-600",
  },
  {
    value: "Virtual School 1-Day",
    icon: Globe,
    title: "Virtual School",
    subtitle: "1 Day / Week",
    description: "Flexible, accredited online curriculum — one structured day of virtual instruction per week.",
    color: "border-purple-200 bg-purple-50",
    activeColor: "border-[#1a3c5e] bg-[#1a3c5e]/5",
    iconColor: "text-purple-600",
  },
  {
    value: "Virtual School 2-Days",
    icon: Globe,
    title: "Virtual School",
    subtitle: "2 Days / Week",
    description: "Flexible, accredited online curriculum — two structured days of virtual instruction per week.",
    color: "border-indigo-200 bg-indigo-50",
    activeColor: "border-[#1a3c5e] bg-[#1a3c5e]/5",
    iconColor: "text-indigo-600",
  },
];

export default function StepProgram({ form, update, onNext, onBack }) {
  const valid = !!form.program_interest;

  const handleNext = (e) => {
    e.preventDefault();
    if (valid) onNext();
  };

  return (
    <form onSubmit={handleNext} className="space-y-5">
      <h2 className="text-xl font-bold text-slate-800 mb-1">Program Interest</h2>
      <p className="text-sm text-slate-500 mb-4">Select the program you'd like to apply for.</p>

      <div className="space-y-3">
        {PROGRAMS.map(({ value, icon: Icon, title, subtitle, description, color, activeColor, iconColor }) => {
          const selected = form.program_interest === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => update({ program_interest: value })}
              className={`w-full text-left rounded-xl border-2 p-4 transition-all flex items-start gap-4 ${
                selected ? activeColor + " border-[#1a3c5e]" : "border-slate-200 hover:border-slate-300 bg-white"
              }`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${selected ? "bg-[#1a3c5e]" : color}`}>
                <Icon className={`w-5 h-5 ${selected ? "text-white" : iconColor}`} />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-slate-800">{title}</div>
                <div className="text-xs text-slate-500 font-medium">{subtitle}</div>
                <div className="text-sm text-slate-500 mt-1">{description}</div>
              </div>
              {selected && <Check className="w-5 h-5 text-[#1a3c5e] shrink-0 mt-1" />}
            </button>
          );
        })}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Additional Notes <span className="text-slate-400">(optional)</span></label>
        <textarea
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30 min-h-[80px]"
          value={form.notes}
          onChange={(e) => update({ notes: e.target.value })}
          placeholder="Anything else you'd like us to know…"
        />
      </div>

      <div className="flex justify-between pt-2">
        <Button type="button" variant="outline" onClick={onBack}>← Back</Button>
        <Button type="submit" disabled={!valid} className="bg-[#1a3c5e] hover:bg-[#0d2540]">
          Review Application →
        </Button>
      </div>
    </form>
  );
}