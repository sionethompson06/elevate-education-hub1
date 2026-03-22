import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import RewardBalanceCard from "@/components/rewards/RewardBalanceCard";
import BadgeGrid from "@/components/rewards/BadgeGrid";
import GoalProgressList from "@/components/rewards/GoalProgressList";
import TransactionFeed from "@/components/rewards/TransactionFeed";
import RedemptionCatalog from "@/components/rewards/RedemptionCatalog";

const TABS = ["overview", "goals", "history", "redeem"];

export default function StudentRewards() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState("overview");

  const { data, isLoading } = useQuery({
    queryKey: ["student-rewards", user?.id],
    queryFn: async () => {
      // First get student record
      const students = await base44.entities.Student.filter({ user_id: user.id });
      const sid = students[0]?.id;
      if (!sid) return null;
      const res = await base44.functions.invoke("rewards", { action: "get_student_rewards", student_id: sid });
      return { ...res.data, student_id: sid };
    },
    enabled: !!user,
  });

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

      <RewardBalanceCard balance={data?.balance} />

      <div className="flex gap-1 flex-wrap">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${tab === t ? "bg-[#1a3c5e] text-white" : "bg-white border border-slate-200 text-slate-600 hover:border-[#1a3c5e]"}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">My Badges</CardTitle></CardHeader>
            <CardContent><BadgeGrid badges={data?.badges} /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Active Goals</CardTitle></CardHeader>
            <CardContent><GoalProgressList goals={data?.goals?.filter(g => g.status === 'active')} /></CardContent>
          </Card>
        </div>
      )}
      {tab === "goals" && (
        <Card>
          <CardHeader><CardTitle className="text-base">All Goals</CardTitle></CardHeader>
          <CardContent><GoalProgressList goals={data?.goals} /></CardContent>
        </Card>
      )}
      {tab === "history" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Transaction History</CardTitle></CardHeader>
          <CardContent><TransactionFeed transactions={data?.transactions} /></CardContent>
        </Card>
      )}
      {tab === "redeem" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Redeem Points</CardTitle></CardHeader>
          <CardContent>
            <RedemptionCatalog
              balance={data?.balance}
              studentId={data?.student_id}
              onRedeemed={() => qc.invalidateQueries({ queryKey: ["student-rewards"] })}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}