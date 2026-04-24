import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  BookMarked, Search, Plus, Pencil, Trash2, BookOpen,
  Loader2, AlertCircle,
} from "lucide-react";
import { apiGet, apiDelete } from "@/api/apiClient";

const SUBJECTS = ["Math", "English", "Science", "History", "Reading", "Writing", "PE", "General"];
const GRADES   = ["K","1","2","3","4","5","6","7","8","9","10","11","12"];

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function LessonLibrary() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [search,  setSearch]  = useState("");
  const [subject, setSubject] = useState("");
  const [grade,   setGrade]   = useState("");
  const [deleting, setDeleting] = useState(null);

  const params = new URLSearchParams();
  if (subject) params.set("subject", subject);
  if (grade)   params.set("grade", grade);
  if (search)  params.set("search", search);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["saved-lessons", subject, grade, search],
    queryFn: () => apiGet(`/saved-lessons${params.size ? `?${params}` : ""}`),
  });

  const lessons = data?.lessons ?? [];

  const handleLoad = async (lessonId) => {
    try {
      const res = await apiGet(`/saved-lessons/${lessonId}`);
      if (!res?.lesson) return;
      const planData = JSON.parse(res.lesson.planData);
      navigate("/academic-coach/gradebook", {
        state: { initialPlan: planData, savedLessonId: lessonId },
      });
    } catch {
      // fallback: navigate anyway, LessonBuilder will show empty state
      navigate("/academic-coach/gradebook");
    }
  };

  const handleDelete = async (lessonId) => {
    setDeleting(lessonId);
    try {
      await apiDelete(`/saved-lessons/${lessonId}`);
      qc.invalidateQueries({ queryKey: ["saved-lessons"] });
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700">
            <BookMarked className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Lesson Library</h1>
            <p className="text-sm text-slate-500">Saved lesson plans you can reuse, edit, and assign</p>
          </div>
        </div>
        <button
          onClick={() => navigate("/academic-coach/gradebook")}
          className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg bg-[#1a3c5e] text-white hover:bg-[#0d2540]"
        >
          <Plus className="w-4 h-4" /> New Lesson
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by title or standard…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
          />
        </div>
        <select
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30 bg-white"
        >
          <option value="">All subjects</option>
          {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30 bg-white"
        >
          <option value="">All grades</option>
          {GRADES.map((g) => <option key={g} value={g}>Grade {g === "K" ? "K" : g}</option>)}
        </select>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading lessons…
        </div>
      ) : isError ? (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="text-sm">Failed to load lessons. Please refresh.</span>
        </div>
      ) : lessons.length === 0 ? (
        <EmptyState hasFilters={!!(search || subject || grade)} onNew={() => navigate("/academic-coach/gradebook")} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {lessons.map((lesson) => (
            <LessonCard
              key={lesson.id}
              lesson={lesson}
              deleting={deleting === lesson.id}
              onLoad={() => handleLoad(lesson.id)}
              onDelete={() => handleDelete(lesson.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LessonCard({ lesson, deleting, onLoad, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="border border-slate-200 rounded-xl bg-white p-4 flex flex-col gap-3 hover:shadow-sm transition-shadow">
      {/* Title + subject badge */}
      <div className="space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-slate-900 text-sm leading-snug line-clamp-2 flex-1">
            {lesson.title}
          </h3>
          <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
            {lesson.subject}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {lesson.grade && (
            <span className="text-[11px] font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">
              Grade {lesson.grade}
            </span>
          )}
          {lesson.standardCode && (
            <span className="text-[11px] font-mono text-slate-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
              {lesson.standardCode}
            </span>
          )}
        </div>
        {lesson.standardText && (
          <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
            {lesson.standardText}
          </p>
        )}
      </div>

      <p className="text-[11px] text-slate-400 mt-auto">
        Saved {formatDate(lesson.updatedAt || lesson.createdAt)}
      </p>

      {/* Actions */}
      {confirmDelete ? (
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
          <span className="text-xs text-slate-600 flex-1">Delete this lesson?</span>
          <button
            onClick={() => setConfirmDelete(false)}
            className="text-xs text-slate-400 hover:text-slate-600 font-medium"
          >
            Cancel
          </button>
          <button
            onClick={onDelete}
            disabled={deleting}
            className="text-xs text-red-600 hover:text-red-800 font-semibold disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
          <button
            onClick={onLoad}
            className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-[#1a3c5e] text-white hover:bg-[#0d2540]"
          >
            <BookOpen className="w-3.5 h-3.5" /> Load &amp; Edit
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            className="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

function EmptyState({ hasFilters, onNew }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
      <div className="p-4 rounded-full bg-slate-50">
        <BookMarked className="w-8 h-8 text-slate-300" />
      </div>
      {hasFilters ? (
        <>
          <p className="text-slate-600 font-medium">No lessons match your filters</p>
          <p className="text-sm text-slate-400">Try adjusting the subject, grade, or search term.</p>
        </>
      ) : (
        <>
          <p className="text-slate-600 font-medium">Your lesson library is empty</p>
          <p className="text-sm text-slate-400">
            Build a lesson in the Gradebook, then click <strong>Save to Library</strong> to file it here.
          </p>
          <button
            onClick={onNew}
            className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg bg-[#1a3c5e] text-white hover:bg-[#0d2540]"
          >
            <Plus className="w-4 h-4" /> Build a Lesson
          </button>
        </>
      )}
    </div>
  );
}
