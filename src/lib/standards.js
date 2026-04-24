/**
 * Common Core State Standards helper
 *
 * Loads standards from /data/common_core_standards.json (served from public/).
 * Data is cached after the first fetch.
 *
 * Usage:
 *   import { getAllStandards, getStandardsBySubject, getStandardsByGrade, searchStandards } from '@/lib/standards';
 *
 *   const mathStandards = await getStandardsBySubject('Math');
 */

let _cache = null;

/**
 * Load and cache the standards JSON.
 * @returns {Promise<Array>}
 */
async function _load() {
  if (_cache) return _cache;
  const res = await fetch("/data/common_core_standards.json");
  if (!res.ok) throw new Error(`Failed to load standards data: ${res.status} ${res.statusText}`);
  const json = await res.json();
  _cache = json.standards ?? [];
  return _cache;
}

/**
 * Return every standard.
 * @returns {Promise<Array<{subject, grade, domain, cluster, code, text, url}>>}
 */
export async function getAllStandards() {
  return _load();
}

/**
 * Return standards for a given subject (case-insensitive).
 * @param {string} subject  e.g. "Math" or "ELA-Literacy"
 * @returns {Promise<Array>}
 */
export async function getStandardsBySubject(subject) {
  const all = await _load();
  const q = subject.toLowerCase();
  return all.filter(s => s.subject?.toLowerCase() === q);
}

/**
 * Return standards for a given grade label (case-insensitive, partial match).
 * @param {string} grade  e.g. "Grade 3", "Kindergarten", "High School: Algebra"
 * @returns {Promise<Array>}
 */
export async function getStandardsByGrade(grade) {
  const all = await _load();
  const q = grade.toLowerCase();
  return all.filter(s => s.grade?.toLowerCase().includes(q));
}

/**
 * Return standards matching a domain/cluster/code/text search query.
 * @param {string} query
 * @returns {Promise<Array>}
 */
export async function searchStandards(query) {
  const all = await _load();
  if (!query?.trim()) return all;
  const q = query.toLowerCase();
  return all.filter(
    s =>
      s.code?.toLowerCase().includes(q) ||
      s.text?.toLowerCase().includes(q) ||
      s.domain?.toLowerCase().includes(q) ||
      s.cluster?.toLowerCase().includes(q),
  );
}

/**
 * Return the list of unique subjects in the dataset.
 * @returns {Promise<string[]>}
 */
export async function getSubjects() {
  const all = await _load();
  return [...new Set(all.map(s => s.subject).filter(Boolean))].sort();
}

/**
 * Return the list of unique grades for a given subject.
 * @param {string} subject
 * @returns {Promise<string[]>}
 */
export async function getGradesBySubject(subject) {
  const filtered = await getStandardsBySubject(subject);
  return [...new Set(filtered.map(s => s.grade).filter(Boolean))];
}
