import { useAuth } from "@/lib/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/api/apiClient";
import { TrendingUp, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";

const VISIBILITY_LABELS = {
  student_visible: "Student",
  parent_visible: "Parent",
  staff_only: "Staff",
};

export default function Progress() {
  const { user } = useAuth();

  const { data: student } = useQuery({
    queryKey: ["my-student", user?.id],
    queryFn: () => apiGet(`/students/by-user/${user.id}`).then(r => r.student),
    enabled: !!user?.id && (user?.role === "student" || user?.role === "parent"),
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ["coach-assignments-progress", user?.id],
    queryFn: () => apiGet("/gradebook/coach-assignments"),
    enabled: !!user && (user?.role === "academic_coach" || user?.role === "performance_coach"),
  });

  const studentIds = user?.role === "academic_coach" || user?.role === "performance_coach"
    ? [...new Set(assignments.map(a => a.student_id))]
    : student?.id ? [student.id] : [];

  const { data: allNotes = [], isLoading } = useQuery({
    queryKey: ["progress-notes", user?.id, studentIds],
    queryFn: async () => {
      if (!studentIds.length) return [];
      const results = await Promise.all(
        studentIds.map(sid =>
          apiGet(`/coach-notes/student/${sid}`).then(r =>
            (r.notes || []).map(n => ({ ...n, forStudentId: sid }))
          )
        )
      );
      return results.flat().sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    },
    enabled: studentIds.length > 0,
  });

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <p className="text-sm text-slate-500 mb-1">My Progress</p>
        <h1 className="text-3xl font-bold text-[#1a3c5e]">Progress Notes</h1>
        <p className="text-sm text-slate-400 mt-1">Coach observations and progress updates.</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-4 border-slate-200 border-t-[#1a3c5e] rounded-full animate-spin" />
        </div>
      ) : allNotes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <TrendingUp className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400">No progress notes yet.</p>
            <p className="text-xs text-slate-300 mt-1">Notes will appear here as your coaches log updates.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {allNotes.map(note => (
            <Card key={note.id} className="border border-slate-100">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-semibold text-slate-700">
                      {note.coachFirstName ? `${note.coachFirstName} ${note.coachLastName || ""}`.trim() : "Coach Note"}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">
                    {note.createdAt ? format(new Date(note.createdAt), "MMM d, yyyy") : ""}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{note.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
