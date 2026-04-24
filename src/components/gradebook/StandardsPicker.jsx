import { useState, useEffect, useMemo } from "react";
import { Search, ChevronDown, ChevronUp, X, BookMarked } from "lucide-react";
import { getAllStandards } from "@/lib/standards";

// Map lesson subjects → standards subject filter
const SUBJECT_MAP = {
  Math: "Math",
  English: "ELA-Literacy",
  Reading: "ELA-Literacy",
  Writing: "ELA-Literacy",
};

const GRADE_ORDER = (g) => {
  if (g === "K") return 0;
  if (g === "HS") return 100;
  if (g === "K-12") return 200;
  const n = Number(g);
  return Number.isFinite(n) ? n : 999;
};

const LEVEL_ORDER = { Elementary: 0, "Middle School": 1, "High School": 2, "K-12": 3 };

const sortGrades = (grades) =>
  [...grades].sort((a, b) => GRADE_ORDER(a) - GRADE_ORDER(b));

const sortLevels = (levels) =>
  [...levels].sort((a, b) => (LEVEL_ORDER[a] ?? 99) - (LEVEL_ORDER[b] ?? 99));

function shortCode(code) {
  if (!code) return "";
  return code
    .replace(/^CCSS\.(Math\.Content|Math\.Practice|ELA-Literacy)\./, "")
    .replace(/^CCSS\./, "");
}

function gradeLabel(g) {
  if (!g) return "";
  if (g === "K") return "Kindergarten";
  if (g === "HS") return "High School";
  if (g === "K-12") return "K–12 (all grades)";
  return `Grade ${g}`;
}

