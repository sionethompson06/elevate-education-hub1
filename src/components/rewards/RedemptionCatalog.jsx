import { useState } from "react";
import { apiGet, apiPost } from "@/api/apiClient";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Gift, Loader2 } from "lucide-react";

export default function RedemptionCatalog({ balance, studentId, onRedeemed }) {
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState(null);

  const { data: items = [] } = useQuery({
    queryKey: ["reward-catalog"],
    queryFn: () => apiGet("/rewards/catalog"),
  });

  const availablePts = balance?.total_points || 0;

  const redeem = async (item) => {
    if (!studentId) return;
    setLoading(item.id);
    setError(null);
    try {
      await apiPost("/rewards/redeem", {
        studentId,
        catalogItemId: item.id,
      });
      onRedeemed?.();
    } catch (err) {
      setError(err.message || "Redemption failed");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center text-sm gap-2">
        <span className="text-slate-500">Available:</span>
        <span className="font-bold text-yellow-600">{availablePts} pts</span>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      {items.length === 0 ? (
        <p className="text-sm text-slate-400">No items in catalog.</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {items.map(item => {
            const cost = item.pointCost ?? item.point_cost ?? 0;
            const canAfford = availablePts >= cost;
            return (
              <div key={item.id} className={`rounded-xl border p-4 flex items-start gap-3 ${canAfford ? "border-slate-200" : "border-slate-100 opacity-60"}`}>
                <div className="w-10 h-10 bg-yellow-50 rounded-lg flex items-center justify-center shrink-0">
                  <Gift className="w-5 h-5 text-yellow-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-slate-800">{item.name}</p>
                  {item.description && <p className="text-xs text-slate-400 mt-0.5 truncate">{item.description}</p>}
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs font-bold text-yellow-600">{cost} pts</span>
                    <Button
                      size="sm"
                      disabled={!canAfford || loading === item.id || !studentId}
                      className="h-7 text-xs bg-yellow-500 hover:bg-yellow-600 text-white"
                      onClick={() => redeem(item)}
                    >
                      {loading === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Redeem"}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
