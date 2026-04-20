import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, Search, Loader2, Eye } from "lucide-react";
import { apiGet } from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";

const ROLE_TABS = [
  { key: "all", label: "All" },
  { key: "student", label: "Students" },
  { key: "parent", label: "Parents" },
  { key: "academic_coach", label: "Academic Coaches" },
  { key: "performance_coach", label: "Performance Coaches" },
];

const ROLE_BADGE = {
  student: "bg-blue-100 text-blue-700",
  parent: "bg-purple-100 text-purple-700",
  academic_coach: "bg-emerald-100 text-emerald-700",
  performance_coach: "bg-orange-100 text-orange-700",
};

export default function ImpersonateModal({ onClose }) {
  const { impersonateUser } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [loadingId, setLoadingId] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["users-for-impersonate"],
    queryFn: () => apiGet("/users"),
    staleTime: 60000,
  });

  const allUsers = (data?.users || []).filter(u => u.role !== "admin");

  const filtered = allUsers.filter(u => {
    if (activeTab !== "all" && u.role !== activeTab) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const name = `${u.firstName || ""} ${u.lastName || ""}`.toLowerCase();
      return name.includes(q) || (u.email || "").toLowerCase().includes(q);
    }
    return true;
  });

  const handleViewAs = async (user) => {
    setLoadingId(user.id);
    try {
      await impersonateUser(user.id);
      // page reloads — no further action needed
    } catch (err) {
      toast({ title: "Impersonation failed", description: err.message, variant: "destructive" });
      setLoadingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div>
            <h2 className="font-bold text-[#1a3c5e] text-lg">Switch User</h2>
            <p className="text-xs text-slate-500 mt-0.5">View the portal as any non-admin user</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Filters */}
        <div className="px-6 pt-4 pb-2 shrink-0 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name or email…"
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/40"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ROLE_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                  activeTab === tab.key
                    ? "bg-amber-500 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* User list */}
        <div className="flex-1 overflow-y-auto px-6 pb-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-10">No users found</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filtered.map(u => {
                const name = `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email;
                const badgeCls = ROLE_BADGE[u.role] || "bg-slate-100 text-slate-600";
                const isLoading = loadingId === u.id;
                return (
                  <li key={u.id} className="flex items-center justify-between py-3 gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{name}</p>
                      <p className="text-xs text-slate-400 truncate">{u.email}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${badgeCls}`}>
                        {u.role?.replace(/_/g, " ")}
                      </span>
                      <button
                        onClick={() => handleViewAs(u)}
                        disabled={isLoading || loadingId !== null}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-colors disabled:opacity-60"
                      >
                        {isLoading
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Eye className="w-3.5 h-3.5" />
                        }
                        View as
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
