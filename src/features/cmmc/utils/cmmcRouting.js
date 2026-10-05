export function normalizeCMMCSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function buildCMMCPath(segment = "") {
  const normalizedSegment = normalizeCMMCSlug(segment);
  return normalizedSegment ? `/cmmc/${normalizedSegment}` : "/cmmc";
}

export function clampPercentage(value) {
  const numericValue = Number(value);

  if (Number.isNaN(numericValue)) {
    return 0;
  }

  return Math.min(100, Math.max(0, numericValue));
}
