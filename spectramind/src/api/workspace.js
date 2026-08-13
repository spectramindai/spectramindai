import { apiRequest, isApiEnabled } from "./client";
export const loadApiWorkspace = frameworkId => isApiEnabled ? apiRequest(`/api/v1/workspace?frameworkId=${encodeURIComponent(frameworkId)}`) : null;
export const saveApiWorkspaceItem = (frameworkId, itemId, state, version, itemType) => apiRequest(`/api/v1/workspace/${encodeURIComponent(itemId)}`, { method: "PUT", body: JSON.stringify({ frameworkId, itemType, state, version }) });
