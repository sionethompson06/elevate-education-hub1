import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { apiGet, apiPatch } from "@/api/apiClient";
import { Users, CalendarDays, BookOpen, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

function formatSession(session) {
  if (!session?.sessionDate) return "No upcoming session";
  const date = new Date(`${session.sessionDate}T00:00:00`);
  const start = session.startAt ? new Date(session.startAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "TBD";
  return `${date.toLocaleDateString()} · ${start}`;
}

export default function AcademicCoachClasses() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [reviewDrafts, setReviewDrafts] = useState({});
  const [reviewingId, setReviewingId] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["coach-my-classes"],
    queryFn: () => apiGet("/sections/coach/my-classes"),
  });
  const classes = data?.classes || [];

  const { data: classData, isLoading: detailLoading } = useQuery({
    queryKey: ["coach-class-detail", selectedClassId],
    queryFn: () => apiGet(`/sections/coach/my-classes/${selectedClassId}`),
    enabled: !!selectedClassId,
  });
  const { data: queueData } = useQuery({
    queryKey: ["coach-class-review-queue", selectedClassId],
    queryFn: () => apiGet(`/assignments/section/${selectedClassId}/review-queue`),
    enabled: !!selectedClassId,
  });
  const { data: gradebookData } = useQuery({
    queryKey: ["coach-class-gradebook", selectedClassId],
    queryFn: () => apiGet(`/assignments/section/${selectedClassId}/gradebook`),
    enabled: !!selectedClassId,
  });

  const roster = classData?.roster || [];
  const sessions = classData?.sessions || [];
  const assignments = classData?.assignments || [];
  const progress = classData?.assignmentProgress || { assigned: 0, in_progress: 0, submitted: 0, reviewed: 0 };
  const reviewQueue = queueData?.queue || [];
  const gradebookRows = gradebookData?.students || [];

  const submitReview = async (submissionId) => {
    const draft = reviewDrafts[submissionId] || {};
    if (draft.score === undefined && !draft.feedback?.trim()) return;
    setReviewingId(submissionId);
    try {
      await apiPatch(`/assignments/submissions/${submissionId}/review`, {
        score: draft.score === "" ? null : Number(draft.score),
        feedback: draft.feedback || "",
      });
      setReviewDrafts((prev) => ({ ...prev, [submissionId]: { score: "", feedback: "" } }));
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["coach-class-review-queue", selectedClassId] }),
        qc.invalidateQueries({ queryKey: ["coach-class-gradebook", selectedClassId] }),
        qc.invalidateQueries({ queryKey: ["coach-class-detail", selectedClassId] }),
      ]);
      toast({ title: "Submission reviewed" });
    } catch (err) {
      toast({ title: "Review failed", description: err.message, variant: "destructive" });
    } finally {
      setReviewingId(null);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <p className="text-sm text-slate-500 mb-1">Academic Coach</p>
        <h1 className="text-3xl font-bold text-[#1a3c5e]">My Classes</h1>
        <p className="text-sm text-slate-400 mt-1">View assigned classes, roster, weekly sessions, and assignment progress.</p>
      </div>

      <div className="grid lg:grid-cols-[1.15fr_1fr] gap-5">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-slate-700 flex items-center gap-2">
              <CalendarDays className="w-4 h-4" /> Assigned Classes ({classes.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-12"><div className="w-6 h-6 border-4 border-slate-200 border-t-[#1a3c5e] rounded-full animate-spin" /></div>
            ) : classes.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-12">No classes assigned yet.</p>
            ) : (
              <div className="divide-y">
                {classes.map((cls) => (
                  <button
                    key={cls.id}
                    onClick={() => setSelectedClassId(cls.id)}
                    className={`w-full text-left px-5 py-4 hover:bg-slate-50 transition-colors ${selectedClassId === cls.id ? "bg-slate-50" : "bg-white"}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 truncate">{cls.name}</p>
                        <p className="text-xs text-slate-500">{cls.programName}</p>
                        <div className="flex flex-wrap gap-2 text-xs text-slate-400 mt-1">
                          <span>{cls.myStudentCount} of your students</span>
                          <span>•</span>
                          <span>{cls.rosterCount}/{cls.capacity} rostered</span>
                          <span>•</span>
                          <span>{formatSession(cls.nextSession)}</span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-slate-700 flex items-center gap-2">
              <Users className="w-4 h-4" /> Class Workspace
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedClassId ? (
              <p className="text-sm text-slate-400 py-8 text-center">Select a class to view roster, sessions, and gradebook progress.</p>
            ) : detailLoading ? (
              <div className="flex justify-center py-12"><div className="w-6 h-6 border-4 border-slate-200 border-t-[#1a3c5e] rounded-full animate-spin" /></div>
            ) : (
              <>
                <div>
                  <h3 className="font-semibold text-slate-800">{classData?.class?.name}</h3>
                  <p className="text-xs text-slate-500">{classData?.class?.programName}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                    <p className="text-slate-500">Assigned</p>
                    <p className="text-sm font-semibold text-slate-800">{progress.assigned}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                    <p className="text-slate-500">In Progress</p>
                    <p className="text-sm font-semibold text-slate-800">{progress.in_progress}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                    <p className="text-slate-500">Submitted</p>
                    <p className="text-sm font-semibold text-slate-800">{progress.submitted}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                    <p className="text-slate-500">Reviewed</p>
                    <p className="text-sm font-semibold text-slate-800">{progress.reviewed}</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-2">Roster ({roster.length})</p>
                  <div className="max-h-44 overflow-y-auto border rounded-lg divide-y">
                    {roster.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-4">No students rostered.</p>
                    ) : roster.map((student) => (
                      <div key={student.studentId} className="px-3 py-2 bg-white">
                        <p className="text-sm font-medium text-slate-800">{student.firstName} {student.lastName}</p>
                        <p className="text-xs text-slate-400">Grade {student.grade || "—"} {student.assignedToMe ? "· Assigned to you" : ""}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-2">Upcoming Sessions</p>
                  <div className="max-h-40 overflow-y-auto border rounded-lg divide-y">
                    {sessions.filter((s) => s.status !== "canceled").slice(0, 8).length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-4">No upcoming sessions.</p>
                    ) : sessions.filter((s) => s.status !== "canceled").slice(0, 8).map((session) => (
                      <div key={session.id} className="px-3 py-2 bg-white">
                        <p className="text-sm text-slate-800">{formatSession(session)}</p>
                        <p className="text-xs text-slate-400">{session.location || classData?.class?.room || "Location TBD"}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button className="flex-1 bg-[#1a3c5e] hover:bg-[#0d2540]" onClick={() => navigate("/academic-coach/dashboard")}>
                    <BookOpen className="w-4 h-4 mr-1.5" /> Open Coach Dashboard
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={() => navigate("/academic-coach/gradebook")}>
                    Gradebook
                  </Button>
                </div>

                <p className="text-[11px] text-slate-400">Assignments tracked in this class: {assignments.length}.</p>

                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-2">Review Queue ({reviewQueue.length})</p>
                  <div className="max-h-64 overflow-y-auto border rounded-lg divide-y">
                    {reviewQueue.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-4">No pending submissions to review.</p>
                    ) : reviewQueue.map((item) => {
                      const draft = reviewDrafts[item.submissionId] || {};
                      return (
                        <div key={item.submissionId} className="px-3 py-3 bg-white space-y-2">
                          <p className="text-sm font-medium text-slate-800">{item.studentFirstName} {item.studentLastName} · {item.assignmentTitle}</p>
                          <p className="text-xs text-slate-500 whitespace-pre-wrap">{item.submissionContent}</p>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              min="0"
                              placeholder="Score"
                              className="w-24 border border-slate-200 rounded-lg px-2 py-1 text-xs"
                              value={draft.score ?? ""}
                              onChange={(e) => setReviewDrafts((prev) => ({
                                ...prev,
                                [item.submissionId]: { ...prev[item.submissionId], score: e.target.value },
                              }))}
                            />
                            <input
                              placeholder="Feedback"
                              className="flex-1 border border-slate-200 rounded-lg px-2 py-1 text-xs"
                              value={draft.feedback ?? ""}
                              onChange={(e) => setReviewDrafts((prev) => ({
                                ...prev,
                                [item.submissionId]: { ...prev[item.submissionId], feedback: e.target.value },
                              }))}
                            />
                            <Button
                              size="sm"
                              disabled={reviewingId === item.submissionId}
                              onClick={() => submitReview(item.submissionId)}
                            >
                              {reviewingId === item.submissionId ? "Saving…" : "Review"}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-2">Gradebook Snapshot</p>
                  <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
                    {gradebookRows.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-4">No gradebook data yet.</p>
                    ) : gradebookRows.map((row) => {
                      const counts = row.work.reduce((acc, item) => {
                        acc[item.workflow_status] = (acc[item.workflow_status] || 0) + 1;
                        return acc;
                      }, {});
                      return (
                        <div key={row.student_id} className="px-3 py-2 bg-white">
                          <p className="text-sm font-medium text-slate-800">{row.first_name} {row.last_name}</p>
                          <p className="text-xs text-slate-500">
                            Assigned {counts.assigned || 0} · In Progress {counts.in_progress || 0} · Submitted {counts.submitted || 0} · Reviewed {counts.reviewed || 0}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
