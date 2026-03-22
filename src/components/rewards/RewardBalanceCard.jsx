import { Star, BookOpen, Activity } from "lucide-react";

export default function RewardBalanceCard({ balance }) {
  if (!balance) return (
    <div className="grid grid-cols-3 gap-3">
      {["Academic", "Performance", "Total"].map(t => (
        <div key={t} className="bg-white rounded-xl border border-slate-100 p-4 text-center">
          <p className="text-2xl font-bold text-slate-300">0</p>
          <p className="text-xs text-slate-400 mt-1">{t} pts</p>
        </div>
      ))}
    </div>
  );

  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="bg-blue-50 rounded-xl border border-blue-100 p-4 text-center">
        <div className="flex justify-center mb-1"><BookOpen className="w-4 h-4 text-blue-500" /></div>
        <p className="text-2xl font-bold text-blue-700">{balance.academic_points ?? 0}</p>
        <p className="text-xs text-blue-500 mt-0.5">Academic pts</p>
      </div>
      <div className="bg-orange-50 rounded-xl border border-orange-100 p-4 text-center">
        <div className="flex justify-center mb-1"><Activity className="w-4 h-4 text-orange-500" /></div>
        <p className="text-2xl font-bold text-orange-600">{balance.performance_points ?? 0}</p>
        <p className="text-xs text-orange-500 mt-0.5">Performance pts</p>
      </div>
      <div className="bg-yellow-50 rounded-xl border border-yellow-100 p-4 text-center">
        <div className="flex justify-center mb-1"><Star className="w-4 h-4 text-yellow-500" /></div>
        <p className="text-2xl font-bold text-yellow-600">{balance.total_points ?? 0}</p>
        <p className="text-xs text-yellow-500 mt-0.5">Total pts</p>
      </div>
    </div>
  );
}