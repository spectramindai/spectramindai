const SPRS_MAX_SCORE = 110;
const SPRS_CONTROL_WEIGHTS = {
  "3.1.1": 5,
  "3.1.2": 5,
  "3.1.3": 1,
  "3.1.4": 1,
  "3.1.5": 3,
  "3.1.6": 1,
  "3.1.7": 1,
  "3.1.8": 1,
  "3.1.9": 1,
  "3.1.10": 1,
  "3.1.11": 1,
  "3.1.12": 5,
  "3.1.13": 5,
  "3.1.14": 1,
  "3.1.15": 1,
  "3.1.16": 5,
  "3.1.17": 5,
  "3.1.18": 5,
  "3.1.19": 3,
  "3.1.20": 1,
  "3.1.21": 1,
  "3.1.22": 1,
  "3.2.1": 5,
  "3.2.2": 5,
  "3.2.3": 1,
  "3.3.1": 5,
  "3.3.2": 3,
  "3.3.3": 1,
  "3.3.4": 1,
  "3.3.5": 5,
  "3.3.6": 1,
  "3.3.7": 1,
  "3.3.8": 1,
  "3.3.9": 1,
  "3.4.1": 5,
  "3.4.2": 5,
  "3.4.3": 1,
  "3.4.4": 1,
  "3.4.5": 5,
  "3.4.6": 5,
  "3.4.7": 5,
  "3.4.8": 5,
  "3.4.9": 1,
  "3.5.1": 5,
  "3.5.2": 5,
  "3.5.3": 5,
  "3.5.4": 1,
  "3.5.5": 1,
  "3.5.6": 1,
  "3.5.7": 1,
  "3.5.8": 1,
  "3.5.9": 1,
  "3.5.10": 5,
  "3.5.11": 1,
  "3.6.1": 5,
  "3.6.2": 5,
  "3.6.3": 1,
  "3.7.1": 3,
  "3.7.2": 5,
  "3.7.3": 1,
  "3.7.4": 3,
  "3.7.5": 5,
  "3.7.6": 1,
  "3.8.1": 3,
  "3.8.2": 3,
  "3.8.3": 5,
  "3.8.4": 1,
  "3.8.5": 1,
  "3.8.6": 1,
  "3.8.7": 5,
  "3.8.8": 3,
  "3.8.9": 1,
  "3.9.1": 3,
  "3.9.2": 5,
  "3.10.1": 5,
  "3.10.2": 5,
  "3.10.3": 1,
  "3.10.4": 1,
  "3.10.5": 1,
  "3.10.6": 1,
  "3.11.1": 3,
  "3.11.2": 5,
  "3.11.3": 1,
  "3.12.1": 5,
  "3.12.2": 3,
  "3.12.3": 5,
  "3.12.4": 0,
  "3.13.1": 5,
  "3.13.2": 5,
  "3.13.3": 1,
  "3.13.4": 1,
  "3.13.5": 5,
  "3.13.6": 5,
  "3.13.7": 1,
  "3.13.8": 3,
  "3.13.9": 1,
  "3.13.10": 1,
  "3.13.11": 5,
  "3.13.12": 1,
  "3.13.13": 1,
  "3.13.14": 1,
  "3.13.15": 5,
  "3.13.16": 1,
  "3.14.1": 5,
  "3.14.2": 5,
  "3.14.3": 5,
  "3.14.4": 5,
  "3.14.5": 3,
  "3.14.6": 5,
  "3.14.7": 3,
};

const SPRS_TOTAL_DEDUCTION_POINTS = Object.values(SPRS_CONTROL_WEIGHTS).reduce((total, value) => total + value, 0);
const SPRS_MIN_SCORE = SPRS_MAX_SCORE - SPRS_TOTAL_DEDUCTION_POINTS;

