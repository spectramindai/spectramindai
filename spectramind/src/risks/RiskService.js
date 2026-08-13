import { readScopedJson, writeScopedJson } from "../auth/session";
import { QUESTIONNAIRE_STATUSES } from "../data/questionnaireEngine";

export const RISK_STORE_KEY = "spectramind:risk-management";
export const RISK_MANAGER_ROLES = new Set(["Admin", "Compliance Manager", "Security Manager"]);

export const LIKELIHOOD_VALUES = ["Low", "Medium", "High"];
export const IMPACT_VALUES = ["Low", "Medium", "High"];
export const RISK_LEVEL_VALUES = ["Low", "Medium", "High", "Critical"];
export const TREATMENT_STATUSES = ["Open", "In Progress", "Mitigated", "Accepted"];

export function canManageRisks(user) {
  return RISK_MANAGER_ROLES.has(user?.role || "");
}

export function loadRiskStore(frameworkId = "") {
  const store = readScopedJson(storageKey(frameworkId), { overrides: {}, customRisks: [] });
  return normalizeRiskStore(store);
}

export function saveRiskStore(frameworkId = "", store) {
  writeScopedJson(storageKey(frameworkId), normalizeRiskStore(store), { eventName: "spectramind:risk-updated" });
  window.dispatchEvent(new Event("spectramind:workspace-updated"));
  window.dispatchEvent(new Event("storage"));
}

export function updateRisk(store, riskId, updates) {
  const normalized = normalizeRiskStore(store);
  const customRisks = normalized.customRisks.map((risk) =>
    risk.id === riskId ? normalizeCustomRisk({ ...risk, ...updates }) : risk
  );

  if (customRisks.some((risk) => risk.id === riskId)) {
    return { ...normalized, customRisks };
  }

  return {
    ...normalized,
    overrides: {
      ...normalized.overrides,
      [riskId]: {
        ...(normalized.overrides[riskId] || {}),
        ...updates,
        updatedAt: new Date().toISOString(),
      },
    },
  };
}

export function closeRisk(store, riskId) {
  return updateRisk(store, riskId, { treatmentStatus: "Mitigated" });
}

export function createRisk(store, input, activeFramework) {
  const normalized = normalizeRiskStore(store);
  const frameworkName = getFrameworkName(activeFramework);
  return {
    ...normalized,
    customRisks: [
      ...normalized.customRisks,
      normalizeCustomRisk({
        id: `custom-risk-${Date.now()}`,
        name: input.name,
        title: input.name,
        description: input.description || "Custom risk.",
        relatedFrameworks: normalizeList(input.relatedFrameworks).length ? normalizeList(input.relatedFrameworks) : [frameworkName],
        relatedDomain: input.relatedDomain || "General",
        relatedControls: normalizeList(input.relatedControls),
        riskOwner: input.riskOwner || "Unassigned",
        likelihood: normalizeChoice(input.likelihood, LIKELIHOOD_VALUES, "Medium"),
        impact: normalizeChoice(input.impact, IMPACT_VALUES, "Medium"),
        riskLevel: normalizeChoice(input.riskLevel, RISK_LEVEL_VALUES, "Medium"),
        treatmentStatus: normalizeChoice(input.treatmentStatus, TREATMENT_STATUSES, "Open"),
        reviewDate: input.reviewDate || "",
        custom: true,
        createdAt: new Date().toISOString(),
      }),
    ],
  };
}

export function buildRiskManagementSnapshot(frameworkRisks = [], store = {}, activeFramework = null) {
  const normalized = normalizeRiskStore(store);
  const baseRisks = (frameworkRisks || []).map((risk) =>
    normalizeRiskRecord(risk, normalized.overrides[risk.id], activeFramework)
  );
  const customRisks = normalized.customRisks.map((risk) =>
    normalizeRiskRecord(risk, normalized.overrides[risk.id], activeFramework, true)
  );
  const risks = [...baseRisks, ...customRisks];
  const applicable = risks.filter((risk) => risk.applicabilityStatus === QUESTIONNAIRE_STATUSES.APPLICABLE).length;
  const notApplicable = risks.filter((risk) => risk.applicabilityStatus === QUESTIONNAIRE_STATUSES.NOT_APPLICABLE).length;
  const open = risks.filter((risk) => ["Open", "In Progress"].includes(risk.treatmentStatus)).length;

  return {
    store: normalized,
    risks,
    summary: {
      total: risks.length,
      applicable,
      notApplicable,
      open,
      mitigated: risks.filter((risk) => risk.treatmentStatus === "Mitigated").length,
      accepted: risks.filter((risk) => risk.treatmentStatus === "Accepted").length,
    },
  };
}

