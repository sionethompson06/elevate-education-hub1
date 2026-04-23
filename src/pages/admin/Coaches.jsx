import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2, RefreshCw, GraduationCap, Dumbbell, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiGet, apiPost } from "@/api/apiClient";
import CoachCard from "@/components/admin/coaches/CoachCard";
import CoachDetailDrawer from "@/components/admin/coaches/CoachDetailDrawer";
import CreateCoachModal from "@/components/admin/coaches/CreateCoachModal";

const TYPE_FILTER = [
  { value: "all", label: "All Coaches" },
  { value: "academic_coach", label: "Academic Coaches" },
  { value: "performance_coach", label: "Performance Coaches" },
];

const STATUS_FILTER = [
  { value: "all", label: "All Statuses" },
  { value: "active", label: "Active" },
  { value: "invited", label: "Invited" },
  { value: "inactive", label: "Inactive" },
];

export default function AdminCoaches() {
  const qc = useQueryClient();
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedCoach, setSelectedCoach] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [inviteFlash, setInviteFlash] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-coaches"],
    queryFn: () => apiGet("/coaches"),
  });

  const coaches = data?.coaches || [];

  const filtered = coaches.filter(c => {
    const matchType = typeFilter === "all" || c.role === typeFilter;
    const matchStatus = statusFilter === "all" || c.coachStatus === statusFilter;
    return matchType && matchStatus;
  });

  const academicCount = coaches.filter(c => c.role === "academic_coach").length;
  const performanceCount = coaches.filter(c => c.role === "performance_coach").length;
  const totalStudents = coaches.reduce((sum, c) => sum + (c.studentCount || 0), 0);
  const activeCount = coaches.filter(c => c.coachStatus === "active").length;

  const handleResendInvite = async (coach) => {
    try {
      await apiPost(`/coaches/${coach.id}/invite`, {});
      setInviteFlash(`Invite sent to ${coach.firstName} ${coach.lastName}.`);
      setTimeout(() => setInviteFlash(""), 4000);
      qc.invalidateQueries({ queryKey: ["admin-coaches"] });
    } catch {
      setInviteFlash("Failed to send invite.");
      setTimeout(() => setInviteFlash(""), 4000);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-5">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Coach Management</h1>
            <p className="text-sm text-slate-500 mt-0.5">Create, assign, and monitor Academic and Performance Coaches</p>
          </div>
          <Button
            className="bg-[#1a3c5e] hover:bg-[#0d2540] text-white text-sm shrink-0"
            onClick={() => setShowCreate(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Coach
          </Button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Flash message */}
        {inviteFlash && (
          <div className="bg-blue-50 border border-blue-200 text-blue-700 text-sm rounded-xl px-4 py-3">
            {inviteFlash}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard Icon={GraduationCap} label="Academic Coaches" value={academicCount} color="text-emerald-600 bg-emerald-50" />
          <StatCard Icon={Dumbbell} label="Performance Coaches" value={performanceCount} color="text-orange-500 bg-orange-50" />
          <StatCard Icon={Users} label="Students Assigned" value={totalStudents} color="text-blue-600 bg-blue-50" />
          <StatCard Icon={RefreshCw} label="Active Coaches" value={activeCount} color="text-slate-600 bg-slate-100" />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {TYPE_FILTER.map(f => (
            <button
              key={f.value}
              onClick={() => setTypeFilter(f.value)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                typeFilter === f.value
                  ? "bg-[#1a3c5e] text-white"
                  : "bg-white text-slate-600 border border-slate-200 hover:border-[#1a3c5e]/40"
              }`}
            >
              {f.label}
            </button>
          ))}
          <div className="w-px bg-slate-200 mx-1" />
          {STATUS_FILTER.map(f => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                statusFilter === f.value
                  ? "bg-slate-700 text-white"
                  : "bg-white text-slate-500 border border-slate-200 hover:border-slate-400"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {isLoading && (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
            Failed to load coaches: {error.message}
          </div>
        )}

        {!isLoading && !error && filtered.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium text-slate-500">No coaches found</p>
            <p className="text-sm mt-1">
              {coaches.length === 0
                ? 'Click "Create Coach" to add your first coach.'
                : "Try adjusting your filters."}
            </p>
          </div>
        )}

        {!isLoading && filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(coach => (
              <CoachCard
                key={coach.id}
                coach={coach}
                onOpen={setSelectedCoach}
                onResendInvite={handleResendInvite}
              />
            ))}
          </div>
        )}
      </div>

      {/* Detail drawer */}
      {selectedCoach && (
        <CoachDetailDrawer
          coach={selectedCoach}
          onClose={() => setSelectedCoach(null)}
          onRefresh={() => qc.invalidateQueries({ queryKey: ["admin-coaches"] })}
        />
      )}

      {/* Create modal */}
      {showCreate && (
        <CreateCoachModal
          onClose={() => setShowCreate(false)}
          onCreated={() => qc.invalidateQueries({ queryKey: ["admin-coaches"] })}
        />
      )}
    </div>
  );
}

function StatCard({ Icon, label, value, color }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-4 py-4 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-4.5 h-4.5" />
      </div>
      <div>
        <p className="text-xl font-bold text-slate-800 leading-none">{value}</p>
        <p className="text-xs text-slate-400 mt-0.5">{label}</p>
      </div>
    </div>
  );
}
