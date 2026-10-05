import { readScopedJson, writeScopedJson } from "../../../auth/session";
import { isApiEnabled } from "../../../api/client";
import { loadApiWorkspace, saveApiWorkspaceItem } from "../../../api/workspace";
import { CMMC_FRAMEWORK_ID } from "../../../core/engines/framework-engine/frameworkRegistry";

const STORAGE_KEY = "spectramind:cmmc-activity-history";
const MAX_ACTIVITY_ENTRIES = 500;
const ACTIVITY_WORKSPACE_ITEM_ID = "__cmmc_activity_history";
let apiActivityHistory = [];

export const CMMC_ACTIVITY_EVENT = "spectramind:cmmc-activity-updated";

export const CMMC_ACTIVITY_TYPES = {
  CONTROL_STATUS_CHANGED: "Control Workflow Status Changed",
  EVIDENCE_STATUS_CHANGED: "Evidence Status Changed",
  EVIDENCE_OWNER_CHANGED: "Evidence Owner Changed",
  DATE_COLLECTED_CHANGED: "Date Collected Changed",
  SOURCE_SYSTEM_CHANGED: "Source System Changed",
  NOTES_GAPS_CHANGED: "Notes / Gaps Changed",
  GAP_WIZARD_REVIEW_COMPLETED: "Gap Wizard Review Completed",
  POAM_REMEDIATION_STATUS_CHANGED: "POA&M Remediation Status Changed",
  SCOPE_ANSWER_CHANGED: "Scope Questionnaire Answer Changed",
};

export function loadCMMCActivityHistory() {
  if (isApiEnabled) return apiActivityHistory;
  return normalizeActivityHistory(readScopedJson(STORAGE_KEY, [], { scope: "organization" }));
}

export async function hydrateCMMCActivityHistory() {
  if (!isApiEnabled) return loadCMMCActivityHistory();
  const workspace = await loadApiWorkspace(CMMC_FRAMEWORK_ID);
  apiActivityHistory = normalizeActivityHistory(workspace?.[ACTIVITY_WORKSPACE_ITEM_ID]?.activities || []);
  window.dispatchEvent(new Event(CMMC_ACTIVITY_EVENT));
  return apiActivityHistory;
}

export function recordCMMCActivity(activity) {
  return recordCMMCActivities([activity])[0] || null;
}

export function recordCMMCActivities(activities = []) {
  const nextActivities = activities
    .map(normalizeActivity)
    .filter(Boolean);

  if (!nextActivities.length) return [];

  const history = loadCMMCActivityHistory();
  const nextHistory = [...nextActivities, ...history].slice(0, MAX_ACTIVITY_ENTRIES);
  if (isApiEnabled) {
    apiActivityHistory = nextHistory;
    saveApiWorkspaceItem(CMMC_FRAMEWORK_ID, ACTIVITY_WORKSPACE_ITEM_ID, { activities: nextHistory }, undefined, "activity_history")
      .catch(() => {});
    window.dispatchEvent(new Event(CMMC_ACTIVITY_EVENT));
  } else {
    writeScopedJson(STORAGE_KEY, nextHistory, {
      scope: "organization",
      eventName: CMMC_ACTIVITY_EVENT,
    });
  }

  return nextActivities;
}

export function formatCMMCActivityName(activity = {}) {
  const controlPrefix = activity.controlId ? `${activity.controlId}: ` : "";
  const subject = activity.answerId || activity.evidenceKey || "";
  const subjectSuffix = subject && !activity.controlId ? ` (${subject})` : "";
  const previousValue = displayActivityValue(activity.previousValue);
  const newValue = displayActivityValue(activity.newValue);

  if (previousValue || newValue) {
    return `${controlPrefix}${activity.activityType || "CMMC Activity"}${subjectSuffix}: ${previousValue || "blank"} to ${newValue || "blank"}`;
  }

  return `${controlPrefix}${activity.activityType || "CMMC Activity"}${subjectSuffix}`;
}

function normalizeActivityHistory(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map(normalizeStoredActivity)
    .filter(Boolean)
    .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
}

function normalizeStoredActivity(activity) {
  if (!activity || typeof activity !== "object" || Array.isArray(activity)) {
    return null;
  }

  if (!activity.timestamp || !activity.activityType) {
    return null;
  }

  return {
    id: String(activity.id || activity.timestamp),
    timestamp: String(activity.timestamp),
    controlId: String(activity.controlId || ""),
    activityType: String(activity.activityType),
    previousValue: activity.previousValue ?? "",
    newValue: activity.newValue ?? "",
    evidenceKey: String(activity.evidenceKey || ""),
    answerId: String(activity.answerId || ""),
  };
}

function normalizeActivity(activity) {
  if (!activity || typeof activity !== "object" || Array.isArray(activity)) {
    return null;
  }

  const previousValue = normalizeActivityValue(activity.previousValue);
  const newValue = normalizeActivityValue(activity.newValue);

  if (previousValue === newValue) {
    return null;
  }

  const timestamp = activity.timestamp || new Date().toISOString();
  const activityType = String(activity.activityType || "").trim();

  if (!activityType) {
    return null;
  }

  return {
    id: activity.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    timestamp,
    controlId: String(activity.controlId || ""),
    activityType,
    previousValue,
    newValue,
    evidenceKey: String(activity.evidenceKey || ""),
    answerId: String(activity.answerId || ""),
  };
}

function normalizeActivityValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? "").trim()).filter(Boolean).join(", ");
  }

  if (value && typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value ?? "").trim();
}

function displayActivityValue(value) {
  return String(value ?? "").trim();
}
