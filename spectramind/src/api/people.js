import { apiRequest, isApiEnabled } from "./client";

export const listEmployees = () => isApiEnabled ? apiRequest("/api/v1/employees") : null;
export const createEmployee = (input) => apiRequest("/api/v1/employees", { method: "POST", body: JSON.stringify(input) });
export const updateEmployee = (id, version, input) => apiRequest(`/api/v1/employees/${id}`, { method: "PATCH", body: JSON.stringify({ ...input, version }) });
export const deleteEmployee = (id) => apiRequest(`/api/v1/employees/${id}`, { method: "DELETE" });
export const revokeEmployeeAccess = (id) => apiRequest(`/api/v1/employees/${id}/access`, { method: "DELETE" });
export const completeBackgroundCheck = (id) => apiRequest(`/api/v1/employees/${id}/background-check`, { method: "POST" });

export async function synchronizePolicies(frameworkId) {
  if (!isApiEnabled) return null;
  await apiRequest("/api/v1/policies/sync", { method: "POST", body: JSON.stringify({ frameworkId }) });
  return apiRequest(`/api/v1/policies?frameworkId=${encodeURIComponent(frameworkId)}`);
}
export const updatePolicyApi = (id, version, input) => apiRequest(`/api/v1/policies/${id}`, { method: "PATCH", body: JSON.stringify({ ...input, version }) });
export const createPolicyApi = input => apiRequest("/api/v1/policies", { method: "POST", body: JSON.stringify(input) });
export const assignPolicy = (id, employeeIds) => apiRequest(`/api/v1/policies/${id}/assignments`, { method: "PUT", body: JSON.stringify({ employeeIds }) });
export const acknowledgePolicy = (assignmentId) => apiRequest(`/api/v1/policy-assignments/${assignmentId}/acknowledge`, { method: "POST" });
export const resetPolicyAcknowledgement = (assignmentId) => apiRequest(`/api/v1/policy-assignments/${assignmentId}/acknowledgement`, { method: "DELETE" });

export async function synchronizeTraining() {
  if (!isApiEnabled) return null;
  await apiRequest("/api/v1/training/sync", { method: "POST" });
  return apiRequest("/api/v1/training");
}
export const assignTraining = (id, employeeIds) => apiRequest(`/api/v1/training/${id}/assignments`, { method: "PUT", body: JSON.stringify({ employeeIds }) });
export const completeTraining = (assignmentId) => apiRequest(`/api/v1/training-assignments/${assignmentId}/complete`, { method: "POST" });
export const resetTrainingCompletion = (assignmentId) => apiRequest(`/api/v1/training-assignments/${assignmentId}/completion`, { method: "DELETE" });
export const createTrainingCourse = input => apiRequest("/api/v1/training", { method: "POST", body: JSON.stringify(input) });
export const updateTrainingCourse = (id, input) => apiRequest(`/api/v1/training/${id}`, { method: "PATCH", body: JSON.stringify(input) });
export const deleteTrainingCourse = id => apiRequest(`/api/v1/training/${id}`, { method: "DELETE" });