export function calculateCMMCSPRSMetrics(workflowState = {}, frameworkLibrary = {}) {
  const controls = buildControlMetrics(frameworkLibrary, workflowState?.controls?.fields);
  const totals = controls.reduce(
    (summary, control) => {
      summary.totalControls += 1;
      summary.pointsSecured += control.pointsSecured;
      summary.pointsAtRisk += control.pointsAtRisk;
      if (control.isReady) summary.completedControls += 1;
      if (control.status === "NOT_APPLICABLE") summary.notApplicableControls += 1;
      if (isInProgressLikeStatus(control.status)) summary.inProgressControls += 1;
      if (control.status === "NOT_STARTED") summary.notStartedControls += 1;
      if (control.isCriticalGap) summary.criticalGapCount += 1;
      return summary;
    },
    {
      totalControls: 0,
      completedControls: 0,
      inProgressControls: 0,
      notStartedControls: 0,
      notApplicableControls: 0,
      pointsSecured: 0,
      pointsAtRisk: 0,
      criticalGapCount: 0,
    }
  );
  const currentSPRSScore = SPRS_MAX_SCORE - totals.pointsAtRisk;
  const readinessPercentage = calculatePercentage(totals.completedControls, totals.totalControls);
  const domainScores = buildCompletionByControlFamily(controls);

  return {
    frameworkId: workflowState?.frameworkId || "",
    methodology: "NIST SP 800-171 DoD Assessment Methodology v1.2.1",
    currentSPRSScore,
    pointsSecured: totals.pointsSecured,
    pointsAtRisk: totals.pointsAtRisk,
    criticalGapCount: totals.criticalGapCount,
    readinessPercentage,
    normalizedProgress: normalizeScore(currentSPRSScore),
    completionPercentage: readinessPercentage,
    totalControls: totals.totalControls,
    completedControls: totals.completedControls,
    implementedControls: totals.completedControls - totals.notApplicableControls,
    inProgressControls: totals.inProgressControls,
    notStartedControls: totals.notStartedControls,
    notApplicableControls: totals.notApplicableControls,
    openGapCount: totals.inProgressControls + totals.notStartedControls,
    scoreRange: {
      minimum: SPRS_MIN_SCORE,
      baseline: 0,
      conditionalLevel2: 88,
      maximum: SPRS_MAX_SCORE,
      totalDeductionPoints: SPRS_TOTAL_DEDUCTION_POINTS,
    },
    riskBand: getRiskBand(currentSPRSScore),
    domainScores,
    completionByControlFamily: domainScores.map((domain) => ({
      familyCode: domain.domainCode,
      familyName: domain.domainName,
      controlFamily: domain.controlFamily,
      totalControls: domain.totalControls,
      completedControls: domain.completedControls,
      inProgressControls: domain.inProgressControls,
      notStartedControls: domain.notStartedControls,
      completionPercentage: domain.readinessPercentage,
    })),
    controls,
    assumptions: [
      "Offline fallback uses requirement-level status only; API mode uses the backend SPRS service.",
    ],
    lastCalculatedAt: new Date().toISOString(),
  };
}

function buildControlMetrics(frameworkLibrary = {}, controlWorkflowFields = {}) {
  return uniqueControls(frameworkLibrary.controls || []).map((control) => {
    const controlId = control.controlId || control["Control ID"] || control.id || "";
    const requirementId = extractRequirementId(controlId);
    const controlFamily = control.controlFamily || control["Control Family"] || "";
    const family = parseControlFamily(controlFamily, controlId);
    const frameworkStatus = control.evidenceStatus || control["Evidence Status"] || "";
    const workflowStatus = controlWorkflowFields?.[controlId]?.status;
    const { status, displayStatus } = normalizeControlStatus(workflowStatus || frameworkStatus);
    const deduction = requirementId ? SPRS_CONTROL_WEIGHTS[requirementId] ?? 1 : 1;
    const isReady = status === "IMPLEMENTED" || status === "NOT_APPLICABLE";
    const pointsAtRisk = isReady ? 0 : deduction;
    const pointsSecured = isReady ? deduction : 0;

    return {
      id: control.id || controlId,
      controlId,
      requirementId,
      title: control.title || control.controlRequirement || control["Control Requirement"] || "",
      requirement: control.controlRequirement || control["Control Requirement"] || "",
      controlFamily,
      familyCode: family.code,
      familyName: family.name,
      domainCode: family.code,
      domainName: family.name,
      status,
      displayStatus,
      deduction,
      points: deduction,
      pointsSecured,
      pointsAtRisk,
      currentSPRSScore: SPRS_MAX_SCORE - pointsAtRisk,
      isReady,
      isCriticalGap: pointsAtRisk >= 5,
      partialCreditEligible: requirementId === "3.5.3" || requirementId === "3.13.11",
    };
  });
}

function uniqueControls(controls) {
  const controlsById = new Map();

  controls.forEach((control) => {
    const controlId = control.controlId || control["Control ID"] || control.id || "";
    if (controlId && !controlsById.has(controlId)) {
      controlsById.set(controlId, control);
    }
  });

  return Array.from(controlsById.values());
}

