import { useState, useEffect, useCallback } from "react";
import { apiGet } from "@/api/apiClient";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, ShieldX, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import OverrideModal from "./OverrideModal";
import RevokeOverrideModal from "./RevokeOverrideModal";

const OVERRIDE_LABEL = {
  scholarship:            "Scholarship",
  comped:                 "Comped (Full Waiver)",
  deferred:               "Deferred Payment",
  manual_offline:         "Manual / Offline",
  payment_plan_exception: "Payment Plan Exception",
  admin_exception:        "Admin Exception",
};

export default function EnrollmentOverridePanel({ enrollment, onUpdated }) {
  const [overrides, setOverrides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [revoking, setRevoking] = useState(null);
  const qc = useQueryClient();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet(`/enrollments/${enrollment.id}/overrides`);
      setOverrides(data.overrides || []);
    } catch {
      setOverrides([]);
    }
    setLoading(false);
  }, [enrollment.id]);

  useEffect(() => { load(); }, [load]);

  const handleSuccess = () => {
    setShowCreate(false);
    setRevoking(null);
    load();
    qc.invalidateQueries({ queryKey: ["admin-enrollments"] });
    if (onUpdated) onUpdated();
  };

  const activeOverride = overrides.find(o => o.isActive);
  const canApplyOverride = !activeOverride && enrollment.status !== "active_override";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-purple-600" /> Override Status
        </h3>
        {canApplyOverride && (
          <Button size="sm" className="bg-purple-700 hover:bg-purple-800" onClick={() => setShowCreate(true)}>
            <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Apply Override
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-4">
          <div className="w-4 h-4 border-4 border-slate-200 border-t-purple-600 rounded-full animate-spin" />
        </div>
      ) : overrides.length === 0 ? (
        <p className="text-sm text-slate-400">No overrides on record.</p>
      ) : (
        <div className="space-y-3">
          {overrides.map(o => (
            <div
              key={o.id}
              className={`rounded-xl border p-4 ${o.isActive ? "border-purple-200 bg-purple-50" : "border-slate-200 bg-slate-50"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {o.isActive
                      ? <CheckCircle className="w-4 h-4 text-purple-600 shrink-0" />
                      : <ShieldX className="w-4 h-4 text-slate-400 shrink-0" />}
                    <span className="font-semibold text-sm text-slate-800">
                      {OVERRIDE_LABEL[o.overrideType] || o.overrideType}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${o.isActive ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-500"}`}>
                      {o.isActive ? "Active" : "Revoked"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">{o.reason}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Approved by {o.approvedByName || "Admin"} · {o.approvedAt ? format(new Date(o.approvedAt), "MMM d, yyyy") : "—"}
                  </p>
                  {o.amountWaivedCents > 0 && (
                    <p className="text-xs text-green-600 mt-1">
                      Waived: ${(o.amountWaivedCents / 100).toLocaleString()}
                    </p>
                  )}
                  {o.amountDeferredCents > 0 && (
                    <p className="text-xs text-yellow-600 mt-1">
                      Deferred: ${(o.amountDeferredCents / 100).toLocaleString()}
                    </p>
                  )}
                  {o.amountDueNowCents > 0 && (
                    <p className="text-xs text-slate-600 mt-1">
                      Due now: ${(o.amountDueNowCents / 100).toLocaleString()}
                    </p>
                  )}
                  {o.revokedAt && (
                    <p className="text-xs text-red-400 mt-1">
                      Revoked {format(new Date(o.revokedAt), "MMM d, yyyy")}
                      {o.revokeReason ? ` — ${o.revokeReason}` : ""}
                    </p>
                  )}
                </div>
                {o.isActive && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 border-red-200 hover:bg-red-50 shrink-0"
                    onClick={() => setRevoking(o)}
                  >
                    <ShieldX className="w-3.5 h-3.5 mr-1" /> Revoke
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <OverrideModal
          enrollment={enrollment}
          onClose={() => setShowCreate(false)}
          onSuccess={handleSuccess}
        />
      )}
      {revoking && (
        <RevokeOverrideModal
          override={revoking}
          onClose={() => setRevoking(null)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
