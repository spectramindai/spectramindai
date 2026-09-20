import { useEffect, useMemo, useState } from "react";
import { getApiSession, isApiEnabled } from "../../../api/client";
import { loadCMMCSPRSMetrics } from "../../../api/cmmc";
import {
  CMMC_FRAMEWORK_ID,
  getFrameworkLibrary,
} from "../../../core/engines/framework-engine/frameworkRegistry";
import { calculateCMMCSPRSMetrics } from "../services/cmmcSPRSCalculationService";
import { useCMMCWorkflowState } from "./useCMMCWorkflowState";

const cmmcLibrary = getFrameworkLibrary(CMMC_FRAMEWORK_ID) || emptyFrameworkLibrary();

export function useCMMCSPRSCalculation(frameworkLibrary = cmmcLibrary, { enabled = true } = {}) {
  const { workflowState } = useCMMCWorkflowState();
  const [apiMetrics, setApiMetrics] = useState(null);
  const [apiState, setApiState] = useState({ isLoading: Boolean(isApiEnabled), error: null });

  const fallbackMetrics = useMemo(
    () => calculateCMMCSPRSMetrics(workflowState, frameworkLibrary),
    [frameworkLibrary, workflowState]
  );

  useEffect(() => {
    if (!isApiEnabled || !enabled) return undefined;
    let cancelled = false;
    let requestSequence = 0;

    const refreshMetrics = () => {
      const sequence = ++requestSequence;
      const session = getApiSession();
      if (!session?.token || !session?.organizationId) {
        setApiMetrics(null);
        setApiState({ isLoading: false, error: new Error("Sign in to load CMMC metrics.") });
        return;
      }
      setApiState({ isLoading: true, error: null });
      loadCMMCSPRSMetrics(CMMC_FRAMEWORK_ID)
        .then((metrics) => {
          if (cancelled || sequence !== requestSequence) return;
          setApiMetrics(metrics);
          setApiState({ isLoading: false, error: null });
        })
        .catch((error) => {
          if (cancelled || sequence !== requestSequence) return;
          setApiState({ isLoading: false, error });
        });
    };

    refreshMetrics();
    window.addEventListener("spectramind:session-updated", refreshMetrics);
    window.addEventListener("spectramind:cmmc-sprs-updated", refreshMetrics);
    window.addEventListener("spectramind:workspace-updated", refreshMetrics);

    return () => {
      cancelled = true;
      window.removeEventListener("spectramind:session-updated", refreshMetrics);
      window.removeEventListener("spectramind:cmmc-sprs-updated", refreshMetrics);
      window.removeEventListener("spectramind:workspace-updated", refreshMetrics);
    };
  }, [enabled]);

  const resolvedMetrics = isApiEnabled && enabled ? apiMetrics || emptySPRSMetrics(CMMC_FRAMEWORK_ID) : fallbackMetrics;

  return {
    ...resolvedMetrics,
    isLoading: isApiEnabled && enabled ? apiState.isLoading : false,
    error: isApiEnabled && enabled ? apiState.error : null,
    source: isApiEnabled && enabled ? "api" : "local",
  };
}

function emptyFrameworkLibrary() {
  return {
    controls: [],
    evidence: [],
    mappings: [],
  };
}

function emptySPRSMetrics(frameworkId) {
  return {
    frameworkId,
    methodology: "NIST SP 800-171 DoD Assessment Methodology v1.2.1",
    currentSPRSScore: 0,
    pointsSecured: 0,
    pointsAtRisk: 0,
    criticalGapCount: 0,
    readinessPercentage: 0,
    normalizedProgress: 0,
    completionPercentage: 0,
    totalControls: 0,
    completedControls: 0,
    implementedControls: 0,
    inProgressControls: 0,
    notStartedControls: 0,
    notApplicableControls: 0,
    openGapCount: 0,
    scoreRange: {
      minimum: -203,
      baseline: 0,
      conditionalLevel2: 88,
      maximum: 110,
      totalDeductionPoints: 0,
    },
    riskBand: { id: "moderate", label: "Loading", color: "#eab308" },
    domainScores: [],
    completionByControlFamily: [],
    controls: [],
    assumptions: [],
    lastCalculatedAt: "",
  };
}
