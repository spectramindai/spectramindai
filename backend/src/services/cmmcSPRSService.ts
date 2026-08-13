import type { ImplementationStatus, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export const CMMC_FRAMEWORK_ID = "cmmc-level-2";
export const SPRS_MAX_SCORE = 110;

type SPRSReadinessStatus =
  | "IMPLEMENTED"
  | "NOT_APPLICABLE"
  | "PARTIALLY_IMPLEMENTED"
  | "IN_PROGRESS"
  | "PLANNED"
  | "NOT_STARTED";

type DateLike = Date | string | null | undefined;

type SPRSControlInput = {
  id?: string;
  externalId: string;
  title?: string | null;
  category?: string | null;
  objective?: string | null;
  description?: string | null;
  metadata?: unknown;
  implementationStatus?: string | null;
  implementationUpdatedAt?: DateLike;
  workspaceState?: unknown;
  workspaceUpdatedAt?: DateLike;
};

type SPRSWorkspaceStatus = {
  status?: SPRSReadinessStatus;
  displayStatus?: string;
};

export const SPRS_CONTROL_WEIGHTS: Record<string, number> = {
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

export const SPRS_TOTAL_DEDUCTION_POINTS = Object.values(SPRS_CONTROL_WEIGHTS).reduce(
  (total, value) => total + value,
  0
);
export const SPRS_MIN_SCORE = SPRS_MAX_SCORE - SPRS_TOTAL_DEDUCTION_POINTS;

export async function getCMMCSPRSMetrics(
  organizationId: string,
  frameworkId = CMMC_FRAMEWORK_ID
) {
  const activeFramework = await prisma.organizationFramework.findUnique({
    where: { organizationId_frameworkId: { organizationId, frameworkId } },
  });
  if (!activeFramework?.active) {
    throw Object.assign(new Error("CMMC framework is not active for this organization"), { statusCode: 403 });
  }

  const [controls, workspaceRows] = await Promise.all([
    prisma.control.findMany({
      where: { frameworkId },
      include: { implementations: { where: { organizationId } } },
      orderBy: { externalId: "asc" },
    }),
    prisma.workspaceItemState.findMany({
      where: { organizationId, frameworkId },
    }),
  ]);

  const workspaceByItemId = new Map(workspaceRows.map((row) => [row.itemId, row]));

  return calculateCMMCSPRSMetricsFromControls(
    controls.map((control) => {
      const implementation = control.implementations[0];
      const workspaceState = workspaceByItemId.get(control.externalId);
      return {
        id: control.id,
        externalId: control.externalId,
        title: control.title,
        category: control.category,
        objective: control.objective,
        description: control.description,
        metadata: control.metadata,
        implementationStatus: implementation?.status,
        implementationUpdatedAt: implementation?.updatedAt,
        workspaceState: implementation ? undefined : nonImplementedWorkspaceState(workspaceState?.state),
        workspaceUpdatedAt: implementation ? undefined : workspaceState?.updatedAt,
      };
    }),
    frameworkId
  );
}

export function calculateCMMCSPRSMetricsFromControls(
  controls: SPRSControlInput[] = [],
  frameworkId = CMMC_FRAMEWORK_ID,
  calculatedAt = new Date()
) {
  const scoredControls = controls.map((control) => scoreControl(control));
  const totals = scoredControls.reduce(
    (summary, control) => {
      summary.totalControls += 1;
      summary.pointsSecured += control.pointsSecured;
      summary.pointsAtRisk += control.pointsAtRisk;
      if (control.isReady) summary.completedControls += 1;
      if (control.status === "NOT_APPLICABLE") summary.notApplicableControls += 1;
      if (isInProgressLikeStatus(control.status)) summary.inProgressControls += 1;
      if (control.status === "NOT_STARTED") summary.notStartedControls += 1;
      if (control.pointsAtRisk >= 5) summary.criticalGapCount += 1;
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
  const normalizedProgress = normalizeScore(currentSPRSScore);

  return {
    frameworkId,
    methodology: "NIST SP 800-171 DoD Assessment Methodology v1.2.1",
    currentSPRSScore,
    pointsSecured: totals.pointsSecured,
    pointsAtRisk: totals.pointsAtRisk,
    criticalGapCount: totals.criticalGapCount,
    readinessPercentage,
    normalizedProgress,
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
    domainScores: buildDomainScores(scoredControls),
    completionByControlFamily: buildDomainScores(scoredControls).map((domain) => ({
      familyCode: domain.domainCode,
      familyName: domain.domainName,
      controlFamily: domain.controlFamily,
      totalControls: domain.totalControls,
      completedControls: domain.completedControls,
      inProgressControls: domain.inProgressControls,
      notStartedControls: domain.notStartedControls,
      completionPercentage: domain.readinessPercentage,
    })),
    controls: scoredControls,
    assumptions: [
      "SPRS scoring is calculated from requirement-level implementation status because the current schema does not store assessment-objective-level findings.",
      "Partially implemented, planned, and in-progress controls are scored as not met unless future data captures one of the two explicit DoD partial-credit cases.",
      "Not Applicable is treated as no deduction, matching the DoD methodology only when the organization has documented approved non-applicability or an equivalent measure.",
      "Security requirement 3.12.4 has no numeric deduction in Annex A; if the SSP is absent, the assessment should be treated as incomplete outside this numeric score.",
    ],
    lastCalculatedAt: calculatedAt.toISOString(),
  };
}

export function normalizeWorkspaceImplementationStatus(value: unknown): ImplementationStatus {
  const status = normalizeReadinessStatus(value).status;
  if (status === "IMPLEMENTED") return "IMPLEMENTED";
  if (status === "NOT_APPLICABLE") return "NOT_APPLICABLE";
  if (status && isInProgressLikeStatus(status)) return "IN_PROGRESS";
  return "NOT_STARTED";
}

function scoreControl(control: SPRSControlInput) {
  const requirementId = extractRequirementId(control.externalId);
  const points = requirementId ? SPRS_CONTROL_WEIGHTS[requirementId] ?? 1 : 1;
  const { status, displayStatus } = resolveControlStatus(control);
  const isReady = status === "IMPLEMENTED" || status === "NOT_APPLICABLE";
  const pointsAtRisk = isReady ? 0 : points;
  const pointsSecured = isReady ? points : 0;
  const { domainCode, domainName, controlFamily } = parseControlFamily(control.category, control.externalId);
  const metadata = isRecord(control.metadata) ? control.metadata : {};

  return {
    id: control.id || control.externalId,
    controlId: control.externalId,
    requirementId,
    title: control.title || "",
    requirement: control.objective || control.description || stringField(metadata, "controlRequirement") || "",
    domainCode,
    domainName,
    controlFamily,
    status,
    displayStatus,
    deduction: points,
    points,
    pointsSecured,
    pointsAtRisk,
    currentSPRSScore: SPRS_MAX_SCORE - pointsAtRisk,
    isReady,
    isCriticalGap: pointsAtRisk >= 5,
    partialCreditEligible: requirementId === "3.5.3" || requirementId === "3.13.11",
  };
}

function resolveControlStatus(control: SPRSControlInput): Required<SPRSWorkspaceStatus> {
  const implementationStatus = normalizeReadinessStatus(control.implementationStatus);
  const workspaceStatus = normalizeWorkspaceStatus(control.workspaceState);
  if (implementationStatus.status && workspaceStatus.status) {
    return compareDates(control.workspaceUpdatedAt, control.implementationUpdatedAt) >= 0
      ? { status: workspaceStatus.status, displayStatus: workspaceStatus.displayStatus || displayStatus(workspaceStatus.status) }
      : { status: implementationStatus.status, displayStatus: displayStatus(implementationStatus.status) };
  }
  if (implementationStatus.status) {
    return { status: implementationStatus.status, displayStatus: displayStatus(implementationStatus.status) };
  }
  if (workspaceStatus.status) {
    return { status: workspaceStatus.status, displayStatus: workspaceStatus.displayStatus || displayStatus(workspaceStatus.status) };
  }
  return { status: "NOT_STARTED", displayStatus: "Not Started" };
}

function normalizeWorkspaceStatus(value: unknown): SPRSWorkspaceStatus {
  if (!isRecord(value)) return {};
  return normalizeReadinessStatus(value.status);
}

function nonImplementedWorkspaceState(value: unknown) {
  if (!isRecord(value)) return undefined;
  const workspaceStatus = normalizeWorkspaceStatus(value);
  if (workspaceStatus.status === "IMPLEMENTED") return undefined;
  return value;
}

function normalizeReadinessStatus(value: unknown): SPRSWorkspaceStatus {
  const original = String(value ?? "").trim();
  const normalized = original.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  if (!normalized) return {};
  if (["implemented", "completed", "complete", "approved", "ready"].includes(normalized)) {
    return { status: "IMPLEMENTED", displayStatus: original || "Implemented" };
  }
  if (["not applicable", "not required", "na", "n/a"].includes(normalized)) {
    return { status: "NOT_APPLICABLE", displayStatus: original || "Not Applicable" };
  }
  if (["partially implemented", "partial", "partially complete", "partially completed"].includes(normalized)) {
    return { status: "PARTIALLY_IMPLEMENTED", displayStatus: original || "Partially Implemented" };
  }
  if (["planned", "planning"].includes(normalized)) {
    return { status: "PLANNED", displayStatus: original || "Planned" };
  }
  if (["in progress", "in review", "pending review", "processing"].includes(normalized)) {
    return { status: "IN_PROGRESS", displayStatus: original || "In Progress" };
  }
  return { status: "NOT_STARTED", displayStatus: original || "Not Started" };
}

function isInProgressLikeStatus(status: SPRSReadinessStatus) {
  return ["IN_PROGRESS", "PARTIALLY_IMPLEMENTED", "PLANNED"].includes(status);
}

function displayStatus(status: SPRSReadinessStatus) {
  return {
    IMPLEMENTED: "Completed",
    NOT_APPLICABLE: "Not Applicable",
    PARTIALLY_IMPLEMENTED: "Partially Implemented",
    IN_PROGRESS: "In Progress",
    PLANNED: "Planned",
    NOT_STARTED: "Not Started",
  }[status];
}

function buildDomainScores(controls: ReturnType<typeof scoreControl>[]) {
  const domains = controls.reduce((domainMap, control) => {
    const key = control.domainCode || "Unassigned";
    if (!domainMap.has(key)) {
      domainMap.set(key, {
        domainCode: control.domainCode,
        domainName: control.domainName,
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

    const domain = domainMap.get(key)!;
    domain.totalControls += 1;
    domain.pointsSecured += control.pointsSecured;
    domain.pointsAtRisk += control.pointsAtRisk;
    if (control.isReady) domain.completedControls += 1;
    if (control.status === "IMPLEMENTED") domain.implementedControls += 1;
    if (control.status === "NOT_APPLICABLE") domain.notApplicableControls += 1;
    if (isInProgressLikeStatus(control.status)) domain.inProgressControls += 1;
    if (control.status === "NOT_STARTED") domain.notStartedControls += 1;
    if (control.isCriticalGap) domain.criticalGapCount += 1;
    return domainMap;
  }, new Map<string, {
    domainCode: string;
    domainName: string;
    controlFamily: string;
    totalControls: number;
    completedControls: number;
    implementedControls: number;
    inProgressControls: number;
    notStartedControls: number;
    notApplicableControls: number;
    pointsSecured: number;
    pointsAtRisk: number;
    criticalGapCount: number;
    readinessPercentage: number;
    normalizedProgress: number;
  }>());

  return Array.from(domains.values()).map((domain) => ({
    ...domain,
    readinessPercentage: calculatePercentage(domain.completedControls, domain.totalControls),
    normalizedProgress: domain.pointsSecured + domain.pointsAtRisk
      ? Math.round((domain.pointsSecured / (domain.pointsSecured + domain.pointsAtRisk)) * 100)
      : 0,
  }));
}

function normalizeScore(score: number) {
  return clampPercent(((score - SPRS_MIN_SCORE) / (SPRS_MAX_SCORE - SPRS_MIN_SCORE)) * 100);
}

function calculatePercentage(value: number, total: number) {
  return total ? clampPercent((value / total) * 100) : 0;
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getRiskBand(score: number) {
  if (score < 0) return { id: "critical", label: "Critical", color: "#dc2626" };
  if (score < 50) return { id: "high-risk", label: "High Risk", color: "#f97316" };
  if (score < 88) return { id: "moderate", label: "Moderate", color: "#eab308" };
  if (score < 110) return { id: "good", label: "Good", color: "#84cc16" };
  return { id: "excellent", label: "Excellent", color: "#16a34a" };
}

function extractRequirementId(externalId: string) {
  return String(externalId || "").match(/\b(\d+\.\d+\.\d+)\b/)?.[1] || "";
}

function parseControlFamily(category: string | null | undefined, externalId: string) {
  const [code, ...nameParts] = String(category || "").split(" - ");
  const domainCode = code || String(externalId || "").split(".")[0] || "Unassigned";
  const domainName = nameParts.join(" - ") || category || domainCode;
  return { domainCode, domainName, controlFamily: category || domainCode };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stringField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

function compareDates(left: DateLike, right: DateLike) {
  return dateTime(left) - dateTime(right);
}

function dateTime(value: DateLike) {
  if (!value) return 0;
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  return Number.isFinite(time) ? time : 0;
}

export async function syncControlImplementationFromWorkspaceState(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    userId: string;
    frameworkId: string;
    itemId: string;
    itemType?: string | null;
    state: Record<string, unknown>;
  }
) {
  if (!Object.prototype.hasOwnProperty.call(input.state, "status")) return;
  const normalizedItemType = String(input.itemType || input.state.itemType || "").toLowerCase();
  if (normalizedItemType && !["control", "controls", "cmmc-control"].includes(normalizedItemType)) return;

  const control = await tx.control.findUnique({
    where: { frameworkId_externalId: { frameworkId: input.frameworkId, externalId: input.itemId } },
  });
  if (!control) return;

  const notes = typeof input.state.notes === "string"
    ? input.state.notes
    : typeof input.state.notesGaps === "string"
      ? input.state.notesGaps
      : undefined;
  const targetDate = typeof input.state.targetDate === "string" || typeof input.state.dueDate === "string"
    ? new Date(String(input.state.targetDate || input.state.dueDate))
    : undefined;

  await tx.controlImplementation.upsert({
    where: { organizationId_controlId: { organizationId: input.organizationId, controlId: control.id } },
    create: {
      organizationId: input.organizationId,
      controlId: control.id,
      status: normalizeWorkspaceImplementationStatus(input.state.status),
      notes,
      targetDate: targetDate && Number.isFinite(targetDate.getTime()) ? targetDate : null,
      createdBy: input.userId,
      updatedBy: input.userId,
    },
    update: {
      status: normalizeWorkspaceImplementationStatus(input.state.status),
      notes,
      targetDate: targetDate && Number.isFinite(targetDate.getTime()) ? targetDate : undefined,
      updatedBy: input.userId,
      version: { increment: 1 },
    },
  });
}
