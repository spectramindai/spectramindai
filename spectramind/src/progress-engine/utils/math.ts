/** Returns a whole-number percentage while safely handling zero totals. */
export function toPercent(completed: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((completed / total) * 100);
}

/** Clamps a score into the valid 0-100 range. */
export function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

/** Calculates a weighted average for score components. */
export function weightedAverage(items: Array<{ score: number; weight: number }>): number {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight <= 0) return 0;
  return clampScore(items.reduce((sum, item) => sum + item.score * item.weight, 0) / totalWeight);
}

