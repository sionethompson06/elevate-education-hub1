import { format } from "date-fns";

const SOURCE_LABEL = {
  lesson_complete: "Lesson completed",
  goal_complete: "Goal completed",
  badge_award: "Badge awarded",
  manual_award: "Manual award",
  redemption: "Redemption",
  admin_adjustment: "Admin adjustment",
};

export default function TransactionFeed({ transactions }) {
  if (!transactions?.length) return <p className="text-sm text-slate-400">No transactions yet.</p>;

  return (
    <div className="space-y-2">
      {transactions.map(tx => (
        <div key={tx.id} className="flex items-center justify-between gap-3 py-2 border-b border-slate-100 last:border-0">
          <div>
            <p className="text-sm text-slate-800">{tx.reason || SOURCE_LABEL[tx.source_type] || tx.source_type}</p>
            <p className="text-xs text-slate-400">
              {tx.track} · {tx.awarded_at ? format(new Date(tx.awarded_at), "MMM d, h:mm a") : ""}
            </p>
          </div>
          <span className={`text-sm font-bold shrink-0 ${tx.points > 0 ? "text-green-600" : "text-red-500"}`}>
            {tx.points > 0 ? "+" : ""}{tx.points} pts
          </span>
        </div>
      ))}
    </div>
  );
}