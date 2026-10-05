import { readScopedJson, writeScopedJson } from "../auth/session";

const PROFILE_KEY = "spectramind:trust-center-profile";
const REQUESTS_KEY = "spectramind:trust-center-requests";

export const DEFAULT_TRUST_PROFILE = {
  published: false,
  headline: "Security and compliance are built into how we operate.",
  description: "Review our compliance posture, security program, and approved customer-facing resources.",
  securityEmail: "",
  website: "",
  showReadiness: true,
  showFrameworks: true,
  showPolicies: true,
  allowAccessRequests: true,
  updatedAt: "",
};

export function loadTrustProfile() {
  return { ...DEFAULT_TRUST_PROFILE, ...readScopedJson(PROFILE_KEY, {}) };
}

export function saveTrustProfile(profile) {
  const next = { ...DEFAULT_TRUST_PROFILE, ...profile, updatedAt: new Date().toISOString() };
  writeScopedJson(PROFILE_KEY, next, { eventName: "spectramind:trust-center-updated" });
  return next;
}

export function loadTrustRequests() {
  return readScopedJson(REQUESTS_KEY, []);
}

export function createTrustRequest(request) {
  const next = [
    {
      id: `trust-request-${Date.now()}`,
      name: request.name.trim(),
      email: request.email.trim().toLowerCase(),
      company: request.company.trim(),
      resource: request.resource,
      reason: request.reason.trim(),
      status: "Pending",
      requestedAt: new Date().toISOString(),
    },
    ...loadTrustRequests(),
  ];
  saveRequests(next);
  return next;
}

export function updateTrustRequest(requestId, status) {
  const next = loadTrustRequests().map((request) => request.id === requestId
    ? { ...request, status, reviewedAt: new Date().toISOString() }
    : request);
  saveRequests(next);
  return next;
}

function saveRequests(requests) {
  writeScopedJson(REQUESTS_KEY, requests, { eventName: "spectramind:trust-center-updated" });
}
