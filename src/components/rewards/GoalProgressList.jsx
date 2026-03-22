import { CheckCircle, Target } from "lucide-react";

export default function GoalProgressList({ goals }) {
  if (!goals?.length) return <p className="text-sm text-slate-400">No goals set yet.</p>;

  return (
    <div className="space-y-3">
      {goals.map(g => {
        const pct = Math.min(100, Math.round(((g.current_points || 0) / g.target_points) * 100));
        return (
          <div key={g.id} className={`rounded-xl border p-4 ${g.status === 'completed' ? 'border-green-200 bg-green-50' : 'border-slate-200 bg-white'}`}>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                {g.status === 'completed'
                  ? <CheckCircle className="w-4 h-4 text-green-600" />
                  : <Target className="w-4 h-4 text-blue-500" />}
                <span className="font-medium text-sm text-slate-800">{g.title}</span>
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${g.status === 'completed' ? 'bg-green-100 text-green-700' : g.track === 'academic' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                {g.status === 'completed' ? 'Completed' : g.track}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-slate-200 rounded-full h-2">
                <div className={`h-2 rounded-full transition-all ${g.status === 'completed' ? 'bg-green-500' : g.track === 'academic' ? 'bg-blue-500' : 'bg-orange-500'}`} style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs text-slate-500 shrink-0">{g.current_points || 0}/{g.target_points} pts</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}