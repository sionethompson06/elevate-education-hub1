/**
 * standards_sample_helpers.ts
 *
 * TypeScript helper API for the CCSS standards dataset.
 * Supports filtering by: subject, level, course, grade, domain, cluster.
 *
 * Data schema (per standard):
 *   subject    "Math" | "ELA-Literacy"
 *   level      "Elementary" | "Middle School" | "High School" | "K-12"
 *   course     e.g. "Algebra" | "Reading: Literature" | null (K-8 Math)
 *   grade      "K" | "1" … "8" | "HS" | "K-12"
 *   domain     e.g. "Operations and Algebraic Thinking"
 *   cluster    e.g. "Represent and solve problems involving multiplication"
 *   standard_code  e.g. "CCSS.Math.Content.3.OA.A.1"
 *   short_code     e.g. "3.OA.1"
 *   standard_text  full text of the standard
 *   parent_code    short code of parent standard or null
 *   source_url     link back to thecorestandards.org
 */

export interface Standard {
  subject: string;
  level: string;
  course: string | null;
  grade: string;
  domain: string;
  cluster: string;
  standard_code: string;
  short_code: string;
  standard_text: string;
  parent_code: string | null;
  source_url: string;
}

export interface StandardsFilters {
  subject?: string;
  level?: string;
  course?: string;
  grade?: string;
  domain?: string;
  cluster?: string;
  query?: string;
}

const DATA_URL = "/data/common_core_standards.json";

let _cache: Standard[] | null = null;
let _pending: Promise<Standard[]> | null = null;

async function _load(): Promise<Standard[]> {
  if (_cache) return _cache;
  if (_pending) return _pending;
  _pending = (async () => {
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error(`Failed to load standards: ${res.status} ${res.statusText}`);
    const json = await res.json();
    const standards: Standard[] = Array.isArray(json) ? json : (json.standards ?? []);
    _cache = standards;
    return _cache;
  })();
  return _pending;
}

const _uniqueSorted = (arr: (string | null)[]): string[] =>
  [...new Set(arr.filter(Boolean) as string[])].sort();

const _gradeOrder = (g: string): number => {
  if (g === "K") return 0;
  if (g === "HS") return 100;
  if (g === "K-12") return 200;
  const n = Number(g);
  return Number.isFinite(n) ? n : 999;
};

const _sortGrades = (grades: string[]): string[] =>
  [...grades].sort((a, b) => _gradeOrder(a) - _gradeOrder(b));

const _levelOrder = (l: string): number => {
  const order: Record<string, number> = {
    Elementary: 0,
    "Middle School": 1,
    "High School": 2,
    "K-12": 3,
  };
  return order[l] ?? 99;
};

/** Return every standard. */
export async function getAllStandards(): Promise<Standard[]> {
  return _load();
}

/** Unique subjects, alphabetically sorted. */
export async function getSubjects(): Promise<string[]> {
  const all = await _load();
  return _uniqueSorted(all.map((s) => s.subject));
}

/**
 * Unique levels present in the dataset, sorted by school progression.
 * Optionally filtered by subject.
 */
export async function getLevels(subject?: string): Promise<string[]> {
  const all = await _load();
  const src = subject ? all.filter((s) => s.subject === subject) : all;
  const levels = [...new Set(src.map((s) => s.level).filter(Boolean))];
  return levels.sort((a, b) => _levelOrder(a) - _levelOrder(b));
}

/**
 * Unique courses for the given filters.
 * Returns null-course entries as null; callers can display as "General" or hide.
 */
export async function getCourses(
  subject?: string,
  level?: string,
): Promise<(string | null)[]> {
  const all = await _load();
  const src = all.filter(
    (s) =>
      (!subject || s.subject === subject) &&
      (!level || s.level === level),
  );
  const courses = [...new Set(src.map((s) => s.course))];
  const withCourses = courses.filter((c): c is string => !!c).sort();
  const hasNull = courses.some((c) => c === null);
  return hasNull ? [...withCourses, null] : withCourses;
}

/**
 * Unique grades for the given filters, sorted K → HS → K-12.
 */
export async function getGrades(
  subject?: string,
  level?: string,
  course?: string,
): Promise<string[]> {
  const all = await _load();
  const src = all.filter(
    (s) =>
      (!subject || s.subject === subject) &&
      (!level || s.level === level) &&
      (!course || s.course === course),
  );
  return _sortGrades(_uniqueSorted(src.map((s) => s.grade)));
}

/** Alias. */
export const getGradesBySubject = (subject?: string) => getGrades(subject);

/**
 * Unique domains for the given filters, alphabetically sorted.
 */
export async function getDomains(
  subject?: string,
  level?: string,
  course?: string,
  grade?: string,
): Promise<string[]> {
  const all = await _load();
  const src = all.filter(
    (s) =>
      (!subject || s.subject === subject) &&
      (!level || s.level === level) &&
      (!course || s.course === course) &&
      (!grade || s.grade === grade),
  );
  return _uniqueSorted(src.map((s) => s.domain));
}

/** Alias. */
export const getDomainsBySubjectAndGrade = (subject?: string, grade?: string) =>
  getDomains(subject, undefined, undefined, grade);

/**
 * Unique clusters for the given filters, alphabetically sorted.
 */
export async function getClusters(
  subject?: string,
  level?: string,
  course?: string,
  grade?: string,
  domain?: string,
): Promise<string[]> {
  const all = await _load();
  const src = all.filter(
    (s) =>
      (!subject || s.subject === subject) &&
      (!level || s.level === level) &&
      (!course || s.course === course) &&
      (!grade || s.grade === grade) &&
      (!domain || s.domain === domain),
  );
  return _uniqueSorted(src.map((s) => s.cluster));
}

/** Alias. */
export const getClustersBySubjectGradeDomain = (
  subject?: string,
  grade?: string,
  domain?: string,
) => getClusters(subject, undefined, undefined, grade, domain);

/**
 * Filter standards by any combination of filters.
 * `query` matches against code, short code, text, domain, and cluster (case-insensitive).
 */
export async function getStandards(filters: StandardsFilters = {}): Promise<Standard[]> {
  const { subject, level, course, grade, domain, cluster, query } = filters;
  const all = await _load();
  const q = (query ?? "").trim().toLowerCase();

  return all.filter((s) => {
    if (subject && s.subject !== subject) return false;
    if (level && s.level !== level) return false;
    if (course && s.course !== course) return false;
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

/** Alias. */
export const getStandardsByFilters = getStandards;

/**
 * Free-text search over every standard.
 */
export async function searchStandards(query: string): Promise<Standard[]> {
  return getStandards({ query });
}

/**
 * Look up a single standard by its full CCSS code or short code.
 */
export async function getStandardByCode(code: string): Promise<Standard | null> {
  if (!code) return null;
  const all = await _load();
  return (
    all.find((s) => s.standard_code === code) ??
    all.find((s) => s.short_code === code) ??
    null
  );
}

// Backward-compat aliases
export async function getStandardsBySubject(subject: string): Promise<Standard[]> {
  return getStandards({ subject });
}

export async function getStandardsByGrade(grade: string): Promise<Standard[]> {
  return getStandards({ grade });
}
