import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/api/apiClient";
import { Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import RewardBalanceCard from "@/components/rewards/RewardBalanceCard";
import TransactionFeed from "@/components/rewards/TransactionFeed";

export default function ParentRewardsSummary({ studentId, studentName }) {
  const { data: pointsData, isLoading } = useQuery({
    queryKey: ["parent-rewards-points", studentId],
    queryFn: () => apiGet(`/rewards/points/${studentId}`),
    enabled: !!studentId,
  });

  const { data: txRaw } = useQuery({
    queryKey: ["parent-rewards-transactions", studentId],
    queryFn: () => apiGet(`/rewards/transactions/${studentId}`),
    enabled: !!studentId,
  });

  const totalPoints = pointsData?.points ?? 0;
  const balance = { total_points: totalPoints };

  // Adapt real transaction fields to what TransactionFeed expects
  const transactions = (Array.isArray(txRaw) ? txRaw : []).slice(0, 5).map(tx => ({
    ...tx,
    points: tx.delta,
    awarded_at: tx.createdAt,
    track: null,
  }));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Star className="w-4 h-4 text-yellow-500" /> {studentName} Rewards
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading
          ? <div className="flex justify-center py-4"><div className="w-4 h-4 border-4 border-slate-200 border-t-yellow-500 rounded-full animate-spin" /></div>
          : (
            <>
              <RewardBalanceCard balance={balance} />
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Recent Activity</p>
                <TransactionFeed transactions={transactions} />
              </div>
            </>
          )}
      </CardContent>
    </Card>
  );
}
