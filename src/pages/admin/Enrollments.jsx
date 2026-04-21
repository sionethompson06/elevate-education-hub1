import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/api/apiClient";
import { Users, Plus, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import EnrollmentDetailPanel from "@/components/admin/enrollments/EnrollmentDetailPanel";

const STATUS_COLORS = {
  pending_payment: "bg-yellow-100 text-yellow-700",
  pending:         "bg-yellow-100 text-yellow-700",
  active:          "bg-green-100 text-green-700",
  active_override: "bg-purple-100 text-purple-700",
  payment_failed:  "bg-red-100 text-red-700",
  paused:          "bg-slate-100 text-slate-500",
  cancelled:       "bg-slate-100 text-slate-400",
};

const STATUS_FILTERS = ["all", "pending_payment", "active", "active_override", "payment_failed", "paused", "cancelled"];

function statusLabel(status) {
  if (status === "pending" || status === "pending_payment") return "Pending Payment";
  return status?.replace(/_/g, " ") ?? "";
}

export default function Enrollments() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ studentId: "", programIds: [] });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [createResult, setCreateResult] = useState(null);
  const qc = useQueryClient();

  const { data: allEnrollments = [], isLoading } = useQuery({
    queryKey: ["admin-enrollments"],
    queryFn: () => apiGet("/enrollments").then(d => d.enrollments || []),
  });

  const { data: studentsData = [] } = useQuery({
    queryKey: ["admin-all-students"],
    queryFn: () => apiGet("/students").then(d => d.students || []),
    enabled: showCreate,
  });

  const { data: programsData = [] } = useQuery({
    queryKey: ["admin-all-programs"],
    queryFn: () => apiGet("/programs").then(d => d.programs || []),
    enabled: showCreate,
  });

  const enrollments = statusFilter === "all"
    ? allEnrollments
    : statusFilter === "pending_payment"
      ? allEnrollments.filter(e => e.status === "pending_payment" || e.status === "pending")
      : allEnrollments.filter(e => e.status === statusFilter);

  const toggleProgram = (id) => {
    setCreateForm(f => ({
      ...f,
      programIds: f.programIds.includes(id)
        ? f.programIds.filter(p => p !== id)
        : [...f.programIds, id],
    }));
  };

  const handleCreate = async () => {
    if (!createForm.studentId || createForm.programIds.length === 0) return;
    setCreating(true);
    setCreateError(null);
    setCreateResult(null);
    let created = 0, skipped = 0;
    for (const programId of createForm.programIds) {
      try {
        await apiPost("/enrollments", {
          studentId: parseInt(createForm.studentId),
          programId: parseInt(programId),
        });
        created++;
      } catch (err) {
        if (err.message?.toLowerCase().includes("already enrolled")) skipped++;
        else setCreateError(err.message || "Failed to create enrollment.");
      }
    }
    qc.invalidateQueries({ queryKey: ["admin-enrollments"] });
    if (created > 0 && skipped === 0) {
      setShowCreate(false);
      setCreateForm({ studentId: "", programIds: [] });
    } else {
      setCreateResult(`${created} enrollment${created !== 1 ? "s" : ""} created${skipped > 0 ? `, ${skipped} already existed` : ""}.`);
      if (created > 0) setCreateForm(f => ({ ...f, programIds: [] }));
    }
    setCreating(false);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="inline-block px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold mb-2">Admin</div>
          <h1 className="text-3xl font-bold text-[#1a3c5e] flex items-center gap-3">
            <Users className="w-8 h-8" /> Enrollments
          </h1>
          <p className="text-slate-500 mt-1">Manage all student enrollments and payment overrides.</p>
        </div>
        <Button className="bg-[#1a3c5e] hover:bg-[#0d2540]" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-2" /> Create Enrollment
        </Button>
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

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-[#1a3c5e] text-lg">Create Enrollment</h3>
              <button onClick={() => setShowCreate(false)} className="p-1 rounded hover:bg-slate-100">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Student *</label>
              <select
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                value={createForm.studentId}
                onChange={e => setCreateForm(f => ({ ...f, studentId: e.target.value }))}
              >
                <option value="">Select student...</option>
                {studentsData.map(s => (
                  <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Programs * <span className="text-xs text-slate-400 font-normal">(select one or more)</span>
              </label>
              <div className="border border-slate-200 rounded-lg divide-y max-h-48 overflow-y-auto">
                {programsData.filter(p => p.status === "active").length === 0 ? (
                  <p className="text-xs text-slate-400 px-3 py-2">No active programs available.</p>
                ) : (
                  programsData.filter(p => p.status === "active").map(p => (
                    <label key={p.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={createForm.programIds.includes(String(p.id))}
                        onChange={() => toggleProgram(String(p.id))}
                        className="rounded border-slate-300 text-[#1a3c5e] focus:ring-[#1a3c5e]"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800">{p.name}</p>
                        <p className="text-xs text-slate-400">${parseFloat(p.tuitionAmount || 0).toLocaleString()}/{p.billingCycle?.replace(/_/g, " ") || "mo"}</p>
                      </div>
                    </label>
                  ))
                )}
              </div>
              {createForm.programIds.length > 0 && (
                <p className="text-xs text-slate-500 mt-1">{createForm.programIds.length} program{createForm.programIds.length !== 1 ? "s" : ""} selected</p>
              )}
            </div>
            {createError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{createError}</p>
            )}
            {createResult && (
              <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{createResult}</p>
            )}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => { setShowCreate(false); setCreateError(null); setCreateResult(null); setCreateForm({ studentId: "", programIds: [] }); }}
                className="flex-1 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
              >Cancel</button>
              <Button
                onClick={handleCreate}
                disabled={creating || !createForm.studentId || createForm.programIds.length === 0}
                className="flex-1 bg-[#1a3c5e] hover:bg-[#0d2540]"
              >
                {creating ? "Creating..." : `Enroll in ${createForm.programIds.length || 0} Program${createForm.programIds.length !== 1 ? "s" : ""}`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
