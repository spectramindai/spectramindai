import { apiRequest, isApiEnabled } from "./client";

export const loadTrustProfileApi = () => isApiEnabled ? apiRequest("/api/v1/trust-center/profile") : null;
export const saveTrustProfileApi = profile => apiRequest("/api/v1/trust-center/profile", { method: "PUT", body: JSON.stringify(profile) });
export const loadTrustRequestsApi = () => isApiEnabled ? apiRequest("/api/v1/trust-center/requests") : null;
export const createTrustRequestApi = request => apiRequest("/api/v1/trust-center/requests", { method: "POST", body: JSON.stringify(request) });
export const updateTrustRequestApi = (id, status) => apiRequest(`/api/v1/trust-center/requests/${id}`, { method: "PATCH", body: JSON.stringify({ status: String(status).toUpperCase() }) });
