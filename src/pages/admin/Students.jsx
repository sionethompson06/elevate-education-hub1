import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet } from "@/api/apiClient";
import { Search, Users, BookOpen, Activity } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import StudentDetailModal from "@/components/admin/students/StudentDetailModal";

export default function AdminStudents() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);

  const { data: studentsData = { students: [] }, isLoading } = useQuery({
    queryKey: ["admin-students"],
    queryFn: () => apiGet('/students'),
  });

  const { data: assignmentsData = { assignments: [] } } = useQuery({
    queryKey: ["all-coach-assignments"],
    queryFn: () => apiGet('/coach-assignments?isActive=true'),
  });

  const { data: enrollmentsData = { enrollments: [] } } = useQuery({
    queryKey: ["all-enrollments-admin"],
    queryFn: () => apiGet('/enrollments'),
  });

  const students = studentsData.students || [];
  const assignments = assignmentsData.assignments || [];
  const enrollments = (enrollmentsData.enrollments || []).filter(e => e.status === 'active' || e.status === 'active_override');

  const filtered = students.filter(s => {
    if (!search) return true;
    const name = `${s.firstName} ${s.lastName}`.toLowerCase();
    return name.includes(search.toLowerCase());
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <p className="text-sm text-slate-500 mb-1">Admin</p>
        <h1 className="text-3xl font-bold text-[#1a3c5e]">Students</h1>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="py-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{students.length}</p>
              <p className="text-xs text-slate-500">Total Students</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{assignments.filter(a => a.coachType === "academic_coach").length}</p>
              <p className="text-xs text-slate-500">Academic Coach Assignments</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center">
              <Activity className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{assignments.filter(a => a.coachType === "performance_coach").length}</p>
              <p className="text-xs text-slate-500">Performance Coach Assignments</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search by name..."
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
        <p className="text-center text-slate-400 py-8 text-sm">No students found.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {filtered.map(s => {
            const sa = assignments.filter(a => a.studentId === s.id);
            const se = enrollments.filter(e => e.studentId === s.id);
            const hasAcademic = sa.some(a => a.coachType === "academic_coach");
            const hasPerf = sa.some(a => a.coachType === "performance_coach");
            const fullName = `${s.firstName} ${s.lastName}`;
            return (
              <button
                key={s.id}
                onClick={() => setSelected(s)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-slate-200 bg-white hover:border-[#1a3c5e] hover:bg-slate-50 transition-all text-left group"
              >
                <div className="w-7 h-7 rounded-full bg-[#1a3c5e] flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {s.firstName?.charAt(0) || "?"}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800 group-hover:text-[#1a3c5e]">{fullName}</p>
                  <div className="flex gap-1 mt-0.5 flex-wrap">
                    {s.grade && <span className="text-xs text-slate-400">Gr. {s.grade}</span>}
                    {se.length > 0 && <span className="text-xs text-green-600">· Enrolled</span>}
                    {!hasAcademic && !hasPerf && <span className="text-xs text-red-500">· Unassigned</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <StudentDetailModal
          student={selected}
          onClose={() => setSelected(null)}
          onUpdated={() => {
            qc.invalidateQueries({ queryKey: ["admin-students"] });
            qc.invalidateQueries({ queryKey: ["all-coach-assignments"] });
          }}
        />
      )}
    </div>
  );
}
