import { Link } from "react-router-dom";
import { BookOpen, Activity, Globe, Trophy, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";

const ICONS = { BookOpen, Activity, Globe, Trophy, GraduationCap };
const CATEGORY_COLORS = {
  academic: "bg-blue-50 text-blue-600",
  athletic: "bg-green-50 text-green-600",
  virtual_homeschool: "bg-purple-50 text-purple-600",
  college_nil: "bg-yellow-50 text-yellow-600",
  combined: "bg-red-50 text-red-600",
};

export default function ProgramCard({ program }) {
  const Icon = ICONS[program.icon] || GraduationCap;
  const colorClass = CATEGORY_COLORS[program.category] || "bg-slate-50 text-slate-600";

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 hover:shadow-md hover:border-[#1a3c5e] transition-all flex flex-col h-full">
      <div className={`w-12 h-12 rounded-xl ${colorClass} flex items-center justify-center mb-4`}>
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="font-bold text-slate-800 text-lg mb-2">{program.name}</h3>
      {program.tagline && (
        <p className="text-sm text-[#1a3c5e] font-medium mb-2">{program.tagline}</p>
      )}
      <p className="text-sm text-slate-500 flex-1 mb-4">{program.description}</p>
      {program.features?.length > 0 && (
        <ul className="space-y-1 mb-4">
          {program.features.slice(0, 3).map((f, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
              <span className="text-green-500 mt-0.5">✓</span>
              {f}
            </li>
          ))}
        </ul>
      )}
      {program.cta_href && (
        <Link to={program.cta_href}>
          <Button size="sm" className="w-full bg-[#1a3c5e] hover:bg-[#0d2540]">
            {program.cta_label || "Learn More"}
          </Button>
        </Link>
      )}
    </div>
  );
}