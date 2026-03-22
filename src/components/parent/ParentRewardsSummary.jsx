import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import RewardBalanceCard from "@/components/rewards/RewardBalanceCard";
import TransactionFeed from "@/components/rewards/TransactionFeed";

export default function ParentRewardsSummary({ studentId, studentName }) {
  const { data, isLoading } = useQuery({
    queryKey: ["parent-rewards", studentId],
    queryFn: () => base44.functions.invoke("rewards", {
      action: "get_student_rewards",
      student_id: studentId,
    }).then(r => r.data),
    enabled: !!studentId,
  });

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
              <RewardBalanceCard balance={data?.balance} />
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Recent Activity</p>
                <TransactionFeed transactions={data?.transactions?.slice(0, 5)} />
              </div>
            </>
          )}
      </CardContent>
    </Card>
  );
}