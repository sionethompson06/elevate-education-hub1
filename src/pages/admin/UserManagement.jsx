import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Search, Users, Shield, UserCheck, Loader2, ChevronDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import UserRoleModal from "@/components/admin/users/UserRoleModal";

const ROLE_CONFIG = {
  admin:             { label: "Admin",            badge: "bg-red-100 text-red-700" },
  academic_coach:    { label: "Academic Coach",   badge: "bg-blue-100 text-blue-700" },
  performance_coach: { label: "Performance Coach",badge: "bg-orange-100 text-orange-700" },
  parent:            { label: "Parent",           badge: "bg-purple-100 text-purple-700" },
  user:              { label: "User / Parent",    badge: "bg-slate-100 text-slate-600" },
  student:           { label: "Student",          badge: "bg-green-100 text-green-700" },
};

const ROLE_FILTERS = ["all", "admin", "academic_coach", "performance_coach", "parent", "user", "student"];

export default function UserManagement() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [selected, setSelected] = useState(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-all-users"],
    queryFn: () => base44.entities.User.list("-created_date", 200),
  });

  const filtered = users.filter(u => {
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    const matchSearch = !search ||
      u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase());
    return matchRole && matchSearch;
  });

  const counts = ROLE_FILTERS.slice(1).reduce((acc, r) => {
    acc[r] = users.filter(u => u.role === r).length;
    return acc;
  }, {});

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <p className="text-sm text-slate-500 mb-1">Admin</p>
        <h1 className="text-3xl font-bold text-[#1a3c5e]">User Management</h1>
        <p className="text-slate-400 text-sm mt-1">View all users, adjust roles, and set up coach profiles.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card><CardContent className="py-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center"><Users className="w-4 h-4 text-slate-600" /></div>
          <div><p className="text-2xl font-bold">{users.length}</p><p className="text-xs text-slate-500">Total Users</p></div>
        </CardContent></Card>
        <Card><CardContent className="py-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center"><UserCheck className="w-4 h-4 text-blue-600" /></div>
          <div><p className="text-2xl font-bold">{(counts.academic_coach || 0) + (counts.performance_coach || 0)}</p><p className="text-xs text-slate-500">Coaches</p></div>
        </CardContent></Card>
        <Card><CardContent className="py-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-purple-50 rounded-xl flex items-center justify-center"><Users className="w-4 h-4 text-purple-600" /></div>
          <div><p className="text-2xl font-bold">{(counts.parent || 0) + (counts.user || 0)}</p><p className="text-xs text-slate-500">Parents</p></div>
        </CardContent></Card>
        <Card><CardContent className="py-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center"><Shield className="w-4 h-4 text-red-600" /></div>
          <div><p className="text-2xl font-bold">{counts.admin || 0}</p><p className="text-xs text-slate-500">Admins</p></div>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {ROLE_FILTERS.map(r => (
          <button
            key={r}
            onClick={() => setRoleFilter(r)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              roleFilter === r
                ? "bg-[#1a3c5e] text-white border-[#1a3c5e]"
                : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
            }`}
          >
            {r === "all" ? "All Roles" : (ROLE_CONFIG[r]?.label || r)}
            {r !== "all" && counts[r] !== undefined && (
              <span className="ml-1 opacity-70">({counts[r]})</span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
        />
      </div>

      {/* User list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-4 border-slate-200 border-t-[#1a3c5e] rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-slate-400 py-8 text-sm">No users found.</p>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">User</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Role</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Joined</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(u => {
                const rc = ROLE_CONFIG[u.role] || { label: u.role, badge: "bg-slate-100 text-slate-600" };
                return (
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[#1a3c5e] flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {u.full_name?.charAt(0) || "?"}
                        </div>
                        <span className="font-medium text-slate-800">{u.full_name || "—"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${rc.badge}`}>
                        {rc.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {u.created_date ? new Date(u.created_date).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setSelected(u)}
                        className="text-xs text-[#1a3c5e] hover:underline font-medium"
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <UserRoleModal
          user={selected}
          onClose={() => setSelected(null)}
          onUpdated={() => {
            qc.invalidateQueries({ queryKey: ["admin-all-users"] });
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}