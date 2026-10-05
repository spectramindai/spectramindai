import { apiRequest, isApiEnabled } from "./client";

export async function synchronizeTasks(frameworkId) {
  if (!isApiEnabled) return null;
  await apiRequest("/api/v1/tasks/sync", { method: "POST", body: JSON.stringify({ frameworkId }) });
  return apiRequest(`/api/v1/tasks?frameworkId=${encodeURIComponent(frameworkId)}`);
}

export async function updateApiTask(taskId, version, updates) {
  return apiRequest(`/api/v1/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify({ ...updates, version }) });
}

export async function synchronizeRisks(frameworkId) {
  if (!isApiEnabled) return null;
  await apiRequest("/api/v1/risks/sync", { method: "POST", body: JSON.stringify({ frameworkId }) });
  return apiRequest(`/api/v1/risks?frameworkId=${encodeURIComponent(frameworkId)}`);
}

export async function createApiRisk(input) {
  return apiRequest("/api/v1/risks", { method: "POST", body: JSON.stringify(input) });
}

export async function updateApiRisk(riskId, version, updates) {
  return apiRequest(`/api/v1/risks/${riskId}`, { method: "PATCH", body: JSON.stringify({ ...updates, version }) });
}
