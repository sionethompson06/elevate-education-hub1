import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch, apiPost } from "@/api/apiClient";
import { Star, Gift, CheckCircle, XCircle, Loader2, Plus, ToggleLeft, ToggleRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

const TABS = ["redemptions", "catalog", "transactions"];

export default function AdminRewards() {
  const [tab, setTab] = useState("redemptions");
  const [reviewing, setReviewing] = useState(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [saving, setSaving] = useState(null);
  const [showNewItem, setShowNewItem] = useState(false);
  const [newItem, setNewItem] = useState({ name: "", description: "", pointCost: 100 });
  const qc = useQueryClient();

  const { data: redemptions = [], isLoading: pendingLoading } = useQuery({
    queryKey: ["pending-redemptions"],
    queryFn: () => apiGet('/rewards/redemptions?status=pending'),
    enabled: tab === "redemptions",
  });

  const { data: catalogAll = [] } = useQuery({
    queryKey: ["reward-catalog-all"],
    queryFn: () => apiGet('/rewards'),
    enabled: tab === "catalog",
  });

  const { data: recentTx = [] } = useQuery({
    queryKey: ["admin-recent-tx"],
    queryFn: () => apiGet('/rewards/transactions'),
    enabled: tab === "transactions",
  });

  const decide = async (id, status) => {
    setSaving(id);
    try {
      await apiPatch(`/rewards/redemptions/${id}`, { status, reviewNotes });
      qc.invalidateQueries({ queryKey: ["pending-redemptions"] });
    } finally {
      setSaving(null);
      setReviewing(null);
      setReviewNotes("");
    }
  };

  const toggleCatalogItem = async (item) => {
    await apiPatch(`/rewards/catalog/${item.id}`, { isActive: !item.isActive });
    qc.invalidateQueries({ queryKey: ["reward-catalog-all"] });
  };

  const createCatalogItem = async () => {
    if (!newItem.name || !newItem.pointCost) return;
    await apiPost('/rewards/catalog', newItem);
    qc.invalidateQueries({ queryKey: ["reward-catalog-all"] });
    setShowNewItem(false);
    setNewItem({ name: "", description: "", pointCost: 100 });
  };

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
            {t}
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
                          <p className="font-semibold text-slate-800">{r.item_name || "Unknown item"}</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {r.student_name} · {r.pointsCost} pts · {r.createdAt ? format(new Date(r.createdAt), "MMM d, h:mm a") : ""}
                          </p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Button size="sm" className="bg-green-700 hover:bg-green-800 h-8"
                            disabled={saving === r.id}
                            onClick={() => reviewing === r.id ? decide(r.id, 'approved') : setReviewing(r.id)}>
                            {saving === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5 mr-1" />}
                            {reviewing === r.id ? "Confirm" : "Approve"}
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
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><Gift className="w-4 h-4" /> Reward Catalog</CardTitle>
              <Button size="sm" onClick={() => setShowNewItem(true)} className="bg-[#1a3c5e] hover:bg-[#0d2540]">
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Item
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {showNewItem && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <p className="text-sm font-semibold text-slate-700">New Catalog Item</p>
                <div className="grid grid-cols-2 gap-3">
                  <input className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                    placeholder="Item name *" value={newItem.name} onChange={e => setNewItem(f => ({ ...f, name: e.target.value }))} />
                  <input type="number" className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                    placeholder="Point cost *" value={newItem.pointCost} onChange={e => setNewItem(f => ({ ...f, pointCost: e.target.value }))} />
                </div>
                <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  placeholder="Description (optional)" value={newItem.description} onChange={e => setNewItem(f => ({ ...f, description: e.target.value }))} />
                <div className="flex gap-2">
                  <button onClick={() => setShowNewItem(false)} className="text-xs text-slate-500 hover:text-slate-700">Cancel</button>
                  <Button size="sm" onClick={createCatalogItem} className="bg-[#1a3c5e] hover:bg-[#0d2540]">Save Item</Button>
                </div>
              </div>
            )}
            {catalogAll.length === 0 ? <p className="text-sm text-slate-400 text-center py-6">No catalog items yet.</p>
              : (
                <div className="divide-y">
                  {catalogAll.map(item => (
                    <div key={item.id} className="flex items-center justify-between py-3 gap-3">
                      <div>
                        <p className="font-medium text-slate-800">{item.name}</p>
                        <p className="text-xs text-slate-400">{item.description} · {item.pointCost} pts</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${item.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                          {item.isActive ? "Active" : "Inactive"}
                        </span>
                        <button onClick={() => toggleCatalogItem(item)} className="text-slate-400 hover:text-slate-700">
                          {item.isActive ? <ToggleRight className="w-5 h-5 text-green-600" /> : <ToggleLeft className="w-5 h-5" />}
                        </button>
                      </div>
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
          <CardContent>
            {recentTx.length === 0 ? <p className="text-sm text-slate-400 text-center py-6">No transactions yet.</p>
              : (
                <div className="divide-y">
                  {recentTx.map(tx => (
                    <div key={tx.id} className="flex items-center justify-between py-3 text-sm">
                      <div>
                        <p className="font-medium text-slate-800">{tx.student_name || `Student #${tx.studentId}`}</p>
                        <p className="text-xs text-slate-400">{tx.reason}</p>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold ${tx.delta > 0 ? "text-green-600" : "text-red-500"}`}>
                          {tx.delta > 0 ? "+" : ""}{tx.delta} pts
                        </p>
                        <p className="text-xs text-slate-400">{tx.createdAt ? format(new Date(tx.createdAt), "MMM d") : ""}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
