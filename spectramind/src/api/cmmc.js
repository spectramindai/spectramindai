import { apiRequest, isApiEnabled } from "./client";

export const CMMC_API_FRAMEWORK_ID = "cmmc-level-2";

export const loadCMMCSPRSMetrics = (frameworkId = CMMC_API_FRAMEWORK_ID) =>
  isApiEnabled
    ? apiRequest(`/api/v1/cmmc/sprs?frameworkId=${encodeURIComponent(frameworkId)}`)
    : null;

export const loadCMMCEvidenceCompletion = requirementId =>
  isApiEnabled
    ? apiRequest(`/api/v1/cmmc/requirements/${encodeURIComponent(requirementId)}/evidence-completion`)
    : null;
