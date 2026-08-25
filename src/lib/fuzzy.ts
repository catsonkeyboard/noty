export type FuzzyMatch = { score: number } | null;

const isBoundary = (target: string, i: number): boolean => {
  if (i === 0) return true;
  const prev = target[i - 1];
  if ("/-_ .\\".includes(prev)) return true;
  // lower→upper case change counts as a boundary (camelCase)
  return prev === prev.toLowerCase() && target[i] !== target[i].toLowerCase();
};

/**
 * Subsequence match of `query` inside `target` (case-insensitive).
 * Bonuses: prefix +15, boundary start +10, each consecutive char +12,
 * shorter target +1 per unused char (ties prefer compact names).
 */
export function fuzzyMatch(query: string, target: string): FuzzyMatch {
  if (!query) return { score: 0 };
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  let score = 0;
  let qi = 0;
  let prevHit = -2;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] !== q[qi]) continue;
    if (ti === 0) score += 15;
    if (isBoundary(t, ti)) score += 10;
    if (ti === prevHit + 1) score += 12;
    if (qi === q.length - 1 && ti === t.length - 1) score += 5; // full-suffix finish
    prevHit = ti;
    qi++;
  }
  if (qi < q.length) return null;
  score += Math.max(0, 20 - (t.length - q.length)); // compactness
  return { score };
}
