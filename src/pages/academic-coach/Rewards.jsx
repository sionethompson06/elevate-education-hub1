import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Star, Plus, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import RewardBalanceCard from "@/components/rewards/RewardBalanceCard";
import GoalProgressList from "@/components/rewards/GoalProgressList";
import TransactionFeed from "@/components/rewards/TransactionFeed";
import AwardPointsModal from "@/components/rewards/AwardPointsModal";
import CreateGoalModal from "@/components/rewards/CreateGoalModal";

export default function AcademicCoachRewards() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [awardModal, setAwardModal] = useState(false);
  const [goalModal, setGoalModal] = useState(false);

  const { data: queueData } = useQuery({
    queryKey: ["coach-queue", user?.id],
    queryFn: () => base44.functions.invoke("gradebook", { action: "get_coach_queue" }).then(r => r.data),
    enabled: !!user,
  });

  const queue = queueData?.queue || [];
  const student = selectedStudent || queue[0];

  const { data: rewardsData, isLoading } = useQuery({
    queryKey: ["coach-student-rewards", student?.student_id],
    queryFn: () => base44.functions.invoke("rewards", {
      action: "get_student_rewards",
      student_id: student.student_id,
    }).then(r => r.data),
    enabled: !!student?.student_id,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["coach-student-rewards"] });
    setAwardModal(false);
    setGoalModal(false);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-semibold mb-2">
            <Star className="w-3.5 h-3.5" /> Academic Rewards
          </div>
          <h1 className="text-3xl font-bold text-[#1a3c5e]">Reward Manager</h1>
        </div>
        {student && (
          <div className="flex gap-2">
            <Button size="sm" className="bg-yellow-500 hover:bg-yellow-600" onClick={() => setAwardModal(true)}>
              <Star className="w-4 h-4 mr-1" /> Award Points
            </Button>
            <Button size="sm" variant="outline" onClick={() => setGoalModal(true)}>
              <Target className="w-4 h-4 mr-1" /> Create Goal
            </Button>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Student selector */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-600">Students</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {queue.map(s => (
                <button key={s.student_id} onClick={() => setSelectedStudent(s)}
                  className={`w-full text-left px-4 py-3 text-sm transition-colors ${student?.student_id === s.student_id ? "bg-[#1a3c5e] text-white" : "hover:bg-slate-50 text-slate-700"}`}>
                  {s.student_name}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Rewards detail */}
        <div className="lg:col-span-3 space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-8"><div className="w-5 h-5 border-4 border-slate-200 border-t-yellow-500 rounded-full animate-spin" /></div>
          ) : (
            <>
              <RewardBalanceCard balance={rewardsData?.balance} />
              <div className="grid md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader><CardTitle className="text-sm text-slate-600">Goals</CardTitle></CardHeader>
                  <CardContent><GoalProgressList goals={rewardsData?.goals} /></CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-sm text-slate-600">Recent Transactions</CardTitle></CardHeader>
                  <CardContent><TransactionFeed transactions={rewardsData?.transactions?.slice(0, 10)} /></CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </div>

      {awardModal && student && (
        <AwardPointsModal student={student} track="academic" onClose={() => setAwardModal(false)} onSuccess={refresh} />
      )}
      {goalModal && student && (
        <CreateGoalModal student={student} track="academic" onClose={() => setGoalModal(false)} onSuccess={refresh} />
      )}
    </div>
  );
}