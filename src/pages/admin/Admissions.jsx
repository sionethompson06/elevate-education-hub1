import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet } from "@/api/apiClient";
import { ClipboardList, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
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
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: allApplications = [], isLoading } = useQuery({
    queryKey: ["applications"],
    queryFn: () => apiGet("/applications").then(r => r.applications || []),
  });

  const filtered = useMemo(() => {
    let list = statusFilter === "all" ? allApplications : allApplications.filter(a => a.status === statusFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(a =>
        `${a.parent_first_name} ${a.parent_last_name}`.toLowerCase().includes(q) ||
        `${a.student_first_name} ${a.student_last_name}`.toLowerCase().includes(q) ||
        (a.email || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [allApplications, statusFilter, search]);

  const countFor = (s) => s === "all"
    ? allApplications.length
    : allApplications.filter(a => a.status === s).length;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="inline-block px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold mb-2">Admin</div>
        <h1 className="text-3xl font-bold text-[#1a3c5e] flex items-center gap-3">
          <ClipboardList className="w-8 h-8" /> Admissions
        </h1>
        <p className="text-slate-500 mt-1">Review and process student applications.</p>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {STATUS_FILTERS.map((s) => {
          const count = countFor(s);
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors flex items-center gap-1.5 ${
                statusFilter === s
                  ? "bg-[#1a3c5e] text-white"
                  : "bg-white text-slate-600 border border-slate-200 hover:border-[#1a3c5e]"
              }`}
            >
              {s === "all" ? "All" : s.replace("_", " ")}
              {count > 0 && (
                <span className={`text-xs rounded-full px-1.5 py-0.5 font-bold ${statusFilter === s ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search by student name, parent name, or email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30 bg-white"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <div className="w-6 h-6 border-4 border-slate-200 border-t-[#1a3c5e] rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-slate-400 py-16 text-sm">
              {search ? "No applications match your search." : "No applications found for this filter."}
            </p>
          ) : (
            <div className="divide-y">
              {filtered.map((app) => (
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
