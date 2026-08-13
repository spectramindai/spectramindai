import { apiRequest, isApiEnabled } from "./client";

export const loadApiQuestionnaire = frameworkId => isApiEnabled ? apiRequest(`/api/v1/questionnaires/${encodeURIComponent(frameworkId)}`) : null;
export const createQuestionnaireRun = frameworkId => apiRequest("/api/v1/questionnaire-runs", { method: "POST", body: JSON.stringify({ frameworkId }) });
export const saveQuestionnaireAnswer = (runId, questionId, value) => apiRequest(`/api/v1/questionnaire-runs/${runId}/answers/${encodeURIComponent(questionId)}`, { method: "PUT", body: JSON.stringify({ value }) });
export const submitQuestionnaireRun = runId => apiRequest(`/api/v1/questionnaire-runs/${runId}/submit`, { method: "POST" });
