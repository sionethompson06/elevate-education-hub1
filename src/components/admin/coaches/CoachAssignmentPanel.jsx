import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus, UserMinus, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiGet, apiPost, apiPatch } from "@/api/apiClient";

const COACH_TYPE_LABEL = {
  academic_coach: "Academic",
  performance_coach: "Performance",
};

function formatDate(str) {
  if (!str) return "";
  return new Date(str + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function CoachAssignmentPanel({ coach }) {
  const qc = useQueryClient();
  const [showPicker, setShowPicker] = useState(false);
  const [search, setSearch] = useState("");
  const [assigning, setAssigning] = useState(null);
  const [unassigning, setUnassigning] = useState(null);
  const [error, setError] = useState("");

  const { data: assignedData, isLoading } = useQuery({
    queryKey: ["coach-students", coach.id],
    queryFn: () => apiGet(`/coaches/${coach.id}/students`),
  });

  const { data: allStudentsData } = useQuery({
    queryKey: ["admin-students-all"],
    queryFn: () => apiGet("/students"),
    enabled: showPicker,
  });

  const { data: enrollData } = useQuery({
    queryKey: ["admin-enrollments-all"],
    queryFn: () => apiGet("/enrollments"),
    enabled: showPicker,
  });

  const enrolledPrograms = useMemo(() => {
    const ACTIVE = new Set(["active", "active_override"]);
    const map = {};
    for (const e of enrollData?.enrollments || []) {
      if (!ACTIVE.has(e.status)) continue;
      if (!map[e.studentId]) map[e.studentId] = [];
      if (e.programName && !map[e.studentId].includes(e.programName)) {
        map[e.studentId].push(e.programName);
      }
    }
    return map;
  }, [enrollData]);

  const assignedStudents = assignedData?.students || [];
  const allStudents = allStudentsData?.students || [];

  const assignedIds = new Set(assignedStudents.map(s => s.studentId));
  const filtered = allStudents.filter(s =>
    !assignedIds.has(s.id) &&
    (`${s.firstName} ${s.lastName}`).toLowerCase().includes(search.toLowerCase())
  );

  const handleAssign = async (student) => {
    setAssigning(student.id);
    setError("");
    try {
      await apiPost("/coach-assignments", {
        coachUserId: coach.id,
        studentId: student.id,
        coachType: coach.role,
        startDate: new Date().toISOString().split("T")[0],
      });
      qc.invalidateQueries({ queryKey: ["coach-students", coach.id] });
      qc.invalidateQueries({ queryKey: ["admin-coaches"] });
    } catch (err) {
      setError(err.message || "Failed to assign student.");
    } finally {
      setAssigning(null);
    }
  };

  const handleUnassign = async (assignmentId) => {
    setUnassigning(assignmentId);
    setError("");
    try {
      await apiPatch(`/coach-assignments/${assignmentId}`, { isActive: false });
      qc.invalidateQueries({ queryKey: ["coach-students", coach.id] });
      qc.invalidateQueries({ queryKey: ["admin-coaches"] });
    } catch (err) {
      setError(err.message || "Failed to unassign student.");
    } finally {
      setUnassigning(null);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12 text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700">{assignedStudents.length} Student{assignedStudents.length !== 1 ? "s" : ""} Assigned</p>
        <Button
          size="sm"
          variant="outline"
          className="border-[#1a3c5e] text-[#1a3c5e] hover:bg-[#1a3c5e]/5"
          onClick={() => setShowPicker(v => !v)}
        >
          <UserPlus className="w-4 h-4 mr-1.5" />
          Assign Student
        </Button>
      </div>

      {showPicker && (
        <div className="border border-slate-200 rounded-xl bg-slate-50 p-3 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30 bg-white"
              placeholder="Search students…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="max-h-52 overflow-y-auto space-y-1">
            {filtered.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-4">No students found</p>
            )}
            {filtered.map(student => (
              <div key={student.id} className="flex items-center justify-between bg-white border border-slate-100 rounded-lg px-3 py-2">
                <div className="min-w-0 flex-1 mr-2">
                  <p className="text-sm font-medium text-slate-800">{student.firstName} {student.lastName}</p>
                  <p className="text-xs text-slate-400">{student.grade || "—"}</p>
                  {(enrolledPrograms[student.id] || []).length > 0 ? (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {enrolledPrograms[student.id].map(prog => (
                        <span key={prog} className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                          {prog}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[10px] text-slate-300 italic">Not enrolled</span>
                  )}
                </div>
                <Button
                  size="sm"
                  className="bg-[#1a3c5e] hover:bg-[#0d2540] text-white text-xs h-7 px-3"
                  disabled={assigning === student.id}
                  onClick={() => handleAssign(student)}
                >
                  {assigning === student.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Assign"}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {assignedStudents.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-sm">No students assigned yet.</div>
      ) : (
        <div className="space-y-2">
          {assignedStudents.map(s => (
            <div key={s.assignmentId} className="flex items-center justify-between border border-slate-100 rounded-xl px-4 py-3 bg-white">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800">{s.firstName} {s.lastName}</p>
                <p className="text-xs text-slate-400">
                  {[s.grade ? `Grade: ${s.grade}` : null, s.startDate ? `Since ${formatDate(s.startDate)}` : null].filter(Boolean).join(" · ")}
                </p>
                {(s.programs || []).length > 0 ? (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {s.programs.map(prog => (
                      <span key={prog} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                        {prog}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-[10px] text-slate-300 italic">No active enrollments</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  s.coachType === "academic_coach" ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"
                }`}>
                  {COACH_TYPE_LABEL[s.coachType] || s.coachType}
                </span>
                <button
                  onClick={() => handleUnassign(s.assignmentId)}
                  disabled={unassigning === s.assignmentId}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                  title="Unassign student"
                >
                  {unassigning === s.assignmentId
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <UserMinus className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
