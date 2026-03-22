import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Star, Gift, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import TransactionFeed from "@/components/rewards/TransactionFeed";

const TABS = ["redemptions", "catalog", "transactions"];

export default function AdminRewards() {
  const [tab, setTab] = useState("redemptions");
  const [reviewing, setReviewing] = useState(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [saving, setSaving] = useState(null);
  const qc = useQueryClient();

  const { data: pendingData, isLoading: pendingLoading } = useQuery({
    queryKey: ["pending-redemptions"],
    queryFn: () => base44.functions.invoke("rewards", { action: "get_pending_redemptions" }).then(r => r.data),
    enabled: tab === "redemptions",
  });

  const { data: catalogData } = useQuery({
    queryKey: ["reward-catalog"],
    queryFn: () => base44.functions.invoke("rewards", { action: "get_catalog" }).then(r => r.data),
    enabled: tab === "catalog",
  });

  const { data: recentTxData } = useQuery({
    queryKey: ["admin-recent-tx"],
    queryFn: () => base44.entities.RewardTransaction.list("-awarded_at", 50),
    enabled: tab === "transactions",
  });

  const decide = async (redemption_id, decision) => {
    setSaving(redemption_id);
    await base44.functions.invoke("rewards", { action: "review_redemption", redemption_id, decision, notes: reviewNotes });
    setSaving(null);
    setReviewing(null);
    setReviewNotes("");
    qc.invalidateQueries({ queryKey: ["pending-redemptions"] });
  };

  const redemptions = pendingData?.redemptions || [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="mb-2">
        <div className="inline-block px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold mb-2">Admin</div>
        <h1 className="text-3xl font-bold text-[#1a3c5e] flex items-center gap-3">
          <Star className="w-7 h-7 text-yellow-500" /> Rewards Governance
        </h1>
        <p className="text-slate-500 mt-1">Manage redemption queue, catalog, and transaction history.</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${tab === t ? "bg-[#1a3c5e] text-white" : "bg-white border border-slate-200 text-slate-600 hover:border-[#1a3c5e]"}`}>
            {t.replace("_", " ")}
            {t === "redemptions" && redemptions.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 bg-red-500 text-white rounded-full text-xs">{redemptions.length}</span>
            )}
          </button>
        ))}
      </div>

      {tab === "redemptions" && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Gift className="w-4 h-4" /> Pending Redemptions</CardTitle></CardHeader>
          <CardContent>
            {pendingLoading ? <div className="flex justify-center py-6"><div className="w-5 h-5 border-4 border-slate-200 border-t-[#1a3c5e] rounded-full animate-spin" /></div>
              : redemptions.length === 0 ? <p className="text-sm text-slate-400 text-center py-6">No pending redemptions.</p>
              : (
                <div className="space-y-3">
                  {redemptions.map(r => (
                    <div key={r.id} className="border border-slate-200 rounded-xl p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-800">{r.catalog_item_name}</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Student: {r.student_id} · {r.points_spent} pts · {r.requested_at ? format(new Date(r.requested_at), "MMM d, h:mm a") : ""}
                          </p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Button size="sm" className="bg-green-700 hover:bg-green-800 h-8"
                            disabled={saving === r.id}
                            onClick={() => reviewing === r.id ? decide(r.id, 'approved') : setReviewing(r.id)}>
                            {saving === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5 mr-1" />}
                            {reviewing === r.id ? "Confirm Approve" : "Approve"}
                          </Button>
                          <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 h-8"
                            disabled={saving === r.id}
                            onClick={() => decide(r.id, 'denied')}>
                            <XCircle className="w-3.5 h-3.5 mr-1" /> Deny
                          </Button>
                        </div>
                      </div>
                      {reviewing === r.id && (
                        <div className="mt-3">
                          <textarea
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none min-h-[50px]"
                            placeholder="Optional notes for this decision…"
                            value={reviewNotes}
                            onChange={e => setReviewNotes(e.target.value)}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
          </CardContent>
        </Card>
      )}

      {tab === "catalog" && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Gift className="w-4 h-4" /> Reward Catalog</CardTitle></CardHeader>
          <CardContent>
            {!catalogData?.items?.length ? <p className="text-sm text-slate-400">No catalog items. Add items via the entity editor.</p>
              : (
                <div className="divide-y">
                  {catalogData.items.map(item => (
                    <div key={item.id} className="flex items-center justify-between py-3 gap-3">
                      <div>
                        <p className="font-medium text-slate-800">{item.name}</p>
                        <p className="text-xs text-slate-400">{item.category} · {item.track} · {item.point_cost} pts{item.requires_admin_approval ? " · Admin approval" : ""}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${item.is_active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                        {item.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
          </CardContent>
        </Card>
      )}

      {tab === "transactions" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Recent Transactions</CardTitle></CardHeader>
          <CardContent><TransactionFeed transactions={recentTxData} /></CardContent>
        </Card>
      )}
    </div>
  );
}