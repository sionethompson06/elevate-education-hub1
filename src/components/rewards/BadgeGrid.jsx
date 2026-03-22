export default function BadgeGrid({ badges }) {
  if (!badges?.length) return <p className="text-sm text-slate-400">No badges earned yet.</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {badges.map(b => (
        <div key={b.id} className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-xl px-3 py-2">
          <span className="text-xl">{b.badge_icon || "🏅"}</span>
          <div>
            <p className="text-xs font-semibold text-slate-800">{b.badge_name}</p>
            {b.reason && <p className="text-xs text-slate-400">{b.reason}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}