function normalizeRiskRecord(risk, override = {}, activeFramework = null, isCustom = false) {
  const likelihood = normalizeChoice(override.likelihood || risk.likelihood, LIKELIHOOD_VALUES, "Medium");
  const impact = normalizeChoice(override.impact || risk.impact || severityToImpact(risk.severity), IMPACT_VALUES, "Medium");
  const centralStatus = risk.status || risk.applicabilityStatus || QUESTIONNAIRE_STATUSES.PENDING_ASSESSMENT;
  const applicabilityStatus =
    centralStatus === QUESTIONNAIRE_STATUSES.NOT_APPLICABLE
      ? QUESTIONNAIRE_STATUSES.NOT_APPLICABLE
      : centralStatus === QUESTIONNAIRE_STATUSES.PENDING_ASSESSMENT && !isCustom
        ? QUESTIONNAIRE_STATUSES.PENDING_ASSESSMENT
        : QUESTIONNAIRE_STATUSES.APPLICABLE;

  return {
    ...risk,
    ...override,
    id: risk.id,
    riskId: risk.id,
    riskName: override.riskName || override.name || risk.riskName || risk.name || risk.title || risk.id,
    title: override.riskName || override.name || risk.riskName || risk.name || risk.title || risk.id,
    description: override.description || risk.description || risk.mitigation || "",
    relatedFrameworks: normalizeFrameworks(override.relatedFrameworks || risk.relatedFrameworks, activeFramework),
    relatedDomain: override.relatedDomain || risk.relatedDomain || risk.domain || risk.category || "General",
    relatedControls: normalizeList(override.relatedControls || risk.relatedControls || risk.linkedControls),
    riskOwner: override.riskOwner || risk.riskOwner || risk.owner || "Unassigned",
    owner: override.riskOwner || risk.riskOwner || risk.owner || "Unassigned",
    likelihood,
    impact,
    riskLevel: normalizeChoice(override.riskLevel || risk.riskLevel || risk.severity || calculateRiskLevel(likelihood, impact), RISK_LEVEL_VALUES, "Medium"),
    severity: normalizeChoice(override.riskLevel || risk.riskLevel || risk.severity || calculateRiskLevel(likelihood, impact), RISK_LEVEL_VALUES, "Medium"),
    treatmentStatus: normalizeChoice(override.treatmentStatus || risk.treatmentStatus || risk.remediationStatus, TREATMENT_STATUSES, "Open"),
    reviewDate: override.reviewDate || risk.reviewDate || risk.dueDate || "",
    applicabilityStatus,
    applicable: applicabilityStatus === QUESTIONNAIRE_STATUSES.APPLICABLE,
    custom: isCustom || Boolean(risk.custom),
    itemType: "Risk",
  };
}

function normalizeRiskStore(store = {}) {
  return {
    overrides: store.overrides && typeof store.overrides === "object" ? store.overrides : {},
    customRisks: Array.isArray(store.customRisks) ? store.customRisks.map(normalizeCustomRisk) : [],
  };
}

function normalizeCustomRisk(risk) {
  const likelihood = normalizeChoice(risk.likelihood, LIKELIHOOD_VALUES, "Medium");
  const impact = normalizeChoice(risk.impact, IMPACT_VALUES, "Medium");
  return {
    ...risk,
    name: risk.name || risk.riskName || risk.title || "Custom risk",
    title: risk.title || risk.name || risk.riskName || "Custom risk",
    relatedControls: normalizeList(risk.relatedControls),
    likelihood,
    impact,
    riskLevel: normalizeChoice(risk.riskLevel || calculateRiskLevel(likelihood, impact), RISK_LEVEL_VALUES, "Medium"),
    treatmentStatus: normalizeChoice(risk.treatmentStatus, TREATMENT_STATUSES, "Open"),
  };
}

function calculateRiskLevel(likelihood, impact) {
  const score = riskScore(likelihood) * riskScore(impact);
  if (score >= 9) return "Critical";
  if (score >= 6) return "High";
  if (score >= 3) return "Medium";
  return "Low";
}

function riskScore(value) {
  if (value === "High") return 3;
  if (value === "Medium") return 2;
  return 1;
}

function severityToImpact(severity) {
  if (severity === "Critical" || severity === "High") return "High";
  if (severity === "Medium") return "Medium";
  return "Low";
}

function normalizeChoice(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function normalizeFrameworks(frameworks, activeFramework) {
  if (Array.isArray(frameworks) && frameworks.length) return frameworks;
  return [getFrameworkName(activeFramework)];
}

function getFrameworkName(activeFramework) {
  return activeFramework?.shortName || activeFramework?.name || activeFramework?.id || "Framework";
}

function normalizeList(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value) return [];
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function storageKey(frameworkId) {
  return frameworkId ? `${RISK_STORE_KEY}:${frameworkId}` : RISK_STORE_KEY;
}
