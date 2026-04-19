import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/api/apiClient";
import { BookOpen, CheckCircle, AlertCircle, Send, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import KPIBar from "@/components/gradebook/KPIBar";
import LessonRow from "@/components/gradebook/LessonRow";
import LessonDetailPanel from "@/components/gradebook/LessonDetailPanel";
import { format } from "date-fns";

const SUBJECTS = ["all", "Math", "English", "Science", "History", "Reading", "Writing", "PE", "General"];
const STATUS_TABS = ["all", "incomplete", "complete"];
const PAGE_TABS = ["lessons", "assignments"];

export default function StudentProgress() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [subject, setSubject] = useState("all");
  const [statusTab, setStatusTab] = useState("all");
  const [selected, setSelected] = useState(null);
  const [pageTab, setPageTab] = useState("lessons");
  const [submitContent, setSubmitContent] = useState({});
  const [submitting, setSubmitting] = useState(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["student-progress", user?.id, subject],
    queryFn: () => {
      const params = new URLSearchParams();
      if (subject !== "all") params.set("subject", subject);
      const qs = params.toString();
      return apiGet(`/gradebook/lessons${qs ? "?" + qs : ""}`);
    },
    enabled: !!user,
  });

  const { data: submissionsData, refetch: refetchSubmissions } = useQuery({
    queryKey: ["my-submissions", user?.id],
    queryFn: () => apiGet("/assignments/my-submissions"),
    enabled: !!user && pageTab === "assignments",
  });

  const allLessons = data?.lessons || [];
  const kpis = data?.kpis;
  const filtered = allLessons.filter(l => statusTab === "all" || l.status === statusTab);
  const mySubmissions = submissionsData?.submissions || [];

  const submitWork = async (assignmentId) => {
    const content = submitContent[assignmentId];
    if (!content?.trim()) return;
    setSubmitting(assignmentId);
    try {
      await apiPost(`/assignments/${assignmentId}/submit`, { content: content.trim() });
      setSubmitContent(c => ({ ...c, [assignmentId]: "" }));
      refetchSubmissions();
    } catch (err) {
      console.error("Submit failed:", err);
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <p className="text-sm text-slate-500 mb-1">Student Portal</p>
        <h1 className="text-3xl font-bold text-[#1a3c5e]">My Progress & Lessons</h1>
        <p className="text-sm text-slate-400 mt-1">View all assigned lessons and mark them complete.</p>
      </div>

      <div className="flex gap-1 border-b border-slate-200 pb-0">
        {PAGE_TABS.map(t => (
          <button key={t} onClick={() => setPageTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${pageTab === t ? "border-[#1a3c5e] text-[#1a3c5e]" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            {t === "lessons" ? "Lessons" : "Assignment Submissions"}
          </button>
        ))}
      </div>

      {pageTab === "lessons" && (
        <>
          {kpis && <KPIBar kpis={kpis} />}

          {kpis?.intervention && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              You have overdue or incomplete lessons. Please reach out to your academic coach.
            </div>
          )}

          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex gap-1 flex-wrap">
              {SUBJECTS.map(s => (
                <button key={s} onClick={() => setSubject(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${subject === s ? "bg-[#1a3c5e] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                  {s}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              {STATUS_TABS.map(s => (
                <button key={s} onClick={() => setStatusTab(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${statusTab === s ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-slate-700">
                <BookOpen className="w-4 h-4 text-blue-500" /> Lessons ({filtered.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex justify-center py-10">
                  <div className="w-5 h-5 border-4 border-slate-200 border-t-[#1a3c5e] rounded-full animate-spin" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-10 text-center">
                  <CheckCircle className="w-10 h-10 text-green-300 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm">No lessons in this filter.</p>
                </div>
              ) : (
                filtered.map(l => <LessonRow key={l.id} lesson={l} onClick={() => setSelected(l)} />)
              )}
            </CardContent>
          </Card>

          {selected && (
            <LessonDetailPanel
              lesson={selected}
              readOnly={false}
              onClose={() => setSelected(null)}
              onUpdated={() => { refetch(); qc.invalidateQueries({ queryKey: ["student-lessons"] }); setSelected(null); }}
            />
          )}
        </>
      )}

      {pageTab === "assignments" && (
        <div className="space-y-4">
          {mySubmissions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Send className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-400">No assignment submissions yet.</p>
                <p className="text-xs text-slate-300 mt-1">Your coach will assign work you can submit here.</p>
              </CardContent>
            </Card>
          ) : (
            mySubmissions.map(sub => (
              <Card key={sub.id} className="border border-slate-100">
                <CardContent className="py-4 px-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800">{sub.assignment_title}</p>
                      {sub.assignment_description && <p className="text-xs text-slate-500 mt-0.5">{sub.assignment_description}</p>}
                      {sub.due_date && <p className="text-xs text-slate-400 mt-1">Due: {format(new Date(sub.due_date), "MMM d, yyyy")}</p>}
                      {sub.submission_content && (
                        <div className="mt-3 bg-slate-50 rounded-lg px-3 py-2">
                          <p className="text-xs font-medium text-slate-500 mb-1">Your submission:</p>
                          <p className="text-sm text-slate-700 whitespace-pre-wrap">{sub.submission_content}</p>
                          {sub.submitted_at && <p className="text-xs text-slate-400 mt-1">Submitted {format(new Date(sub.submitted_at), "MMM d, yyyy 'at' h:mm a")}</p>}
                        </div>
                      )}
                      {sub.score != null && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-xs bg-green-50 border border-green-200 text-green-700 px-2 py-0.5 rounded-full font-medium">
                            Score: {sub.score}{sub.max_score ? `/${sub.max_score}` : ""}
                          </span>
                          {sub.feedback && <span className="text-xs text-slate-500">{sub.feedback}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                  {!sub.submission_content && (
                    <div className="mt-3 space-y-2">
                      <textarea
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30 min-h-[70px] resize-none"
                        placeholder="Type your submission here..."
                        value={submitContent[sub.assignment_id] || ""}
                        onChange={e => setSubmitContent(c => ({ ...c, [sub.assignment_id]: e.target.value }))}
                      />
                      <Button size="sm" className="bg-[#1a3c5e] hover:bg-[#0d2540]"
                        disabled={!submitContent[sub.assignment_id]?.trim() || submitting === sub.assignment_id}
                        onClick={() => submitWork(sub.assignment_id)}>
                        {submitting === sub.assignment_id ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
                        Submit
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
