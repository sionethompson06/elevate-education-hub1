import { useState, useEffect, useMemo } from "react";
import { Search, ChevronDown, ChevronUp, X, BookMarked } from "lucide-react";
import { getAllStandards } from "@/lib/standards";

// Map lesson subjects → standards subject filter
const SUBJECT_MAP = {
  Math:    "Math",
  English: "ELA-Literacy",
  Reading: "ELA-Literacy",
  Writing: "ELA-Literacy",
};

// Shorten a CCSS code to the meaningful suffix, e.g.
// "CCSS.Math.Content.K.CC.A.1" → "K.CC.A.1"
// "CCSS.ELA-Literacy.RL.3.1"   → "RL.3.1"
function shortCode(code) {
  return code
    .replace(/^CCSS\.(Math\.Content|Math\.Practice|ELA-Literacy)\./, "")
    .replace(/^CCSS\./, "");
}

export default function StandardsPicker({ lessonSubject = "", value = [], onChange }) {
  const [open, setOpen] = useState(false);
  const [allStandards, setAllStandards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [gradeFilter, setGradeFilter] = useState("");
  const [query, setQuery] = useState("");

  // Auto-set subject filter when the lesson subject changes
  useEffect(() => {
    const mapped = SUBJECT_MAP[lessonSubject];
    setSubjectFilter(mapped ?? "all");
    setGradeFilter("");
  }, [lessonSubject]);

  // Fetch standards once when the picker is first opened
  useEffect(() => {
    if (!open || allStandards.length > 0 || loading) return;
    setLoading(true);
    setFetchError(null);
    getAllStandards()
      .then(setAllStandards)
      .catch(err => setFetchError(err.message))
      .finally(() => setLoading(false));
  }, [open]);

  // Derive the grade list for the current subject filter
  const availableGrades = useMemo(() => {
    const src = subjectFilter === "all"
      ? allStandards
      : allStandards.filter(s => s.subject === subjectFilter);
    return [...new Set(src.map(s => s.grade).filter(Boolean))];
  }, [allStandards, subjectFilter]);

  // Filter and deduplicate the results list
  const results = useMemo(() => {
    const selectedSet = new Set(value);
    return allStandards.filter(s => {
      if (selectedSet.has(s.code)) return false;
      if (subjectFilter !== "all" && s.subject !== subjectFilter) return false;
      if (gradeFilter && s.grade !== gradeFilter) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        return (
          s.code.toLowerCase().includes(q) ||
          s.text.toLowerCase().includes(q) ||
          s.domain?.toLowerCase().includes(q) ||
          s.cluster?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allStandards, subjectFilter, gradeFilter, query, value]);

  // Build a lookup map from code → standard object for selected pill display
  const standardsByCode = useMemo(() => {
    const map = {};
    for (const s of allStandards) map[s.code] = s;
    return map;
  }, [allStandards]);

  const add = (code) => onChange([...value, code]);
  const remove = (code) => onChange(value.filter(c => c !== code));

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      {/* Header / toggle */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <BookMarked className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-700">Standards</span>
          {value.length > 0 && (
            <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-[#1a3c5e] text-white">
              {value.length} linked
            </span>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {open && (
        <div className="p-3 space-y-3 border-t border-slate-200">
          {/* Selected pills */}
          {value.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {value.map(code => {
                const std = standardsByCode[code];
                return (
                  <span
                    key={code}
                    className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200"
                    title={std?.text}
                  >
                    {shortCode(code)}
                    <button
                      type="button"
                      onClick={() => remove(code)}
                      className="hover:text-red-500 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          {/* Subject tabs */}
          <div className="flex gap-1">
            {["all", "Math", "ELA-Literacy"].map(sub => (
              <button
                key={sub}
                type="button"
                onClick={() => { setSubjectFilter(sub); setGradeFilter(""); }}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                  subjectFilter === sub
                    ? "bg-[#1a3c5e] text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {sub === "all" ? "All" : sub}
              </button>
            ))}
          </div>

          {/* Grade filter + search */}
          <div className="flex gap-2">
            <select
              value={gradeFilter}
              onChange={e => setGradeFilter(e.target.value)}
              className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30 bg-white min-w-0 w-36 shrink-0"
            >
              <option value="">All grades</option>
              {availableGrades.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by code or keyword…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="w-full pl-7 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
              />
            </div>
          </div>

          {/* Results list */}
          <div className="max-h-52 overflow-y-auto space-y-px rounded-lg border border-slate-100">
            {loading && (
              <div className="py-6 text-center text-xs text-slate-400">Loading standards…</div>
            )}
            {fetchError && (
              <div className="py-4 px-3 text-xs text-red-600 bg-red-50">
                Could not load standards. Make sure{" "}
                <code className="font-mono">public/data/common_core_standards.json</code> exists.
              </div>
            )}
            {!loading && !fetchError && results.length === 0 && (
              <div className="py-6 text-center text-xs text-slate-400">
                {allStandards.length === 0 ? "No standards data loaded." : "No matching standards."}
              </div>
            )}
            {results.map(s => (
              <button
                key={s.code}
                type="button"
                onClick={() => add(s.code)}
                className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors border-b border-slate-50 last:border-0 group"
              >
                <div className="flex items-start gap-2">
                  <span className="text-[10px] font-mono font-bold text-[#1a3c5e] shrink-0 mt-0.5 group-hover:text-blue-700">
                    {shortCode(s.code)}
                  </span>
                  <span className="text-xs text-slate-600 leading-snug line-clamp-2">
                    {s.text}
                  </span>
                </div>
                {s.domain && (
                  <p className="text-[10px] text-slate-400 mt-0.5 ml-0 pl-0 truncate">
                    {s.grade} · {s.domain}
                  </p>
                )}
              </button>
            ))}
          </div>

          {results.length > 0 && (
            <p className="text-[10px] text-slate-400 text-right">{results.length} standard{results.length !== 1 ? "s" : ""} shown — click to link</p>
          )}
        </div>
      )}
    </div>
  );
}
