import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet } from "@/api/apiClient";
import { Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import EnrollmentDetailPanel from "@/components/admin/enrollments/EnrollmentDetailPanel";

const STATUS_COLORS = {
  pending_payment: "bg-yellow-100 text-yellow-700",
  pending:         "bg-yellow-100 text-yellow-700", // legacy alias — normalized to pending_payment at startup
  active:          "bg-green-100 text-green-700",
  active_override: "bg-purple-100 text-purple-700",
  payment_failed:  "bg-red-100 text-red-700",
  paused:          "bg-slate-100 text-slate-500",
  cancelled:       "bg-slate-100 text-slate-400",
};

// 'pending_payment' filter also catches legacy 'pending' records
const STATUS_FILTERS = ["all", "pending_payment", "active", "active_override", "payment_failed", "paused", "cancelled"];

// Normalize display label for status values
function statusLabel(status) {
  if (status === "pending" || status === "pending_payment") return "Pending Payment";
  return status?.replace(/_/g, " ") ?? "";
}

export default function Enrollments() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const qc = useQueryClient();

  const { data: allEnrollments = [], isLoading } = useQuery({
    queryKey: ["admin-enrollments"],
    queryFn: () => apiGet("/enrollments").then(d => d.enrollments || []),
  });

  // Treat 'pending' as 'pending_payment' for filtering purposes
  const enrollments = statusFilter === "all"
    ? allEnrollments
    : statusFilter === "pending_payment"
      ? allEnrollments.filter(e => e.status === "pending_payment" || e.status === "pending")
      : allEnrollments.filter(e => e.status === statusFilter);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="inline-block px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold mb-2">Admin</div>
        <h1 className="text-3xl font-bold text-[#1a3c5e] flex items-center gap-3">
          <Users className="w-8 h-8" /> Enrollments
        </h1>
        <p className="text-slate-500 mt-1">Manage all student enrollments and payment overrides.</p>
      </div>

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
            {s === "all" ? "All" : statusLabel(s)}
            {s !== "all" && (
              <span className="ml-1 opacity-60">
                ({s === "pending_payment"
                  ? allEnrollments.filter(e => e.status === "pending_payment" || e.status === "pending").length
                  : allEnrollments.filter(e => e.status === s).length})
              </span>
            )}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <div className="w-6 h-6 border-4 border-slate-200 border-t-[#1a3c5e] rounded-full animate-spin" />
            </div>
          ) : enrollments.length === 0 ? (
            <p className="text-center text-slate-400 py-16 text-sm">No enrollments found.</p>
          ) : (
            <div className="divide-y">
              {enrollments.map((e) => {
                const sc = STATUS_COLORS[e.status] || "bg-slate-100 text-slate-500";
                const studentName = e.studentFirstName
                  ? `${e.studentFirstName} ${e.studentLastName || ""}`.trim()
                  : `Student #${e.studentId}`;
                const parentLabel = e.parentFirstName
                  ? `${e.parentFirstName} ${e.parentLastName || ""}`.trim()
                  : e.parentEmail || null;
                return (
                  <button
                    key={e.id}
                    onClick={() => setSelected(e)}
                    className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 text-left gap-4 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-bold text-slate-900">{studentName}</p>
                        {parentLabel && (
                          <p className="text-xs text-slate-400">· Parent: {parentLabel}</p>
                        )}
                        {e.createdAt && (
                          <p className="text-xs text-slate-400">· Enrolled {format(new Date(e.createdAt), "MMM d, yyyy")}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm text-slate-600">{e.programName || `Program #${e.programId}`}</p>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${sc}`}>
                          {statusLabel(e.status)}
                        </span>
                        {e.invoiceStatus && (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-500">
                            Invoice: {e.invoiceStatus}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-slate-700 shrink-0">
                      {e.invoiceAmount != null ? `$${parseFloat(e.invoiceAmount).toLocaleString()} due` : ""}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {selected && (
        <EnrollmentDetailPanel
          enrollment={selected}
          statusColors={STATUS_COLORS}
          onClose={() => setSelected(null)}
          onUpdated={() => {
            qc.invalidateQueries({ queryKey: ["admin-enrollments"] });
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}
