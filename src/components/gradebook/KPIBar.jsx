import { AlertTriangle } from "lucide-react";

const Tile = ({ label, value, color = "text-slate-800", bg = "bg-white" }) => (
  <div className={`${bg} rounded-xl border border-slate-100 px-4 py-3 text-center`}>
    <p className={`text-2xl font-bold ${color}`}>{value ?? "—"}</p>
    <p className="text-xs text-slate-500 mt-0.5 leading-tight">{label}</p>
  </div>
);

export default function KPIBar({ kpis, showIntervention = true }) {
  if (!kpis) return null;

  return (
    <div className="space-y-3">
      {showIntervention && kpis.intervention && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm font-medium">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Intervention flag: completion rate is low or overdue count is high. Review recommended.
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <Tile label="Due Today" value={kpis.due_today_count} color={kpis.due_today_count > 0 ? "text-yellow-600" : "text-slate-800"} />
        <Tile label="Overdue" value={kpis.overdue_count} color={kpis.overdue_count > 0 ? "text-red-600" : "text-slate-800"} />
        <Tile label="Upcoming 7d" value={kpis.upcoming_7d_count} />
        <Tile label="Completed" value={kpis.completed_count} color="text-green-600" />
        <Tile label="Incomplete" value={kpis.incomplete_count} />
        <Tile
          label="Completion Rate"
          value={kpis.overall_completion_rate != null ? `${Math.round(kpis.overall_completion_rate * 100)}%` : "—"}
          color={
            kpis.overall_completion_rate == null ? "text-slate-400"
            : kpis.overall_completion_rate >= 0.70 ? "text-green-600"
            : "text-red-600"
          }
        />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Tile label="Due This Week" value={kpis.due_this_week_count} />
        <Tile label="Completed This Week" value={kpis.completed_this_week_count} color="text-green-600" />
        <Tile label="On-Time This Week" value={kpis.on_time_due_this_week_count} />
        <Tile
          label="Weekly Completion"
          value={kpis.weekly_completion_rate != null ? `${Math.round(kpis.weekly_completion_rate * 100)}%` : "—"}
          color={
            kpis.weekly_completion_rate == null ? "text-slate-400"
            : kpis.weekly_completion_rate >= 0.70 ? "text-green-600"
            : "text-red-600"
          }
        />
      </div>
    </div>
  );
}