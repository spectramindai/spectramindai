const SESSION_KEY = "spectramind:session";
const LEGACY_GOOGLE_USER_KEY = "spectramind_google_user";

export function createUserSession({
  id,
  name,
  email,
  picture,
  organizationId,
  organizationName,
  role,
  onboardingComplete,
  organizationSetupSkipped,
}) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const displayName = String(name || normalizedEmail.split("@")[0] || "User").trim();
  const orgName = String(organizationName || "").trim();
  const orgId = organizationId || (orgName ? slugify(orgName) : "");

  return {
    userId: id || `user:${normalizedEmail || cryptoSafeId()}`,
    name: displayName,
    email: normalizedEmail,
    organizationId: orgId,
    organizationName: orgName,
    role: normalizeRole(role),
    onboardingComplete: onboardingComplete ?? Boolean(orgId && orgName),
    organizationSetupSkipped: Boolean(organizationSetupSkipped),
    picture: picture || "",
    createdAt: new Date().toISOString(),
  };
}

export function getStoredSession() {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(SESSION_KEY) || window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isValidSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function persistSession(session, { remember = true } = {}) {
  if (typeof window === "undefined") return;

  const storage = remember ? window.localStorage : window.sessionStorage;
  const otherStorage = remember ? window.sessionStorage : window.localStorage;
  storage.setItem(SESSION_KEY, JSON.stringify(session));
  otherStorage.removeItem(SESSION_KEY);
  window.localStorage.removeItem(LEGACY_GOOGLE_USER_KEY);
  window.dispatchEvent(new Event("spectramind:session-updated"));
}

export function clearStoredSession() {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem(SESSION_KEY);
  window.sessionStorage.removeItem(SESSION_KEY);
  window.localStorage.removeItem(LEGACY_GOOGLE_USER_KEY);
  window.dispatchEvent(new Event("spectramind:session-updated"));
  window.dispatchEvent(new Event("spectramind:workspace-updated"));
  window.dispatchEvent(new Event("spectramind:questionnaire-updated"));
  window.dispatchEvent(new Event("storage"));
}

export function getCurrentOrganizationId() {
  return getStoredSession()?.organizationId || "";
}

export function getCurrentUserId() {
  return getStoredSession()?.userId || "";
}

export function getUserScopedStorageKey(baseKey, session = getStoredSession()) {
  if (!session?.organizationId || !session?.userId) {
    return `${baseKey}:anonymous`;
  }

  return `${baseKey}:org:${session.organizationId}:user:${session.userId}`;
}

export function getOrganizationScopedStorageKey(baseKey, session = getStoredSession()) {
  if (!session?.organizationId) {
    return `${baseKey}:anonymous`;
  }

  return `${baseKey}:org:${session.organizationId}`;
}

export function readScopedJson(baseKey, fallback, { scope = "organization" } = {}) {
  if (typeof window === "undefined") return fallback;

  try {
    const key = scope === "user" ? getUserScopedStorageKey(baseKey) : getOrganizationScopedStorageKey(baseKey);
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function writeScopedJson(baseKey, value, { scope = "organization", eventName } = {}) {
  if (typeof window === "undefined") return;

  const key = scope === "user" ? getUserScopedStorageKey(baseKey) : getOrganizationScopedStorageKey(baseKey);
  window.localStorage.setItem(key, JSON.stringify(value));
  if (eventName) window.dispatchEvent(new Event(eventName));
}

export function readScopedValue(baseKey, fallback = "", { scope = "organization" } = {}) {
  if (typeof window === "undefined") return fallback;

  try {
    const key = scope === "user" ? getUserScopedStorageKey(baseKey) : getOrganizationScopedStorageKey(baseKey);
    return window.localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

export function writeScopedValue(baseKey, value, { scope = "organization", eventName } = {}) {
  if (typeof window === "undefined") return;

  const key = scope === "user" ? getUserScopedStorageKey(baseKey) : getOrganizationScopedStorageKey(baseKey);
  if (value) {
    window.localStorage.setItem(key, value);
  } else {
    window.localStorage.removeItem(key);
  }

  if (eventName) window.dispatchEvent(new Event(eventName));
}

function isValidSession(session) {
  return Boolean(
    session &&
      typeof session === "object" &&
      session.userId &&
      session.name &&
      session.email &&
      session.role
  );
}

export function normalizeRole(role) {
  const value = String(role || "User").toLowerCase();
  if (value === "admin" || value === "owner") return "Admin";
  if (value.includes("manager")) return "Manager";
  return "User";
}

export function canManageWorkspace(role) {
  return ["Admin", "Manager"].includes(normalizeRole(role));
}

function slugify(value) {
  const slug = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "anonymous-org";
}

function cryptoSafeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
