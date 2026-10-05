import { generateImplementationTasks } from "../data/taskEngine";
import {
  QUESTIONNAIRE_STATUSES,
  assessFrameworkQuestionnaire,
  isRelevantToQuestionnaire,
} from "../data/questionnaireEngine";
import { buildAuditReadinessSnapshot } from "../audit/AuditReadinessEngine";
import { buildRiskManagementSnapshot } from "../risks/RiskService";
import { mergeTaskState } from "../tasks/TaskService";

export function buildComplianceSnapshot({
  activeFramework,
  frameworkData,
  questionnaireResponses,
  workspaceData,
  evidenceRecords,
  relationshipGraph,
  progressSummary,
  training,
  policy,
  riskStore,
  auditReviews,
  taskState,
}) {
  const rawFrameworkData = frameworkData || emptyImplementationData();
  const responses = questionnaireResponses || {};
  const applicability = activeFramework
    ? assessFrameworkQuestionnaire({
        frameworkId: activeFramework.id,
        responses,
        workspaceData: workspaceData || {},
      })
    : emptyApplicability();
  const implementations = enrichImplementationData(rawFrameworkData, applicability, workspaceData || {}, responses);
  const riskManagement = buildRiskManagementSnapshot(implementations.risks, riskStore, activeFramework);
  const implementationSnapshot = {
    ...implementations,
    risks: riskManagement.risks,
  };
  const audit = buildAuditReadinessSnapshot({
    activeFramework,
    questionnaire: {
      responses,
      applicability,
    },
    controls: implementationSnapshot.controls,
    implementations: implementationSnapshot,
    evidenceRequirements: implementationSnapshot.evidence,
    evidence: evidenceRecords || [],
    policies: implementationSnapshot.policies,
    risks: riskManagement.risks,
    tests: implementationSnapshot.tests,
    training,
    policy,
    reviews: auditReviews,
    workspaceData: workspaceData || {},
  });
  const generatedTasks = activeFramework
    ? generateImplementationTasks(implementationSnapshot, workspaceData || {}, responses, {
        evidenceRecords: evidenceRecords || [],
        training,
        audit,
      })
    : [];
  const tasks = mergeTaskState(generatedTasks, taskState);

  return {
    framework: activeFramework,
    questionnaire: {
      responses,
      applicability,
    },
    controls: implementationSnapshot.controls,
    implementations: implementationSnapshot,
    policies: implementationSnapshot.policies,
    evidenceRequirements: implementations.evidence,
    evidence: evidenceRecords || [],
    risks: riskManagement.risks,
    risk: riskManagement,
    tests: implementationSnapshot.tests,
    tasks,
    audit,
    trustCenter: {
      frameworkName: activeFramework?.name || "",
      evidenceApproved: (evidenceRecords || []).filter((item) => item.evidenceStatus === "Approved").length,
      evidenceTotal: (evidenceRecords || []).filter((item) => !item.deletedAt).length,
    },
    training: training || {},
    policy: policy || {},
    relationships: relationshipGraph,
    workspaceData: workspaceData || {},
    progressSummary,
  };
}

export function applyWorkspaceRelationshipUpdates({ itemId, nextState, currentWorkspace, relationshipGraph }) {
  const updates = {
    [itemId]: {
      ...(currentWorkspace?.[itemId] || {}),
      ...nextState,
    },
  };

  if (!relationshipGraph || !itemId) return updates;

  const evidenceCount = nextState.evidenceCount ?? nextState.evidenceFiles?.length;
  if (evidenceCount === undefined) return updates;

  const relationships = relationshipGraph.searchRelationships?.({ objectType: "test", objectId: itemId }) || [];
  for (const relationship of relationships) {
    const controlId = relationship.source.objectType === "control"
      ? relationship.source.objectId
      : relationship.target.objectType === "control"
        ? relationship.target.objectId
        : null;

    if (!controlId) continue;
    updates[controlId] = {
      ...(currentWorkspace?.[controlId] || {}),
      evidenceCount,
      linkedEvidenceIds: nextState.linkedEvidenceIds || currentWorkspace?.[controlId]?.linkedEvidenceIds || [],
      evidenceFiles: nextState.evidenceFiles || currentWorkspace?.[controlId]?.evidenceFiles || [],
      evidenceStatus: evidenceCount > 0 ? "Pending Review" : "Missing",
    };
  }

  return updates;
}

