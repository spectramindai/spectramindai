import { readScopedJson, writeScopedJson } from "../auth/session";

const AUDIT_REVIEWS_KEY = "spectramind:audit-reviews";

export function loadAuditReviews(frameworkId = "") {
  const reviews = readScopedJson(storageKey(frameworkId), {});
  return reviews && typeof reviews === "object" ? reviews : {};
}

export function saveAuditReviews(frameworkId = "", reviews) {
  writeScopedJson(storageKey(frameworkId), reviews, { eventName: "spectramind:audit-updated" });
  window.dispatchEvent(new Event("storage"));
}

export function markFindingReviewed(reviews, findingId, user, comments = "") {
  return {
    ...(reviews || {}),
    [findingId]: {
      status: "Reviewed",
      reviewer: user?.name || user?.email || "Reviewer",
      reviewerId: user?.userId || "",
      reviewedAt: new Date().toISOString(),
      comments,
    },
  };
}

function storageKey(frameworkId) {
  return frameworkId ? `${AUDIT_REVIEWS_KEY}:${frameworkId}` : AUDIT_REVIEWS_KEY;
}
