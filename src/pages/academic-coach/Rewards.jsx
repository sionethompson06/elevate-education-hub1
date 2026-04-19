import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet } from "@/api/apiClient";
import { Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import RewardBalanceCard from "@/components/rewards/RewardBalanceCard";
import TransactionFeed from "@/components/rewards/TransactionFeed";
import AwardPointsModal from "@/components/rewards/AwardPointsModal";

export default function AcademicCoachRewards() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [awardModal, setAwardModal] = useState(false);

  const { data: queueData } = useQuery({
    queryKey: ["coach-queue", user?.id],
    queryFn: () => apiGet("/gradebook/queue"),
    enabled: !!user,
  });

  const queue = queueData?.queue || [];
  const student = selectedStudent || queue[0];

  const { data: pointsData, isLoading } = useQuery({
    queryKey: ["coach-student-points", student?.student_id],
    queryFn: () => apiGet(`/rewards/points/${student.student_id}`),
    enabled: !!student?.student_id,
  });

  const { data: rawTransactions = [] } = useQuery({
    queryKey: ["coach-student-transactions", student?.student_id],
    queryFn: () => apiGet(`/rewards/transactions/${student.student_id}`),
    enabled: !!student?.student_id,
  });

  const balance = { total_points: pointsData?.points ?? 0 };
  const transactions = rawTransactions.map(t => ({ ...t, points: t.delta, awarded_at: t.createdAt }));

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["coach-student-points", student?.student_id] });
    qc.invalidateQueries({ queryKey: ["coach-student-transactions", student?.student_id] });
    setAwardModal(false);
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
          <Button size="sm" className="bg-yellow-500 hover:bg-yellow-600" onClick={() => setAwardModal(true)}>
            <Star className="w-4 h-4 mr-1" /> Award Points
          </Button>
        )}
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
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

        <div className="lg:col-span-3 space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-8"><div className="w-5 h-5 border-4 border-slate-200 border-t-yellow-500 rounded-full animate-spin" /></div>
          ) : (
            <>
              <RewardBalanceCard balance={balance} />
              <Card>
                <CardHeader><CardTitle className="text-sm text-slate-600">Recent Transactions</CardTitle></CardHeader>
                <CardContent><TransactionFeed transactions={transactions.slice(0, 10)} /></CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      {awardModal && student && (
        <AwardPointsModal student={student} track="academic" onClose={() => setAwardModal(false)} onSuccess={refresh} />
      )}
    </div>
  );
}
