import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Search, Users, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ParentEditModal from "@/components/admin/parents/ParentEditModal";

export default function AdminParents() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [creating, setCreating] = useState(false);

  const { data: parents = [], isLoading } = useQuery({
    queryKey: ["admin-parents"],
    queryFn: () => base44.entities.Parent.list("-created_date", 200),
  });

  const { data: students = [] } = useQuery({
    queryKey: ["admin-students-lookup"],
    queryFn: () => base44.entities.Student.list("full_name", 200),
  });

  const filtered = parents.filter(p =>
    !search ||
    p.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.user_email?.toLowerCase().includes(search.toLowerCase()) ||
    p.phone?.includes(search)
  );

  const handleUpdated = () => {
    qc.invalidateQueries({ queryKey: ["admin-parents"] });
    qc.invalidateQueries({ queryKey: ["admin-students-lookup"] });
    setSelected(null);
    setCreating(false);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm text-slate-500 mb-1">Admin</p>
          <h1 className="text-3xl font-bold text-[#1a3c5e]">Parents & Guardians</h1>
          <p className="text-slate-400 text-sm mt-1">View and edit parent/guardian profiles and their linked students.</p>
        </div>
        <Button
          onClick={() => setCreating(true)}
          className="bg-[#1a3c5e] hover:bg-[#0d2540]"
        >
          <Plus className="w-4 h-4 mr-2" /> Add Parent
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="py-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{parents.length}</p>
              <p className="text-xs text-slate-500">Total Parents</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{parents.filter(p => p.student_ids?.length > 0).length}</p>
              <p className="text-xs text-slate-500">With Students Linked</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-50 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{parents.filter(p => !p.student_ids?.length).length}</p>
              <p className="text-xs text-slate-500">No Students Linked</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search by name, email, or phone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-4 border-slate-200 border-t-[#1a3c5e] rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-slate-400 py-8 text-sm">No parents found.</p>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Parent / Guardian</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Phone</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Students</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(p => {
                const linkedStudents = students.filter(s => p.student_ids?.includes(s.id));
                return (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 text-xs font-bold shrink-0">
                          {p.full_name?.charAt(0) || "?"}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{p.full_name || "—"}</p>
                          {p.is_primary_contact && (
                            <span className="text-xs text-purple-600">Primary Contact</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{p.user_email || "—"}</td>
                    <td className="px-4 py-3 text-slate-500">{p.phone || "—"}</td>
                    <td className="px-4 py-3">
                      {linkedStudents.length === 0 ? (
                        <span className="text-xs text-slate-400 italic">None</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {linkedStudents.map(s => (
                            <span key={s.id} className="text-xs bg-green-50 border border-green-200 text-green-700 px-2 py-0.5 rounded-full">
                              {s.full_name}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setSelected(p)}
                        className="text-xs text-[#1a3c5e] hover:underline font-medium"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {(selected || creating) && (
        <ParentEditModal
          parent={selected}
          allStudents={students}
          onClose={() => { setSelected(null); setCreating(false); }}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  );
}