function buildCompletionByControlFamily(controls) {
  const familiesByCode = controls.reduce((families, control) => {
    const familyKey = control.domainCode || control.controlFamily || "Unassigned";
    if (!families.has(familyKey)) {
      families.set(familyKey, {
        domainCode: control.domainCode,
        domainName: control.domainName,
        familyCode: control.domainCode,
        familyName: control.domainName,
        controlFamily: control.controlFamily,
        totalControls: 0,
        completedControls: 0,
        implementedControls: 0,
        inProgressControls: 0,
        notStartedControls: 0,
        notApplicableControls: 0,
        pointsSecured: 0,
        pointsAtRisk: 0,
        criticalGapCount: 0,
        readinessPercentage: 0,
        normalizedProgress: 0,
      });
    }

    const family = families.get(familyKey);
    family.totalControls += 1;
    family.pointsSecured += control.pointsSecured;
    family.pointsAtRisk += control.pointsAtRisk;
    if (control.isReady) family.completedControls += 1;
    if (control.status === "IMPLEMENTED") family.implementedControls += 1;
    if (control.status === "NOT_APPLICABLE") family.notApplicableControls += 1;
    if (isInProgressLikeStatus(control.status)) family.inProgressControls += 1;
    if (control.status === "NOT_STARTED") family.notStartedControls += 1;
    if (control.isCriticalGap) family.criticalGapCount += 1;

    return families;
  }, new Map());

  return Array.from(familiesByCode.values()).map((family) => ({
    ...family,
    readinessPercentage: calculatePercentage(family.completedControls, family.totalControls),
    normalizedProgress:
      family.pointsSecured + family.pointsAtRisk
        ? Math.round((family.pointsSecured / (family.pointsSecured + family.pointsAtRisk)) * 100)
        : 0,
  }));
}

function normalizeControlStatus(status) {
  const original = String(status ?? "").trim();
  const normalizedStatus = original.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  if (["completed", "complete", "implemented", "approved", "ready"].includes(normalizedStatus)) {
    return { status: "IMPLEMENTED", displayStatus: "Completed" };
  }
  if (["not applicable", "not required", "na", "n/a"].includes(normalizedStatus)) {
    return { status: "NOT_APPLICABLE", displayStatus: "Not Applicable" };
  }
  if (["partially implemented", "partial", "partially complete", "partially completed"].includes(normalizedStatus)) {
    return { status: "PARTIALLY_IMPLEMENTED", displayStatus: "Partially Implemented" };
  }
  if (["planned", "planning"].includes(normalizedStatus)) {
    return { status: "PLANNED", displayStatus: "Planned" };
  }
  if (["in progress", "in review", "pending review", "processing"].includes(normalizedStatus)) {
    return { status: "IN_PROGRESS", displayStatus: "In Progress" };
  }
  return { status: "NOT_STARTED", displayStatus: "Not Started" };
}

function isInProgressLikeStatus(status) {
  return ["IN_PROGRESS", "PARTIALLY_IMPLEMENTED", "PLANNED"].includes(status);
}

function calculatePercentage(value, total) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((value / total) * 100)));
}

function normalizeScore(score) {
  return Math.max(0, Math.min(100, Math.round(((score - SPRS_MIN_SCORE) / (SPRS_MAX_SCORE - SPRS_MIN_SCORE)) * 100)));
}

function getRiskBand(score) {
  if (score < 0) return { id: "critical", label: "Critical", color: "#dc2626" };
  if (score < 50) return { id: "high-risk", label: "High Risk", color: "#f97316" };
  if (score < 88) return { id: "moderate", label: "Moderate", color: "#eab308" };
  if (score < 110) return { id: "good", label: "Good", color: "#84cc16" };
  return { id: "excellent", label: "Excellent", color: "#16a34a" };
}

function parseControlFamily(controlFamily, controlId) {
  const [familyCode, ...familyNameParts] = String(controlFamily || "").split(" - ");
  const code = familyCode || String(controlId || "").split(".")[0] || "";
  const name = familyNameParts.join(" - ") || controlFamily || code;
  return { code, name };
}

function extractRequirementId(controlId) {
  return String(controlId || "").match(/\b(\d+\.\d+\.\d+)\b/)?.[1] || "";
}
