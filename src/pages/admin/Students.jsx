import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Search, Plus, Users, BookOpen, Activity, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import StudentDetailModal from "@/components/admin/students/StudentDetailModal";

export default function AdminStudents() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);

  const { data: students = [], isLoading } = useQuery({
    queryKey: ["admin-students"],
    queryFn: () => base44.entities.Student.list("-created_date", 200),
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ["all-assignments"],
    queryFn: () => base44.entities.CoachAssignment.filter({ is_active: true }),
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ["all-enrollments-admin"],
    queryFn: () => base44.entities.Enrollment.filter({ status: "active" }),
  });

  const getAssignments = (studentId) => assignments.filter(a => a.student_id === studentId);
  const getEnrollments = (studentId) => enrollments.filter(e => e.student_id === studentId);

  const filtered = students.filter(s =>
    !search || s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.user_email?.toLowerCase().includes(search.toLowerCase()) ||
    s.sport?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm text-slate-500 mb-1">Admin</p>
          <h1 className="text-3xl font-bold text-[#1a3c5e]">Students</h1>
        </div>
      </div>

      {/* Stats */}
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
              <p className="text-2xl font-bold text-slate-800">{assignments.filter(a => a.coach_type === "academic_coach").length}</p>
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
              <p className="text-2xl font-bold text-slate-800">{assignments.filter(a => a.coach_type === "performance_coach").length}</p>
              <p className="text-xs text-slate-500">Performance Coach Assignments</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search by name, email, or sport..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
        />
      </div>

      {/* Student list */}
      {isLoading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-4 border-slate-200 border-t-[#1a3c5e] rounded-full animate-spin" /></div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(s => {
            const sa = getAssignments(s.id);
            const se = getEnrollments(s.id);
            const hasAcademic = sa.some(a => a.coach_type === "academic_coach");
            const hasPerf = sa.some(a => a.coach_type === "performance_coach");
            return (
              <Card
                key={s.id}
                className="cursor-pointer hover:shadow-md hover:border-[#1a3c5e] transition-all"
                onClick={() => setSelected(s)}
              >
                <CardContent className="py-4 px-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 truncate">{s.full_name}</p>
                      <p className="text-xs text-slate-400 mt-0.5 truncate">{s.user_email}</p>
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {s.sport && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">{s.sport}</span>}
                        {s.grade_level && <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">Gr. {s.grade_level}</span>}
                        {se.length > 0 && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Enrolled</span>}
                      </div>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {hasAcademic && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Academic Coach</span>}
                        {hasPerf && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">Perf. Coach</span>}
                        {!hasAcademic && !hasPerf && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Unassigned</span>}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 mt-1" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {selected && (
        <StudentDetailModal
          student={selected}
          onClose={() => setSelected(null)}
          onUpdated={() => { qc.invalidateQueries({ queryKey: ["admin-students"] }); qc.invalidateQueries({ queryKey: ["all-assignments"] }); }}
        />
      )}
    </div>
  );
}