export function emptyImplementationData() {
  return {
    controls: [],
    risks: [],
    tests: [],
    policies: [],
    evidence: [],
    populations: [],
  };
}

function emptyApplicability() {
  return {
    controls: [],
    risks: [],
    tests: [],
    policies: [],
    evidence: [],
    implementations: [],
    applicableControls: [],
    applicableRisks: [],
    applicableTests: [],
    applicablePolicies: [],
    applicableEvidence: [],
    applicableImplementations: [],
  };
}

function enrichImplementationData(frameworkData, applicability, workspaceData, questionnaireResponses) {
  return {
    ...frameworkData,
    controls: enrichCollection(frameworkData.controls, applicability.controls, "Control", workspaceData, questionnaireResponses),
    risks: enrichCollection(frameworkData.risks, applicability.risks, "Risk", workspaceData, questionnaireResponses),
    tests: enrichCollection(frameworkData.tests, applicability.tests, "Test", workspaceData, questionnaireResponses),
    policies: enrichCollection(frameworkData.policies, applicability.policies, "Policy", workspaceData, questionnaireResponses),
    evidence: enrichCollection(frameworkData.evidence, applicability.evidence, "Evidence", workspaceData, questionnaireResponses),
  };
}

function enrichCollection(rows = [], assessments = [], itemType, workspaceData, questionnaireResponses) {
  const assessmentById = new Map(assessments.map((assessment) => [assessment.id, assessment]));

  return (rows || []).map((row) => {
    const state = workspaceData?.[row.id] || {};
    const assessment = assessmentById.get(row.id);
    const assessmentStatus = normalizeComplianceStatus(assessment?.status);
    const workspaceStatus = normalizeComplianceStatus(state.status);
    const status = resolveCentralStatus(assessmentStatus, workspaceStatus, state.status);

    return {
      ...row,
      status,
      questionnaireStatus: assessmentStatus,
      applicabilityStatus: status,
      applicable: status !== QUESTIONNAIRE_STATUSES.NOT_APPLICABLE && status !== QUESTIONNAIRE_STATUSES.PENDING_ASSESSMENT,
      applicabilityReason: assessment?.reason || "",
      isQuestionnairePrioritized: isRelevantToQuestionnaire(row, questionnaireResponses),
      itemType,
    };
  });
}

function resolveCentralStatus(assessmentStatus, workspaceStatus, rawWorkspaceStatus) {
  if (rawWorkspaceStatus) return workspaceStatus;
  return assessmentStatus || QUESTIONNAIRE_STATUSES.PENDING_ASSESSMENT;
}

function normalizeComplianceStatus(status) {
  const normalized = String(status || "").toLowerCase().trim();

  if (["not_applicable", "not applicable"].includes(normalized)) return QUESTIONNAIRE_STATUSES.NOT_APPLICABLE;
  if (["pending assessment", "pending_assessment"].includes(normalized)) return QUESTIONNAIRE_STATUSES.PENDING_ASSESSMENT;
  if (["complete", "completed", "implemented", "approved"].includes(normalized)) return QUESTIONNAIRE_STATUSES.COMPLETED;
  if (["applicable", "ready", "open", "in progress", "in_progress", "in review", "in_review", "missing evidence"].includes(normalized)) {
    return QUESTIONNAIRE_STATUSES.APPLICABLE;
  }
  if (normalized) return QUESTIONNAIRE_STATUSES.APPLICABLE;
  return QUESTIONNAIRE_STATUSES.PENDING_ASSESSMENT;
}
