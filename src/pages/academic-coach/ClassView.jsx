import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/api/apiClient";
import { BookOpen, Users, ClipboardList, BarChart2, Plus, X, Loader2, ChevronDown, ChevronRight, CheckCircle, AlertCircle, Clock, MinusCircle, CalendarDays, MapPin, BookMarked } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

const CATEGORIES = ["general", "homework", "quiz", "test", "project", "classwork"];

// ── Create Assignment Modal ──────────────────────────────────────────────────
function CreateAssignmentModal({ sectionId, onClose, onCreated }) {
  const [form, setForm] = useState({ title: "", description: "", maxScore: "100", dueDate: "", category: "general" });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const save = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await apiPost("/assignments", {
        sectionId,
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        maxScore: form.maxScore ? parseInt(form.maxScore) : 100,
        dueDate: form.dueDate || undefined,
        category: form.category,
      });
      toast({ title: "Assignment created" });
      onCreated();
      onClose();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-[#1a3c5e] text-lg">New Assignment</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100"><X className="w-4 h-4 text-slate-500" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
            <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Assignment title…" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea rows={3} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
              value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Instructions…" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Max Score</label>
              <input type="number" min="0"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                value={form.maxScore} onChange={e => setForm(f => ({ ...f, maxScore: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
              <input type="date"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
              <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none capitalize"
                value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={save} disabled={saving || !form.title.trim()}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
            Create Assignment
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Gradebook grid ───────────────────────────────────────────────────────────
function GradebookTab({ sectionId }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(null); // { studentId, assignmentId, subId }
  const [scoreInput, setScoreInput] = useState("");
  const [saving, setSaving] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["section-gradebook", sectionId],
    queryFn: () => apiGet(`/sections/${sectionId}/gradebook`),
    enabled: !!sectionId,
  });

  const assignments = data?.assignments || [];
  const rows = data?.rows || [];

  const startEdit = (studentId, assignmentId, sub) => {
    setEditing({ studentId, assignmentId, subId: sub?.id ?? null });
    setScoreInput(sub?.score != null ? String(sub.score) : "");
  };

  const cancelEdit = () => { setEditing(null); setScoreInput(""); };

  const saveScore = async (assignment) => {
    if (!editing) return;
    setSaving(true);
    try {
      const score = scoreInput !== "" ? parseInt(scoreInput) : null;
      if (editing.subId) {
        await apiPatch(`/assignments/submissions/${editing.subId}`, { score });
      } else {
        await apiPost(`/assignments/${editing.assignmentId}/grade`, {
          studentId: editing.studentId,
          score,
        });
      }
      refetch();
      cancelEdit();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  if (assignments.length === 0) return (
    <div className="text-center py-12 text-slate-400 text-sm">No assignments yet. Create one in the Assignments tab.</div>
  );
  if (rows.length === 0) return (
    <div className="text-center py-12 text-slate-400 text-sm">No students on roster yet.</div>
  );

  const scoreColor = (score, max) => {
    if (score == null) return "text-slate-400";
    const pct = (score / max) * 100;
    if (pct >= 90) return "text-green-700 font-semibold";
    if (pct >= 70) return "text-amber-700 font-semibold";
    return "text-red-700 font-semibold";
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-xs border-collapse">
        <thead>
          <tr className="bg-slate-50 border-b">
            <th className="text-left px-3 py-2 font-semibold text-slate-600 sticky left-0 bg-slate-50 z-10 min-w-[140px]">Student</th>
            {assignments.map(a => (
              <th key={a.id} className="px-2 py-2 text-center font-semibold text-slate-600 max-w-[100px] min-w-[80px]">
                <div className="truncate" title={a.title}>{a.title}</div>
                <div className="text-slate-400 font-normal capitalize">{a.category} · /{a.maxScore}</div>
                {a.dueDate && <div className="text-slate-400 font-normal">{a.dueDate}</div>}
              </th>
            ))}
            <th className="px-3 py-2 text-center font-semibold text-slate-600 min-w-[80px]">Avg</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map(row => {
            const gradedScores = row.scores
              .map((s, i) => s?.score != null ? { score: s.score, max: assignments[i].maxScore } : null)
              .filter(Boolean);
            const avg = gradedScores.length
              ? Math.round(gradedScores.reduce((acc, s) => acc + (s.score / s.max) * 100, 0) / gradedScores.length)
              : null;

            return (
              <tr key={row.studentId} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-medium text-slate-800 sticky left-0 bg-white hover:bg-slate-50 z-10">
                  {row.firstName} {row.lastName}
                  {row.grade && <span className="text-slate-400 font-normal ml-1">Gr. {row.grade}</span>}
                </td>
                {row.scores.map((sub, idx) => {
                  const a = assignments[idx];
                  const isEdit = editing?.studentId === row.studentId && editing?.assignmentId === a.id;
                  return (
                    <td key={a.id} className="px-2 py-1.5 text-center">
                      {isEdit ? (
                        <div className="flex items-center gap-1 justify-center">
                          <input
                            type="number" min="0" max={a.maxScore}
                            className="w-14 border border-emerald-400 rounded px-1.5 py-1 text-xs text-center focus:outline-none"
                            value={scoreInput}
                            onChange={e => setScoreInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') saveScore(a); if (e.key === 'Escape') cancelEdit(); }}
                            autoFocus
                          />
                          <button onClick={() => saveScore(a)} disabled={saving}
                            className="text-emerald-600 hover:text-emerald-800">
                            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                          </button>
                          <button onClick={cancelEdit} className="text-slate-400 hover:text-slate-600">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(row.studentId, a.id, sub)}
                          className={`w-full rounded px-1 py-0.5 hover:bg-emerald-50 transition-colors ${scoreColor(sub?.score, a.maxScore)}`}>
                          {sub?.score != null ? `${sub.score}/${a.maxScore}` : sub?.isMissing ? <span className="text-red-500">M</span> : <span className="text-slate-300">—</span>}
                        </button>
                      )}
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-center font-semibold">
                  {avg != null ? (
                    <span className={avg >= 90 ? "text-green-700" : avg >= 70 ? "text-amber-700" : "text-red-700"}>
                      {avg}%
                    </span>
                  ) : <span className="text-slate-300">—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Assignments list ─────────────────────────────────────────────────────────
function AssignmentsTab({ sectionId, onAssignmentChange }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["section-assignments", sectionId],
    queryFn: () => apiGet(`/assignments/section/${sectionId}`),
    enabled: !!sectionId,
  });
  const assignments = data?.assignments || [];

  const { data: submissionsData } = useQuery({
    queryKey: ["assignment-submissions", expanded],
    queryFn: () => apiGet(`/assignments/${expanded}/submissions`),
    enabled: !!expanded,
  });
  const submissions = submissionsData?.submissions || [];

  const deleteAssignment = async (id) => {
    try {
      await apiDelete(`/assignments/${id}`);
      refetch();
      onAssignmentChange();
      if (expanded === id) setExpanded(null);
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const setMissing = async (assignmentId, studentId, subId, isMissing) => {
    try {
      if (subId) {
        await apiPatch(`/assignments/submissions/${subId}`, { isMissing });
      } else {
        await apiPost(`/assignments/${assignmentId}/grade`, { studentId, isMissing, score: null });
      }
      qc.invalidateQueries({ queryKey: ["assignment-submissions", expanded] });
      qc.invalidateQueries({ queryKey: ["section-gradebook", sectionId] });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowCreate(true)} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="w-4 h-4 mr-1.5" /> New Assignment
        </Button>
      </div>

      {assignments.length === 0 ? (
        <div className="text-center py-10 text-slate-400 text-sm">No assignments yet. Create one to get started.</div>
      ) : (
        <div className="divide-y border rounded-xl overflow-hidden">
          {assignments.map(a => (
            <div key={a.id} className="bg-white">
              <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50"
                onClick={() => setExpanded(expanded === a.id ? null : a.id)}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-slate-800 text-sm">{a.title}</p>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 capitalize">{a.category}</span>
                    <span className="text-xs text-slate-400">/{a.maxScore} pts</span>
                  </div>
                  {a.dueDate && <p className="text-xs text-slate-400 mt-0.5">Due: {a.dueDate}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                  <button onClick={() => deleteAssignment(a.id)}
                    className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 text-xs px-2">
                    Delete
                  </button>
                </div>
                {expanded === a.id ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
              </div>

              {expanded === a.id && (
                <div className="px-4 pb-4 border-t bg-slate-50">
                  {a.description && <p className="text-xs text-slate-600 py-2">{a.description}</p>}
                  <p className="text-xs font-semibold text-slate-500 mt-2 mb-1">Submissions ({submissions.length})</p>
                  {submissions.length === 0 ? (
                    <p className="text-xs text-slate-400">No submissions yet.</p>
                  ) : (
                    <div className="space-y-1">
                      {submissions.map(sub => (
                        <div key={sub.id} className="flex items-center justify-between bg-white rounded px-3 py-2 text-xs border">
                          <span className="font-medium">{sub.studentFirstName} {sub.studentLastName}</span>
                          <div className="flex items-center gap-3">
                            {sub.score != null && (
                              <span className="text-emerald-700 font-semibold">{sub.score}/{a.maxScore}</span>
                            )}
                            {sub.isMissing && <span className="text-red-600 font-semibold">Missing</span>}
                            <button
                              onClick={() => setMissing(a.id, sub.studentId, sub.id, !sub.isMissing)}
                              className="text-slate-400 hover:text-slate-700 underline">
                              {sub.isMissing ? "Unmark missing" : "Mark missing"}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateAssignmentModal
          sectionId={sectionId}
          onClose={() => setShowCreate(false)}
          onCreated={() => { refetch(); onAssignmentChange(); }}
        />
      )}
    </div>
  );
}

// ── Roster tab ───────────────────────────────────────────────────────────────
const PLACEMENT_STATUS_CLS = {
  active:  "bg-emerald-100 text-emerald-700",
  dropped: "bg-red-100 text-red-700",
  paused:  "bg-amber-100 text-amber-700",
};

function RosterTab({ sectionId }) {
  const { data, isLoading } = useQuery({
    queryKey: ["section-detail", sectionId],
    queryFn: () => apiGet(`/sections/${sectionId}`),
    enabled: !!sectionId,
  });

  // Only show active (or no-status-set) placements — filter out dropped/removed
  const allStudents = data?.students || [];
  const students = allStudents.filter(s => !s.placementStatus || s.placementStatus === "active");

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  return (
    <div>
      {students.length === 0 ? (
        <div className="text-center py-10 text-slate-400 text-sm">No students on roster yet. Ask your admin to add students to this class.</div>
      ) : (
        <div className="divide-y border rounded-xl overflow-hidden">
          {students.map(s => (
            <div key={s.id} className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-slate-50">
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-semibold text-sm shrink-0">
                {s.firstName?.[0]}{s.lastName?.[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800">{s.firstName} {s.lastName}</p>
                <div className="flex items-center gap-2 flex-wrap mt-0.5">
                  {s.grade && <span className="text-xs text-slate-400">Grade {s.grade}</span>}
                  {s.guardianName && (
                    <span className="text-xs text-slate-400">· Parent: {s.guardianName}</span>
                  )}
                </div>
              </div>
              {s.placementStatus && s.placementStatus !== "active" && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize shrink-0 ${PLACEMENT_STATUS_CLS[s.placementStatus] || "bg-slate-100 text-slate-500"}`}>
                  {s.placementStatus}
                </span>
              )}
            </div>
          ))}
          <div className="px-4 py-2 bg-slate-50 text-xs text-slate-500">
            {students.length} student{students.length !== 1 ? "s" : ""} enrolled
          </div>
        </div>
      )}
    </div>
  );
}

// ── Assign Lesson modal ───────────────────────────────────────────────────────
function AssignLessonModal({ sectionId, sectionName, onClose, onAssigned }) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [dueAt, setDueAt] = useState("");
  const [assigning, setAssigning] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["saved-lessons"],
    queryFn: () => apiGet("/saved-lessons"),
  });
  const lessons = data?.lessons || [];
  const filtered = lessons.filter(l =>
    !search ||
    l.title.toLowerCase().includes(search.toLowerCase()) ||
    (l.subject || "").toLowerCase().includes(search.toLowerCase())
  );

  const handleAssign = async () => {
    if (!selectedId) return;
    setAssigning(true);
    try {
      const result = await apiPost(`/sections/${sectionId}/assign-lesson`, {
        savedLessonPlanId: selectedId,
        dueAt: dueAt || undefined,
      });
      toast({ title: `Lesson assigned to ${result.count} student${result.count !== 1 ? "s" : ""}` });
      onAssigned();
      onClose();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col" style={{ maxHeight: "85vh" }}>
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b flex items-start justify-between gap-3 shrink-0">
          <div>
            <h3 className="font-bold text-[#1a3c5e] text-lg">Assign Lesson</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Assigns to all active students in <span className="font-medium">{sectionName}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 shrink-0">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b shrink-0">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search lessons by title or subject…"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          />
        </div>

        {/* Lesson list */}
        <div className="flex-1 overflow-y-auto px-6 py-3 space-y-1.5 min-h-0">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              <BookMarked className="w-8 h-8 mx-auto mb-2 text-slate-200" />
              {lessons.length === 0
                ? "No saved lessons yet. Create lessons in the Lesson Library first."
                : "No lessons match your search."}
            </div>
          ) : filtered.map(l => (
            <button
              key={l.id}
              onClick={() => setSelectedId(l.id === selectedId ? null : l.id)}
              className={`w-full text-left rounded-xl border px-4 py-3 transition-all ${
                selectedId === l.id
                  ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500"
                  : "border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/50"
              }`}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-slate-800 leading-snug">{l.title}</p>
                {selectedId === l.id && <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />}
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs text-slate-400 flex-wrap">
                {l.subject && <span>{l.subject}</span>}
                {l.grade && <span>· Grade {l.grade}</span>}
                {l.standardCode && <span>· {l.standardCode}</span>}
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-slate-50 rounded-b-2xl space-y-3 shrink-0">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-slate-600 shrink-0">
              Due date <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              type="date"
              value={dueAt}
              onChange={e => setDueAt(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button
              onClick={handleAssign}
              disabled={!selectedId || assigning}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700">
              {assigning
                ? <><Loader2 className="w-4 h-4 animate-spin mr-1.5" />Assigning…</>
                : <><BookMarked className="w-4 h-4 mr-1.5" />Assign to Class</>}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sessions tab (read-only) ─────────────────────────────────────────────────
const SESSION_STATUS_CLS = {
  scheduled: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  canceled: "bg-red-100 text-red-600",
};

function fmtDate(d) {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function fmtTime(t) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function SessionsTab({ sectionId }) {
  const { data, isLoading } = useQuery({
    queryKey: ["section-sessions", sectionId],
    queryFn: () => apiGet(`/sections/${sectionId}/sessions`),
    enabled: !!sectionId,
  });
  const sessions = data?.sessions || [];
  const today = new Date().toISOString().split("T")[0];
  const upcoming = sessions.filter(s => s.sessionDate >= today && s.status !== "canceled");
  const past = sessions.filter(s => s.sessionDate < today || s.status === "canceled");

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  if (sessions.length === 0) return (
    <div className="text-center py-12">
      <CalendarDays className="w-8 h-8 text-slate-200 mx-auto mb-2" />
      <p className="text-sm text-slate-400">No sessions scheduled yet.</p>
    </div>
  );

  const SessionRow = ({ s }) => (
    <div className={`rounded-xl border px-3 py-2.5 ${
      s.status === "canceled"  ? "bg-red-50 border-red-100" :
      s.status === "completed" ? "bg-green-50 border-green-100" :
      "bg-white border-slate-200"
    }`}>
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-slate-800">{fmtDate(s.sessionDate)}</p>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${SESSION_STATUS_CLS[s.status] || "bg-slate-100 text-slate-500"}`}>
              {s.status}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500 flex-wrap">
            {(s.startAt || s.endAt) && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {fmtTime(s.startAt)}{s.endAt ? ` – ${fmtTime(s.endAt)}` : ""}
              </span>
            )}
            {s.locationSnapshot && (
              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{s.locationSnapshot}</span>
            )}
          </div>
          {s.canceledReason && <p className="text-xs text-red-600 mt-1">Reason: {s.canceledReason}</p>}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {upcoming.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Upcoming</p>
          <div className="space-y-2">{upcoming.map(s => <SessionRow key={s.id} s={s} />)}</div>
        </div>
      )}
      {past.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Past</p>
          <div className="space-y-2">{past.map(s => <SessionRow key={s.id} s={s} />)}</div>
        </div>
      )}
    </div>
  );
}

// ── Main ClassView page ──────────────────────────────────────────────────────
export default function ClassView() {
  const { user } = useAuth();
  const [selectedSectionId, setSelectedSectionId] = useState(null);
  const [tab, setTab] = useState("roster");
  const [showAssignLesson, setShowAssignLesson] = useState(false);
  const qc = useQueryClient();

  const { data: sectionsData, isLoading: loadingSections } = useQuery({
    queryKey: ["coach-my-sections"],
    queryFn: () => apiGet("/sections/my-sections"),
  });
  const sections = sectionsData?.sections || [];

  const selectedSection = sections.find(s => s.id === selectedSectionId) || null;

  const handleAssignmentChange = () => {
    qc.invalidateQueries({ queryKey: ["section-gradebook", selectedSectionId] });
  };

  const TABS = [
    { id: "roster", label: "Roster", icon: Users },
    { id: "sessions", label: "Sessions", icon: CalendarDays },
    { id: "assignments", label: "Assignments", icon: ClipboardList },
    { id: "gradebook", label: "Gradebook", icon: BarChart2 },
  ];

  const scheduleText = (s) => {
    if (!s?.schedule) return null;
    if (typeof s.schedule === "string") return s.schedule;
    return s.schedule?.text || null;
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <div className="inline-block px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold mb-2">Academic Coach</div>
        <h1 className="text-3xl font-bold text-[#1a3c5e] flex items-center gap-3">
          <BookOpen className="w-8 h-8" /> My Classes
        </h1>
        <p className="text-slate-500 mt-1">Manage your class rosters, assignments, and gradebook.</p>
      </div>

      <div className="flex gap-6">
        {/* Section list sidebar */}
        <div className="w-64 shrink-0">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Classes</p>
          {loadingSections ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
          ) : sections.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              <BookOpen className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              No classes assigned yet.
            </div>
          ) : (
            <div className="space-y-1.5">
              {sections.map(s => {
                const active = selectedSectionId === s.id;
                const muted = active ? "text-emerald-100" : "text-slate-400";
                return (
                  <button
                    key={s.id}
                    onClick={() => { setSelectedSectionId(s.id); setTab("roster"); }}
                    className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all text-sm ${
                      active
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                        : "bg-white border-slate-200 text-slate-700 hover:border-emerald-300 hover:bg-emerald-50"
                    }`}>
                    {/* Title + draft badge */}
                    <div className="flex items-start justify-between gap-1">
                      <p className="font-semibold truncate leading-snug">{s.name}</p>
                      {!s.isPublished && (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 mt-0.5 ${active ? "bg-white/20 text-white" : "bg-amber-100 text-amber-700"}`}>
                          Draft
                        </span>
                      )}
                    </div>
                    {/* Program */}
                    <p className={`text-xs mt-0.5 truncate ${muted}`}>{s.programName}</p>
                    {/* Subject · Grade */}
                    {(s.subject || s.gradeLevel) && (
                      <p className={`text-xs truncate ${muted}`}>
                        {[s.subject, s.gradeLevel].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    {/* Roster count */}
                    <p className={`text-xs mt-1 ${muted}`}>
                      {s.rosterCount ?? 0} student{s.rosterCount !== 1 ? "s" : ""}
                    </p>
                    {/* Next session */}
                    {s.nextSession ? (
                      <p className={`text-xs mt-0.5 truncate ${muted}`}>
                        Next: {fmtDate(s.nextSession.sessionDate)}{s.nextSession.startAt ? ` · ${fmtTime(s.nextSession.startAt)}` : ""}
                      </p>
                    ) : scheduleText(s) ? (
                      <p className={`text-xs mt-0.5 truncate ${muted}`}>{scheduleText(s)}</p>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Main content panel */}
        <div className="flex-1 min-w-0">
          {!selectedSection ? (
            <Card>
              <CardContent className="py-16 text-center">
                <BookOpen className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">Select a class from the sidebar to get started.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <div className="px-6 pt-5 pb-3 border-b">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-[#1a3c5e]">{selectedSection.name}</h2>

                    <p className="text-sm text-slate-500 mt-0.5">{selectedSection.programName}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 flex-wrap">
                      {selectedSection.subject && <span>Subject: {selectedSection.subject}</span>}
                      {selectedSection.gradeLevel && <span>Grade: {selectedSection.gradeLevel}</span>}
                      {selectedSection.room && <span>Room: {selectedSection.room}</span>}
                      {scheduleText(selectedSection) && <span>{scheduleText(selectedSection)}</span>}
                    </div>
                    {selectedSection.description && (
                      <p className="text-xs text-slate-500 mt-1">{selectedSection.description}</p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setShowAssignLesson(true)}
                    className="bg-emerald-600 hover:bg-emerald-700 shrink-0">
                    <BookMarked className="w-4 h-4 mr-1.5" />
                    Assign Lesson
                  </Button>
                </div>

                {/* Tabs */}
                <div className="flex gap-0 mt-4 -mb-3 border-b border-transparent">
                  {TABS.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)}
                      className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                        tab === t.id
                          ? "border-emerald-600 text-emerald-700"
                          : "border-transparent text-slate-500 hover:text-slate-700"
                      }`}>
                      <t.icon className="w-4 h-4" />
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <CardContent className="pt-4">
                {tab === "roster" && <RosterTab sectionId={selectedSection.id} />}
                {tab === "sessions" && <SessionsTab sectionId={selectedSection.id} />}
                {tab === "assignments" && (
                  <AssignmentsTab
                    sectionId={selectedSection.id}
                    onAssignmentChange={handleAssignmentChange}
                  />
                )}
                {tab === "gradebook" && <GradebookTab sectionId={selectedSection.id} />}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {showAssignLesson && selectedSection && (
        <AssignLessonModal
          sectionId={selectedSection.id}
          sectionName={selectedSection.name}
          onClose={() => setShowAssignLesson(false)}
          onAssigned={() => qc.invalidateQueries({ queryKey: ["section-gradebook", selectedSection.id] })}
        />
      )}
    </div>
  );
}
