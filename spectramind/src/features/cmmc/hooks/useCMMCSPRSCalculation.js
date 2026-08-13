import { useEffect, useMemo, useState } from "react";
import { isApiEnabled } from "../../../api/client";
import { loadCMMCSPRSMetrics } from "../../../api/cmmc";
import {
  CMMC_FRAMEWORK_ID,
  getFrameworkLibrary,
} from "../../../core/engines/framework-engine/frameworkRegistry";
import { calculateCMMCSPRSMetrics } from "../services/cmmcSPRSCalculationService";
import { useCMMCWorkflowState } from "./useCMMCWorkflowState";

const cmmcLibrary = getFrameworkLibrary(CMMC_FRAMEWORK_ID) || emptyFrameworkLibrary();

export function useCMMCSPRSCalculation(frameworkLibrary = cmmcLibrary) {
  const { workflowState } = useCMMCWorkflowState();
  const [apiMetrics, setApiMetrics] = useState(null);
  const [apiState, setApiState] = useState({ isLoading: Boolean(isApiEnabled), error: null });

  const fallbackMetrics = useMemo(
    () => calculateCMMCSPRSMetrics(workflowState, frameworkLibrary),
    [frameworkLibrary, workflowState]
  );

  useEffect(() => {
    if (!isApiEnabled) return undefined;
    let cancelled = false;

    const refreshMetrics = () => {
      setApiState({ isLoading: true, error: null });
      loadCMMCSPRSMetrics(CMMC_FRAMEWORK_ID)
        .then((metrics) => {
          if (cancelled) return;
          setApiMetrics(metrics);
          setApiState({ isLoading: false, error: null });
        })
        .catch((error) => {
          if (cancelled) return;
          setApiState({ isLoading: false, error });
        });
    };

    refreshMetrics();
    window.addEventListener("spectramind:cmmc-sprs-updated", refreshMetrics);
    window.addEventListener("spectramind:workspace-updated", refreshMetrics);

    return () => {
      cancelled = true;
      window.removeEventListener("spectramind:cmmc-sprs-updated", refreshMetrics);
      window.removeEventListener("spectramind:workspace-updated", refreshMetrics);
    };
  }, []);

  const resolvedMetrics = isApiEnabled ? apiMetrics || emptySPRSMetrics(CMMC_FRAMEWORK_ID) : fallbackMetrics;

  return {
    ...resolvedMetrics,
    isLoading: apiState.isLoading,
    error: apiState.error,
    source: isApiEnabled ? "api" : "local",
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