export default function StandardsPicker({ lessonSubject = "", value = [], onChange }) {
  const [open, setOpen] = useState(false);
  const [allStandards, setAllStandards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  const [subjectFilter, setSubjectFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [domainFilter, setDomainFilter] = useState("");
  const [clusterFilter, setClusterFilter] = useState("");
  const [query, setQuery] = useState("");

  // Auto-map lesson subject into the filter
  useEffect(() => {
    const mapped = SUBJECT_MAP[lessonSubject];
    setSubjectFilter(mapped ?? "all");
    setLevelFilter("");
    setCourseFilter("");
    setGradeFilter("");
    setDomainFilter("");
    setClusterFilter("");
  }, [lessonSubject]);

  // Cascade resets
  useEffect(() => {
    setLevelFilter("");
    setCourseFilter("");
    setGradeFilter("");
    setDomainFilter("");
    setClusterFilter("");
  }, [subjectFilter]);

  useEffect(() => {
    setCourseFilter("");
    setGradeFilter("");
    setDomainFilter("");
    setClusterFilter("");
  }, [levelFilter]);

  useEffect(() => {
    setGradeFilter("");
    setDomainFilter("");
    setClusterFilter("");
  }, [courseFilter]);

  useEffect(() => {
    setDomainFilter("");
    setClusterFilter("");
  }, [gradeFilter]);

  useEffect(() => {
    setClusterFilter("");
  }, [domainFilter]);

  // Fetch full dataset on first open
  useEffect(() => {
    if (!open || allStandards.length > 0 || loading) return;
    setLoading(true);
    setFetchError(null);
    getAllStandards()
      .then(setAllStandards)
      .catch((err) => setFetchError(err.message))
      .finally(() => setLoading(false));
  }, [open]);

  // Pool filtered down to subject + level + course + grade (used for domain/cluster options)
  const scopedPool = useMemo(
    () =>
      allStandards.filter((s) => {
        if (subjectFilter !== "all" && s.subject !== subjectFilter) return false;
        if (levelFilter && s.level !== levelFilter) return false;
        if (courseFilter && s.course !== courseFilter) return false;
        if (gradeFilter && s.grade !== gradeFilter) return false;
        return true;
      }),
    [allStandards, subjectFilter, levelFilter, courseFilter, gradeFilter],
  );

  // Available options for each dropdown, derived from progressively narrowed pool
  const availableLevels = useMemo(() => {
    const src = subjectFilter === "all"
      ? allStandards
      : allStandards.filter((s) => s.subject === subjectFilter);
    return sortLevels([...new Set(src.map((s) => s.level).filter(Boolean))]);
  }, [allStandards, subjectFilter]);

  const availableCourses = useMemo(() => {
    const src = allStandards.filter(
      (s) =>
        (subjectFilter === "all" || s.subject === subjectFilter) &&
        (!levelFilter || s.level === levelFilter),
    );
    return [...new Set(src.map((s) => s.course).filter(Boolean))].sort();
  }, [allStandards, subjectFilter, levelFilter]);

  const availableGrades = useMemo(() => {
    const src = allStandards.filter(
      (s) =>
        (subjectFilter === "all" || s.subject === subjectFilter) &&
        (!levelFilter || s.level === levelFilter) &&
        (!courseFilter || s.course === courseFilter),
    );
    return sortGrades([...new Set(src.map((s) => s.grade).filter(Boolean))]);
  }, [allStandards, subjectFilter, levelFilter, courseFilter]);

  const availableDomains = useMemo(
    () => [...new Set(scopedPool.map((s) => s.domain).filter(Boolean))].sort(),
    [scopedPool],
  );

  const availableClusters = useMemo(() => {
    if (!domainFilter) return [];
    return [
      ...new Set(
        scopedPool
          .filter((s) => s.domain === domainFilter)
          .map((s) => s.cluster)
          .filter(Boolean),
      ),
    ].sort();
  }, [scopedPool, domainFilter]);

  // Final filtered results (exclude already-selected, apply domain/cluster/query)
  const results = useMemo(() => {
    const selected = new Set(value);
    const q = query.trim().toLowerCase();
    return scopedPool.filter((s) => {
      const code = s.standard_code ?? s.code;
      if (selected.has(code)) return false;
      if (domainFilter && s.domain !== domainFilter) return false;
      if (clusterFilter && s.cluster !== clusterFilter) return false;
      if (!q) return true;
      const text = s.standard_text ?? s.text ?? "";
      const short = s.short_code ?? shortCode(code ?? "");
      return (
        (code ?? "").toLowerCase().includes(q) ||
        short.toLowerCase().includes(q) ||
        text.toLowerCase().includes(q) ||
        (s.domain ?? "").toLowerCase().includes(q) ||
        (s.cluster ?? "").toLowerCase().includes(q)
      );
    });
  }, [scopedPool, value, domainFilter, clusterFilter, query]);

  // Lookup map for selected-pill display
  const standardsByCode = useMemo(() => {
    const map = {};
    for (const s of allStandards) {
      const code = s.standard_code ?? s.code;
      if (code) map[code] = s;
    }
    return map;
  }, [allStandards]);

  const add = (code) => onChange([...value, code]);
  const remove = (code) => onChange(value.filter((c) => c !== code));

  const clearFilters = () => {
    setLevelFilter("");
    setCourseFilter("");
    setGradeFilter("");
    setDomainFilter("");
    setClusterFilter("");
    setQuery("");
  };

  const activeFilterCount =
    (levelFilter ? 1 : 0) +
    (courseFilter ? 1 : 0) +
    (gradeFilter ? 1 : 0) +
    (domainFilter ? 1 : 0) +
    (clusterFilter ? 1 : 0) +
    (query ? 1 : 0);

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      {/* Header / toggle */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
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
        {open ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {open && (
        <div className="p-3 space-y-3 border-t border-slate-200">
          {/* Selected pills */}
          {value.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {value.map((code) => {
                const std = standardsByCode[code];
                return (
                  <span
                    key={code}
                    className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200"
                    title={std?.standard_text ?? std?.text}
                  >
                    {std?.short_code ?? shortCode(code)}
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
          <div className="flex gap-1 flex-wrap">
            {["all", "Math", "ELA-Literacy"].map((sub) => (
              <button
                key={sub}
                type="button"
                onClick={() => setSubjectFilter(sub)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                  subjectFilter === sub
                    ? "bg-[#1a3c5e] text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {sub === "all" ? "All" : sub}
              </button>
            ))}
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={clearFilters}
                className="ml-auto px-2 py-1 text-xs text-slate-500 hover:text-slate-800 underline"
              >
                Clear filters ({activeFilterCount})
              </button>
            )}
          </div>

          {/* Level + Course row */}
          <div className="grid grid-cols-2 gap-2">
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
            >
              <option value="">All levels</option>
              {availableLevels.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
            <select
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              disabled={availableCourses.length === 0}
              className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white disabled:bg-slate-50 disabled:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30 truncate"
            >
              <option value="">All courses</option>
              {availableCourses.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Grade + Domain + Cluster row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <select
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
              className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
            >
              <option value="">All grades</option>
              {availableGrades.map((g) => (
                <option key={g} value={g}>
                  {gradeLabel(g)}
                </option>
              ))}
            </select>
            <select
              value={domainFilter}
              onChange={(e) => setDomainFilter(e.target.value)}
              disabled={availableDomains.length === 0}
              className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white disabled:bg-slate-50 disabled:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30 truncate"
            >
              <option value="">All domains</option>
              {availableDomains.map((d) => (
                <option key={d} value={d}>
                  {d.length > 45 ? d.slice(0, 42) + "…" : d}
                </option>
              ))}
            </select>
            <select
              value={clusterFilter}
              onChange={(e) => setClusterFilter(e.target.value)}
              disabled={availableClusters.length === 0}
              className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white disabled:bg-slate-50 disabled:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30 truncate"
            >
              <option value="">All clusters</option>
              {availableClusters.map((c) => (
                <option key={c} value={c}>
                  {c.length > 45 ? c.slice(0, 42) + "…" : c}
                </option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by code (e.g. 3.OA.1), keyword, or domain…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-7 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
            />
          </div>

          {/* Results list */}
          <div className="max-h-64 overflow-y-auto space-y-px rounded-lg border border-slate-100">
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
                {allStandards.length === 0
                  ? "No standards data loaded."
                  : "No matching standards — try adjusting the filters."}
              </div>
            )}
            {results.map((s) => {
              const code = s.standard_code ?? s.code;
              const text = s.standard_text ?? s.text ?? "";
              const short = s.short_code ?? shortCode(code ?? "");
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => add(code)}
                  className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors border-b border-slate-50 last:border-0 group"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] font-mono font-bold text-[#1a3c5e] shrink-0 mt-0.5 group-hover:text-blue-700">
                      {short}
                    </span>
                    <span className="text-xs text-slate-600 leading-snug line-clamp-2">
                      {text}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                    {s.subject} · {s.level}
                    {s.course ? ` · ${s.course}` : ""}
                    {" · "}{gradeLabel(s.grade)}
                    {s.domain ? ` · ${s.domain}` : ""}
                  </p>
                </button>
              );
            })}
          </div>

          {results.length > 0 && (
            <p className="text-[10px] text-slate-400 text-right">
              {results.length.toLocaleString()} standard{results.length !== 1 ? "s" : ""} shown —
              click to link
            </p>
          )}
        </div>
      )}
    </div>
  );
}
