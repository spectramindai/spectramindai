import { apiRequest, isApiEnabled } from "./client";
export const loadDashboard = frameworkId => isApiEnabled ? apiRequest(frameworkId ? `/api/v1/dashboard?frameworkId=${encodeURIComponent(frameworkId)}` : "/api/v1/dashboard") : null;
