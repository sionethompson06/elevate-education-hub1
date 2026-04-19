import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet } from "@/api/apiClient";
import { Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import RewardBalanceCard from "@/components/rewards/RewardBalanceCard";
import TransactionFeed from "@/components/rewards/TransactionFeed";
import RedemptionCatalog from "@/components/rewards/RedemptionCatalog";

const TABS = ["overview", "history", "redeem"];

export default function StudentRewards() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState("overview");

  const { data: student } = useQuery({
    queryKey: ["my-student", user?.id],
    queryFn: () => apiGet(`/students/by-user/${user.id}`).then(r => r.student),
    enabled: !!user?.id,
  });

  const { data: pointsData, isLoading } = useQuery({
    queryKey: ["student-points", student?.id],
    queryFn: () => apiGet(`/rewards/points/${student.id}`),
    enabled: !!student?.id,
  });

  const { data: rawTransactions = [] } = useQuery({
    queryKey: ["student-transactions", student?.id],
    queryFn: () => apiGet(`/rewards/transactions/${student.id}`),
    enabled: !!student?.id,
  });

  const balance = { total_points: pointsData?.points ?? 0 };
  const transactions = rawTransactions.map(t => ({
    ...t,
    points: t.delta,
    awarded_at: t.createdAt,
  }));

  if (isLoading) return (
    <div className="flex justify-center py-16"><div className="w-6 h-6 border-4 border-slate-200 border-t-yellow-500 rounded-full animate-spin" /></div>
  );

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-semibold mb-2">
          <Star className="w-3.5 h-3.5" /> Elevate Rewards — Level Up
        </div>
        <h1 className="text-3xl font-bold text-[#1a3c5e]">My Rewards</h1>
      </div>

      <RewardBalanceCard balance={balance} />

      <div className="flex gap-1 flex-wrap">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${tab === t ? "bg-[#1a3c5e] text-white" : "bg-white border border-slate-200 text-slate-600 hover:border-[#1a3c5e]"}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Recent Transactions</CardTitle></CardHeader>
          <CardContent>
            <TransactionFeed transactions={transactions.slice(0, 5)} />
          </CardContent>
        </Card>
      )}
      {tab === "history" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Transaction History</CardTitle></CardHeader>
          <CardContent><TransactionFeed transactions={transactions} /></CardContent>
        </Card>
      )}
      {tab === "redeem" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Redeem Points</CardTitle></CardHeader>
          <CardContent>
            <RedemptionCatalog
              balance={balance}
              studentId={student?.id}
              onRedeemed={() => qc.invalidateQueries({ queryKey: ["student-points", student?.id] })}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
