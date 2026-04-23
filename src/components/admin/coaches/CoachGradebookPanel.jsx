import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, BookOpen, Dumbbell, CheckCircle, Clock, AlertCircle, Pencil, Check, X } from "lucide-react";
import { apiGet, apiPatch } from "@/api/apiClient";

function formatDate(str) {
  if (!str) return "—";
  return new Date(str).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const STATUS_STYLES = {
  complete: "bg-green-100 text-green-700",
  incomplete: "bg-amber-100 text-amber-700",
  overdue: "bg-red-100 text-red-700",
};

const STATUS_ICONS = {
  complete: CheckCircle,
  incomplete: Clock,
  overdue: AlertCircle,
};

function LessonRow({ lesson, coachId }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draftPoints, setDraftPoints] = useState(String(lesson.pointsEarned ?? ""));
  const [draftStatus, setDraftStatus] = useState(lesson.status);
  const [saving, setSaving] = useState(false);
  const [overridden, setOverridden] = useState(false);

  const isOverdue = lesson.status === "incomplete" && lesson.dueAt && new Date(lesson.dueAt) < new Date();
  const displayStatus = isOverdue ? "overdue" : lesson.status;
  const StatusIcon = STATUS_ICONS[displayStatus] || Clock;

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiPatch(`/gradebook/lessons/${lesson.id}`, {
        points_earned: draftPoints !== "" ? Number(draftPoints) : null,
        new_status: draftStatus,
      });
      qc.invalidateQueries({ queryKey: ["coach-gradebook", coachId] });
      setEditing(false);
      setOverridden(true);
    } catch (err) {
      // silently fail — user can retry
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50">
      <td className="px-4 py-3 text-sm text-slate-700">{lesson.studentFirstName} {lesson.studentLastName}</td>
      <td className="px-4 py-3">
        <p className="text-sm font-medium text-slate-800">{lesson.title}</p>
        {overridden && <span className="text-[10px] text-blue-600 font-semibold bg-blue-50 px-1.5 py-0.5 rounded">Admin override</span>}
      </td>
      <td className="px-4 py-3 text-xs text-slate-500">{lesson.subject}</td>
      <td className="px-4 py-3 text-xs text-slate-500">{formatDate(lesson.dueAt)}</td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[displayStatus] || "bg-slate-100 text-slate-600"}`}>
          <StatusIcon className="w-3 h-3" />
          {displayStatus}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-slate-700">
        {lesson.pointsEarned != null ? `${lesson.pointsEarned}/${lesson.pointsPossible}` : `—/${lesson.pointsPossible}`}
      </td>
      <td className="px-4 py-3">
        {editing ? (
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              className="w-16 border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none"
              placeholder="pts"
              value={draftPoints}
              min={0}
              max={lesson.pointsPossible}
              onChange={e => setDraftPoints(e.target.value)}
            />
            <select
              className="border border-slate-300 rounded px-1.5 py-1 text-xs focus:outline-none"
              value={draftStatus}
              onChange={e => setDraftStatus(e.target.value)}
            >
              <option value="incomplete">incomplete</option>
              <option value="complete">complete</option>
            </select>
            <button onClick={handleSave} disabled={saving} className="p-1 text-green-600 hover:text-green-700">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            </button>
            <button onClick={() => setEditing(false)} className="p-1 text-slate-400 hover:text-red-500">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => { setEditing(true); setDraftPoints(String(lesson.pointsEarned ?? "")); setDraftStatus(lesson.status); }}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-[#1a3c5e]"
            title="Override grade"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
      </td>
    </tr>
  );
}

export default function CoachGradebookPanel({ coach }) {
  const [filterStudent, setFilterStudent] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["coach-gradebook", coach.id],
    queryFn: () => apiGet(`/coaches/${coach.id}/gradebook`),
  });

  const isPerformance = data?.type === "performance";
  const lessons = data?.lessons || [];
  const logs = data?.logs || [];

  if (isLoading) {
    return <div className="flex items-center justify-center py-12 text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  }

  if (isPerformance) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
          <Dumbbell className="w-4 h-4" />
          Training Log — Performance Coach
        </div>
        {logs.length === 0 ? (
          <p className="text-center py-8 text-slate-400 text-sm">No training sessions logged yet.</p>
        ) : (
          <div className="space-y-2">
            {logs.map(log => (
              <div key={log.id} className="border border-slate-100 rounded-xl px-4 py-3 bg-white">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold text-slate-800">{log.studentFirstName} {log.studentLastName}</p>
                  <p className="text-xs text-slate-400">{formatDate(log.sessionDate)}</p>
                </div>
                {log.duration && <p className="text-xs text-slate-500">Duration: {log.duration} min</p>}
                {log.notes && <p className="text-xs text-slate-500 mt-1">{log.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Filter lessons
  const now = new Date();
  const filtered = lessons.filter(l => {
    const name = `${l.studentFirstName} ${l.studentLastName}`.toLowerCase();
    const matchStudent = !filterStudent || name.includes(filterStudent.toLowerCase());
    const isOverdue = l.status === "incomplete" && l.dueAt && new Date(l.dueAt) < now;
    const displayStatus = isOverdue ? "overdue" : l.status;
    const matchStatus = filterStatus === "all" || displayStatus === filterStatus;
    return matchStudent && matchStatus;
  });

  const studentNames = [...new Set(lessons.map(l => `${l.studentFirstName} ${l.studentLastName}`))];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
        <BookOpen className="w-4 h-4" />
        Academic Gradebook — {lessons.length} lesson{lessons.length !== 1 ? "s" : ""}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none text-slate-700"
          value={filterStudent}
          onChange={e => setFilterStudent(e.target.value)}
        >
          <option value="">All Students</option>
          {studentNames.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <select
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none text-slate-700"
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
        >
          <option value="all">All Statuses</option>
          <option value="complete">Complete</option>
          <option value="incomplete">Incomplete</option>
          <option value="overdue">Overdue</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-center py-8 text-slate-400 text-sm">No lessons found.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-2.5 text-xs font-semibold text-slate-500">Student</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-slate-500">Lesson</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-slate-500">Subject</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-slate-500">Due</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-slate-500">Status</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-slate-500">Points</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-slate-500">Override</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(lesson => (
                <LessonRow key={lesson.id} lesson={lesson} coachId={coach.id} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
