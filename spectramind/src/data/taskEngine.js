import { QUESTIONNAIRE_STATUSES, isRelevantToQuestionnaire } from "./questionnaireEngine";

const completedStatuses = ["ready", "approved", "completed", "complete", "implemented", "active", "mitigated", "accepted"];

export function generateImplementationTasks(frameworkLibrary, workspaceData, questionnaireResponses = {}, context = {}) {
  const tasks = [
    ...generateMissingEvidenceTasks(frameworkLibrary, context.evidenceRecords || []),
    ...generatePendingImplementationTasks(frameworkLibrary, workspaceData, questionnaireResponses),
    ...generateOpenRiskTasks(frameworkLibrary.risks || [], questionnaireResponses),
    ...generatePendingPolicyTasks(frameworkLibrary.policies || [], questionnaireResponses),
    ...generatePendingTestTasks(frameworkLibrary.tests || [], questionnaireResponses),
    ...generateTrainingTasks(context.training || {}),
    ...generateAuditFindingTasks(context.audit || {}),
  ];

  return Array.from(new Map(tasks.map((task) => [task.id, task])).values())
    .sort((a, b) => Number(b.priority) - Number(a.priority));
}

function generateMissingEvidenceTasks(frameworkLibrary, evidenceRecords) {
  const rows = [
    ...(frameworkLibrary.evidence || []),
    ...(frameworkLibrary.tests || []).filter((item) => requiresEvidence("Test") && !hasEvidence(item, evidenceRecords)),
    ...(frameworkLibrary.controls || []).filter((item) => requiresEvidence("Control") && !hasEvidence(item, evidenceRecords)),
  ];

  return rows
    .filter(isApplicable)
    .filter((item) => !hasEvidence(item, evidenceRecords))
    .map((item) => taskFor(item, item.itemType || "Evidence", "missing-evidence", "Missing Evidence", `Upload or link evidence for ${item.title || item.name || item.id}.`, "Evidence", 4));
}

function generatePendingImplementationTasks(frameworkLibrary, workspaceData, questionnaireResponses) {
  const rows = [
    ...(frameworkLibrary.controls || []).map((item) => ({ ...item, itemType: "Control" })),
    ...(frameworkLibrary.populations || []).map((item) => ({ ...item, itemType: "Implementation" })),
  ];

  return rows
    .filter(isApplicable)
    .filter((item) => !isComplete(item))
    .map((item) => taskFor(item, item.itemType, "pending-implementation", "Pending Implementation", `Complete implementation for ${item.title || item.name || item.id}.`, "Implementation", isRelevantToQuestionnaire(item, questionnaireResponses) ? 3 : 2, workspaceData));
}

function generateOpenRiskTasks(risks, questionnaireResponses) {
  return (risks || [])
    .filter(isApplicable)
    .filter((risk) => ["Open", "In Progress"].includes(risk.treatmentStatus || risk.status))
    .map((risk) => taskFor(risk, "Risk", "open-risk", "Open Risk", `Review and treat ${risk.riskName || risk.title || risk.id}.`, "Risk", isRelevantToQuestionnaire(risk, questionnaireResponses) ? 4 : 3));
}

function generatePendingPolicyTasks(policies, questionnaireResponses) {
  return (policies || [])
    .filter(isApplicable)
    .filter((policy) => !(isComplete(policy) || policy.status === "Active"))
    .map((policy) => taskFor(policy, "Policy", "pending-policy", "Pending Policy", `Publish or approve ${policy.name || policy.title || policy.id}.`, "Policy", isRelevantToQuestionnaire(policy, questionnaireResponses) ? 3 : 2));
}

function generatePendingTestTasks(tests, questionnaireResponses) {
  return (tests || [])
    .filter(isApplicable)
    .filter((test) => !isComplete(test))
    .map((test) => taskFor(test, "Test", "pending-test", "Pending Test", `Complete test activity for ${test.title || test.name || test.id}.`, "Test", isRelevantToQuestionnaire(test, questionnaireResponses) ? 3 : 2));
}

function generateTrainingTasks(training) {
  const library = Array.isArray(training.library) ? training.library : [];
  const assignments = training.assignments || {};
  const completions = training.completions || {};

  return library.flatMap((item) => {
    const assigned = assignments[item.id] || [];
    const completed = assigned.filter((employeeId) => Boolean(completions[item.id]?.[employeeId]));
    const pending = assigned.length - completed.length;
    if (pending <= 0) return [];
    return [taskFor(item, "Training", "training-due", "Training Due", `${pending} assignment(s) pending for ${item.name || item.title || item.id}.`, "Training", isOverdue(item.dueDate) ? 4 : 2)];
  });
}

function generateAuditFindingTasks(audit) {
  return (audit.findings || [])
    .filter((finding) => finding.status !== "Resolved")
    .map((finding) => taskFor(
      { id: finding.relatedItemId || finding.id, title: finding.name, owner: finding.owner, dueDate: finding.dueDate },
      finding.category || "Audit",
      `audit-finding-${finding.id}`,
      "Audit Finding",
      finding.description || `Resolve audit finding ${finding.name}.`,
      "Audit",
      severityPriority(finding.severity)
    ));
}

function taskFor(item, itemType, action, title, description, category, priority = 1, workspaceData = {}) {
  const saved = workspaceData[item.id] || {};
  return {
    id: `${item.id}:${action}`,
    title,
    description,
    owner: saved.assignments?.owner || item.owner || item.riskOwner || "Unassigned",
    status: "Open",
    priority,
    itemId: item.id,
    itemType,
    category,
    dueDate: saved.dueDate || item.dueDate || item.reviewDate || "",
  };
}

function requiresEvidence(type) {
  return ["Test", "Control", "Policy"].includes(type);
}

function hasEvidence(item, evidenceRecords = []) {
  if (item.evidenceFiles?.length || item.evidenceCount > 0 || item.linkedEvidenceIds?.length) return true;
  const relatedIds = [
    item.id,
    ...(item.linkedControls || []),
    ...(item.relatedControls || []),
    ...(item.linkedTests || []),
    ...(item.relatedTests || []),
  ].filter(Boolean);

  return evidenceRecords.some((record) => {
    if (record.deletedAt) return false;
    const recordIds = [
      record.id,
      record.metadata?.linkedTest,
      ...(record.metadata?.linkedControls || []),
      ...(record.mappings || []).map((mapping) => mapping.controlId),
      ...(record.mappings || []).map((mapping) => mapping.testId),
      ...(record.mappings || []).map((mapping) => mapping.requirementId),
    ].filter(Boolean);
    return relatedIds.some((id) => recordIds.includes(id));
  });
}

function isApplicable(item) {
  return item?.applicabilityStatus !== QUESTIONNAIRE_STATUSES.NOT_APPLICABLE && item?.status !== QUESTIONNAIRE_STATUSES.NOT_APPLICABLE;
}

function isComplete(item) {
  return completedStatuses.includes(String(item?.status || item?.applicabilityStatus || item?.treatmentStatus || "").toLowerCase());
}

function isOverdue(date) {
  return Boolean(date && new Date(date).getTime() < Date.now());
}

function severityPriority(severity) {
  if (severity === "Critical") return 5;
  if (severity === "High") return 4;
  if (severity === "Medium") return 3;
  return 2;
}
