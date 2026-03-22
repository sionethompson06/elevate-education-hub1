import { format } from "date-fns";
import { ChevronRight } from "lucide-react";

export default function ApplicationRow({ application: app, statusColors, onSelect }) {
  const sc = statusColors[app.status] || "bg-slate-100 text-slate-500";
  return (
    <button
      onClick={onSelect}
      className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 text-left gap-4 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3">
          <p className="font-semibold text-slate-800">
            {app.student_first_name} {app.student_last_name}
          </p>
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${sc}`}>
            {app.status?.replace("_", " ")}
          </span>
        </div>
        <p className="text-sm text-slate-500 mt-0.5">
          Parent: {app.parent_first_name} {app.parent_last_name} · {app.email}
        </p>
        <p className="text-xs text-slate-400 mt-0.5">
          {app.program_interest} · Grade {app.student_grade}
          {app.submitted_at ? ` · Submitted ${format(new Date(app.submitted_at), "MMM d, yyyy")}` : ""}
        </p>
      </div>
      <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
    </button>
  );
}