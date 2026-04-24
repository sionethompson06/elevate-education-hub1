/**
 * Common Core State Standards helper
 *
 * Loads all standards from /data/common_core_standards.json (served from public/).
 * The complete dataset (~1,588 standards) is cached after the first fetch.
 *
 * Data schema (per standard):
 *   subject         "Math" | "ELA-Literacy"
 *   grade           "K" | "1" ... "8" | "HS" | "K-12"
 *   domain          e.g. "Operations and Algebraic Thinking"
 *   cluster         e.g. "Represent and solve problems involving multiplication and division."
 *   standard_code   e.g. "CCSS.Math.Content.3.OA.A.1"
 *   short_code      e.g. "3.OA.1"
 *   standard_text   full text of the standard
 *   parent_code     short code of parent standard (for sub-standards) or null
 *   source_url      link back to thecorestandards.org
 */

const DATA_URL = "/data/common_core_standards.json";

let _cache = null;
let _pending = null;

async function _load() {
  if (_cache) return _cache;
  if (_pending) return _pending;
  _pending = (async () => {
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error(`Failed to load standards data: ${res.status} ${res.statusText}`);
    const json = await res.json();
    const standards = Array.isArray(json) ? json : json.standards ?? [];
    _cache = standards;
    return _cache;
  })();
  return _pending;
}

const _uniqueSorted = (arr) => [...new Set(arr.filter(Boolean))];

const _gradeOrder = (g) => {
  if (g === "K") return 0;
  if (g === "HS") return 100;
  if (g === "K-12") return 200;
  const n = Number(g);
  return Number.isFinite(n) ? n : 999;
};

const _sortGrades = (grades) =>
  [...grades].sort((a, b) => _gradeOrder(a) - _gradeOrder(b));

/**
 * Return every standard.
 * @returns {Promise<Array>}
 */
export async function getAllStandards() {
  return _load();
}

/**
 * Return the list of subjects present in the dataset, alphabetically sorted.
 * @returns {Promise<string[]>}
 */
export async function getSubjects() {
  const all = await _load();
  return _uniqueSorted(all.map((s) => s.subject)).sort();
}

/**
 * Return the grades present for a subject, sorted K → HS → K-12.
 * If no subject is passed, returns all grades across subjects.
 * @param {string} [subject]
 * @returns {Promise<string[]>}
 */
export async function getGrades(subject) {
  const all = await _load();
  const src = subject ? all.filter((s) => s.subject === subject) : all;
  return _sortGrades(_uniqueSorted(src.map((s) => s.grade)));
}

/** Alias matching the requested API surface. */
export const getGradesBySubject = getGrades;

/**
 * Return the unique domains for a subject + grade combination, sorted.
 * Either filter may be omitted to widen the results.
 * @param {string} [subject]
 * @param {string} [grade]
 * @returns {Promise<string[]>}
 */
export async function getDomains(subject, grade) {
  const all = await _load();
  const src = all.filter(
    (s) =>
      (!subject || s.subject === subject) &&
      (!grade || s.grade === grade),
  );
  return _uniqueSorted(src.map((s) => s.domain)).sort();
}

/** Alias matching the requested API surface. */
export const getDomainsBySubjectAndGrade = getDomains;

/**
 * Return the unique clusters for a subject + grade + domain combination, sorted.
 * @param {string} [subject]
 * @param {string} [grade]
 * @param {string} [domain]
 * @returns {Promise<string[]>}
 */
export async function getClusters(subject, grade, domain) {
  const all = await _load();
  const src = all.filter(
    (s) =>
      (!subject || s.subject === subject) &&
      (!grade || s.grade === grade) &&
      (!domain || s.domain === domain),
  );
  return _uniqueSorted(src.map((s) => s.cluster)).sort();
}

/** Alias matching the requested API surface. */
export const getClustersBySubjectGradeDomain = getClusters;

/**
 * Filter standards by any combination of {subject, grade, domain, cluster, query}.
 * `query` matches against code, short code, text, domain, and cluster (case-insensitive).
 * @param {{subject?: string, grade?: string, domain?: string, cluster?: string, query?: string}} filters
 * @returns {Promise<Array>}
 */
export async function getStandards(filters = {}) {
  const { subject, grade, domain, cluster, query } = filters;
  const all = await _load();
  const q = (query ?? "").trim().toLowerCase();

  return all.filter((s) => {
    if (subject && s.subject !== subject) return false;
    if (grade && s.grade !== grade) return false;
    if (domain && s.domain !== domain) return false;
    if (cluster && s.cluster !== cluster) return false;
    if (!q) return true;
    return (
      (s.standard_code ?? "").toLowerCase().includes(q) ||
      (s.short_code ?? "").toLowerCase().includes(q) ||
      (s.standard_text ?? "").toLowerCase().includes(q) ||
      (s.domain ?? "").toLowerCase().includes(q) ||
      (s.cluster ?? "").toLowerCase().includes(q)
    );
  });
}

/** Alias matching the requested API surface. */
export const getStandardsByFilters = getStandards;

/**
 * Free-text search over every standard.
 * @param {string} query
 * @returns {Promise<Array>}
 */
export async function searchStandards(query) {
  return getStandards({ query });
}

/**
 * Look up a single standard by its full CCSS code (or short code).
 * @param {string} code
 * @returns {Promise<object | null>}
 */
export async function getStandardByCode(code) {
  if (!code) return null;
  const all = await _load();
  return (
    all.find((s) => s.standard_code === code) ??
    all.find((s) => s.short_code === code) ??
    null
  );
}

// -- Backwards-compat aliases (previous schema used code/text field names) --

/** @deprecated use getStandards({ subject }) */
export async function getStandardsBySubject(subject) {
  return getStandards({ subject });
}

/** @deprecated use getStandards({ grade }) */
export async function getStandardsByGrade(grade) {
  return getStandards({ grade });
}
