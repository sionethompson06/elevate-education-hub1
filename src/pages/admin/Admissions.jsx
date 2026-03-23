import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { ClipboardList, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ApplicationRow from "@/components/admin/admissions/ApplicationRow";
import ApplicationDetailModal from "@/components/admin/admissions/ApplicationDetailModal";

const STATUS_FILTERS = ["all", "submitted", "under_review", "approved", "denied", "waitlisted", "draft"];

const STATUS_COLORS = {
  submitted: "bg-blue-100 text-blue-700",
  under_review: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  denied: "bg-red-100 text-red-700",
  waitlisted: "bg-purple-100 text-purple-700",
  draft: "bg-slate-100 text-slate-500",
};

export default function Admissions() {
  const [statusFilter, setStatusFilter] = useState("submitted");
  const [selected, setSelected] = useState(null);
  const qc = useQueryClient();

  const { data: applications = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["applications", statusFilter],
    queryFn: () =>
      statusFilter === "all"
        ? base44.entities.Application.list("-submitted_at", 100)
        : base44.entities.Application.filter({ status: statusFilter }, "-submitted_at", 100),
  });

  const counts = {};
  STATUS_FILTERS.forEach((s) => (counts[s] = ""));

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="inline-block px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold mb-2">Admin</div>
        <h1 className="text-3xl font-bold text-[#1a3c5e] flex items-center gap-3">
          <ClipboardList className="w-8 h-8" /> Admissions
        </h1>
        <p className="text-slate-500 mt-1">Review and process student applications.</p>
      </div>
      <button
        onClick={() => refetch()}
        disabled={isFetching}
        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:border-[#1a3c5e] hover:text-[#1a3c5e] transition-colors disabled:opacity-50"
      >
        <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
        Refresh
      </button>

      {/* Status filter tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
              statusFilter === s
                ? "bg-[#1a3c5e] text-white"
                : "bg-white text-slate-600 border border-slate-200 hover:border-[#1a3c5e]"
            }`}
          >
            {s === "all" ? "All" : s.replace("_", " ")}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <div className="w-6 h-6 border-4 border-slate-200 border-t-[#1a3c5e] rounded-full animate-spin" />
            </div>
          ) : applications.length === 0 ? (
            <p className="text-center text-slate-400 py-16 text-sm">No applications found for this filter.</p>
          ) : (
            <div className="divide-y">
              {applications.map((app) => (
                <ApplicationRow
                  key={app.id}
                  application={app}
                  statusColors={STATUS_COLORS}
                  onSelect={() => setSelected(app)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selected && (
        <ApplicationDetailModal
          application={selected}
          statusColors={STATUS_COLORS}
          onClose={() => setSelected(null)}
          onUpdated={() => {
            qc.invalidateQueries({ queryKey: ["applications"] });
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}