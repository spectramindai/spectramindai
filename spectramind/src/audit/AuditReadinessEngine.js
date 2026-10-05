import { QUESTIONNAIRE_STATUSES } from "../data/questionnaireEngine";

export const AUDIT_CATEGORIES = [
  "Controls",
  "Implementations",
  "Evidence",
  "Policies",
  "Risks",
  "Tests",
  "Training",
  "Questionnaire",
];

export const AUDIT_FRAMEWORKS = ["SOC 2", "ISO 27001", "HIPAA", "GDPR", "PCI DSS", "CMMC"];
export const AUDIT_SEVERITIES = ["Critical", "High", "Medium", "Low"];
export const AUDIT_STATUSES = ["Open", "Reviewed", "Resolved"];

const MODULE_PATHS = {
  Questionnaire: "/questionnaire",
  Controls: "/implementation",
  Implementations: "/implementation",
  Evidence: "/evidence",
  Policies: "/policies",
  Risks: "/implementation",
  Tests: "/implementation",
  Training: "/training",
};

export function buildAuditReadinessSnapshot({
  activeFramework,
  questionnaire,
  controls = [],
  implementations = {},
  evidenceRequirements = [],
  evidence = [],
  policies = [],
  risks = [],
  tests = [],
  training = {},
  policy = {},
  reviews = {},
  workspaceData = {},
} = {}) {
  const frameworkName = getFrameworkName(activeFramework);
  const implementationRows = getImplementationRows(implementations);
  const activeEvidence = evidence.filter((record) => !record.deletedAt);
  const findings = applyReviewState([
    ...questionnaireFindings(questionnaire, frameworkName),
    ...rowFindings("Controls", controls, frameworkName, "Missing Control"),
    ...rowFindings("Implementations", implementationRows, frameworkName, "Incomplete Implementation"),
    ...evidenceFindings(evidenceRequirements, activeEvidence, frameworkName),
    ...policyFindings(policies, policy, frameworkName),
    ...riskFindings(risks, frameworkName),
    ...rowFindings("Tests", tests, frameworkName, "Pending Test"),
    ...trainingFindings(training, frameworkName),
  ], reviews);

  const groupedFindings = Object.fromEntries(
    AUDIT_SEVERITIES.map((severity) => [severity, findings.filter((finding) => finding.severity === severity)])
  );

  const stats = buildStats({
    questionnaire,
    controls,
    implementationRows,
    evidenceRequirements,
    activeEvidence,
    policies,
    risks,
    tests,
    training,
    findings,
    reviews,
  });

  return {
    ...stats,
    findings,
    groupedFindings,
    checklist: findings,
    pendingEvidence: findings.filter((finding) => finding.category === "Evidence"),
    overdueTasks: findings.filter((finding) => isOverdue(finding.dueDate)),
    timeline: buildTimeline({ questionnaire, activeEvidence, policies, risks, training, reviews, workspaceData, frameworkName }),
    filters: {
      statuses: ["All", ...AUDIT_STATUSES],
      categories: ["All", ...AUDIT_CATEGORIES],
      frameworks: ["All", ...AUDIT_FRAMEWORKS],
    },
  };
}

function buildStats({
  questionnaire,
  controls,
  implementationRows,
  evidenceRequirements,
  activeEvidence,
  policies,
  risks,
  tests,
  training,
  findings,
  reviews,
}) {
  const controlStats = getCompletionStats(controls);
  const implementationStats = getCompletionStats(implementationRows);
  const evidenceStats = getEvidenceStats(evidenceRequirements, activeEvidence);
  const policyStats = getPolicyStats(policies);
  const riskStats = getRiskStats(risks);
  const testStats = getCompletionStats(tests);
  const trainingStats = getTrainingStats(training);
  const questionnaireScore = questionnaireReadiness(questionnaire);

  const reviewedFindings = findings.filter((finding) => finding.status === "Reviewed").length;
  const openFindings = findings.filter((finding) => finding.status === "Open").length;
  const activeFindingIds = new Set(findings.map((finding) => finding.id));
  const resolvedFindings = Object.entries(reviews || {}).filter(
    ([findingId, review]) => review.status === "Resolved" || (review.status === "Reviewed" && !activeFindingIds.has(findingId))
  ).length;
  const readiness = averageReadiness([
    questionnaireScore,
    controlStats.percentage,
    implementationStats.percentage,
    evidenceStats.coverage,
    policyStats.percentage,
    riskStats.percentage,
    testStats.percentage,
    trainingStats.percentage,
  ]);

  return {
    readiness,
    complianceScore: readiness,
    totalFindings: findings.length + resolvedFindings,
    openFindings,
    reviewedFindings,
    resolvedFindings,
    criticalFindings: countSeverity(findings, "Critical"),
    highFindings: countSeverity(findings, "High"),
    mediumFindings: countSeverity(findings, "Medium"),
    lowFindings: countSeverity(findings, "Low"),
    totalControls: controls.length,
    implementedControls: controlStats.completed,
    missingControls: controlStats.incomplete,
    evidenceCoverage: evidenceStats.coverage,
    controlsCompleted: controlStats.completed,
    policiesPublished: policyStats.completed,
    testsCompleted: testStats.completed,
    completedTests: testStats.completed,
    pendingTests: testStats.incomplete,
    openRisks: riskStats.open,
    missingPolicies: policyStats.missing,
    details: {
      questionnaire: questionnaireScore,
      controls: controlStats,
      implementations: implementationStats,
      evidence: evidenceStats,
      policies: policyStats,
      risks: riskStats,
      tests: testStats,
      training: trainingStats,
    },
  };
}

function questionnaireFindings(questionnaire = {}, frameworkName) {
  const applicability = questionnaire.applicability || {};
  const pendingItems = [
    ...(applicability.controls || []),
    ...(applicability.risks || []),
    ...(applicability.tests || []),
    ...(applicability.policies || []),
    ...(applicability.evidence || []),
  ].filter((item) => item.status === QUESTIONNAIRE_STATUSES.PENDING_ASSESSMENT);

  if (!pendingItems.length) return [];
  return [finding({
    id: "Questionnaire:pending-assessment",
    name: "Incomplete Questionnaire",
    category: "Questionnaire",
    framework: frameworkName,
    domain: "Assessment",
    relatedItemId: "questionnaire",
    severity: "Medium",
    owner: "Compliance",
    dueDate: "",
    lastUpdated: latestResponseTimestamp(questionnaire),
    description: `${pendingItems.length} compliance items are still pending assessment.`,
  })];
}

function rowFindings(category, rows = [], frameworkName, label) {
  return rows.filter((row) => isApplicable(row) && !isComplete(row)).map((row) => finding({
    id: `${category}:${row.id}`,
    name: row.riskName || row.name || row.title || row.id,
    category,
    framework: frameworkName,
    domain: row.relatedDomain || row.domain || row.category || "General",
    relatedItemId: row.id,
    severity: severityForRow(row, category),
    owner: row.riskOwner || row.owner || row.assignments?.owner || "Unassigned",
    dueDate: row.dueDate || row.reviewDate || "",
    lastUpdated: row.updatedAt || row.lastUpdated || "",
    description: `${label}: ${row.description || row.category || row.relatedDomain || row.id}`,
  }));
}

function evidenceFindings(evidenceRequirements = [], evidenceRecords = [], frameworkName) {
  return evidenceRequirements.filter((row) => isApplicable(row) && !hasEvidence(row, evidenceRecords)).map((row) => finding({
    id: `Evidence:${row.id}`,
    name: row.title || row.name || row.id,
    category: "Evidence",
    framework: frameworkName,
    domain: row.relatedDomain || row.domain || row.category || "Evidence",
    relatedItemId: row.id,
    severity: "High",
    owner: row.owner || "Compliance",
    dueDate: row.dueDate || "",
    lastUpdated: row.updatedAt || "",
    description: `Missing Evidence: ${row.description || row.requiredEvidence || row.id}`,
  }));
}

function policyFindings(policies = [], policySnapshot = {}, frameworkName) {
  const snapshotRows = Array.isArray(policySnapshot.library) ? policySnapshot.library : [];
  const rows = policies.length ? policies : snapshotRows;
  return rows.filter((row) => isApplicable(row) && !(isComplete(row) || row.status === "Active")).map((row) => finding({
    id: `Policies:${row.id}`,
    name: row.name || row.title || row.id,
    category: "Policies",
    framework: frameworkName,
    domain: row.relatedDomain || row.category || "Policy",
    relatedItemId: row.id,
    severity: "Medium",
    owner: row.owner || "Unassigned",
    dueDate: row.reviewDate || row.dueDate || "",
    lastUpdated: row.updatedAt || row.effectiveDate || "",
    description: `Missing Policy: ${row.description || row.id}`,
  }));
}

function riskFindings(risks = [], frameworkName) {
  return risks.filter((risk) => isApplicable(risk) && ["Open", "In Progress"].includes(risk.treatmentStatus)).map((risk) => finding({
    id: `Risks:${risk.id}`,
    name: risk.riskName || risk.title || risk.id,
    category: "Risks",
    framework: frameworkName,
    domain: risk.relatedDomain || risk.category || "Risk",
    relatedItemId: risk.id,
    severity: severityForRow(risk, "Risks"),
    owner: risk.riskOwner || risk.owner || "Unassigned",
    dueDate: risk.reviewDate || risk.dueDate || "",
    lastUpdated: risk.updatedAt || "",
    description: `Open Risk: ${risk.description || risk.relatedDomain || risk.id}`,
  }));
}

function trainingFindings(training = {}, frameworkName) {
  const library = Array.isArray(training.library) ? training.library : [];
  const assignments = training.assignments || {};
  const completions = training.completions || {};

  return library.filter((item) => {
    const assigned = assignments[item.id] || [];
    const completed = assigned.filter((employeeId) => Boolean(completions[item.id]?.[employeeId]));
    return assigned.length > completed.length;
  }).map((item) => {
    const assigned = assignments[item.id] || [];
    const completed = assigned.filter((employeeId) => Boolean(completions[item.id]?.[employeeId]));
    return finding({
      id: `Training:${item.id}`,
      name: item.name || item.title || item.id,
      category: "Training",
      framework: item.relatedFrameworks?.[0] || frameworkName,
      domain: "Training",
      relatedItemId: item.id,
      severity: isOverdue(item.dueDate) ? "High" : "Low",
      owner: "HR",
      dueDate: item.dueDate || "",
      lastUpdated: item.updatedAt || "",
      description: `Pending Training: ${assigned.length - completed.length} completion(s) remaining.`,
    });
  });
}

function finding(input) {
  return {
    status: "Open",
    path: MODULE_PATHS[input.category] || "/audits",
    ...input,
  };
}

function applyReviewState(findings, reviews = {}) {
  return findings.map((findingItem) => {
    const review = reviews[findingItem.id];
    if (!review) return findingItem;
    return {
      ...findingItem,
      status: review.status === "Reviewed" ? "Reviewed" : findingItem.status,
      reviewer: review.reviewer,
      reviewedAt: review.reviewedAt,
      reviewComments: review.comments || "",
      lastUpdated: review.reviewedAt || findingItem.lastUpdated,
    };
  });
}

function getCompletionStats(rows = []) {
  const applicable = rows.filter(isApplicable);
  const completed = applicable.filter(isComplete).length;
  const incomplete = Math.max(applicable.length - completed, 0);
  return {
    total: rows.length,
    applicable: applicable.length,
    completed,
    incomplete,
    percentage: applicable.length ? Math.round((completed / applicable.length) * 100) : 0,
  };
}

function getImplementationRows(implementations = {}) {
  if (Array.isArray(implementations.implementations)) return implementations.implementations;
  if (Array.isArray(implementations.populations)) return implementations.populations;
  return [];
}

function getEvidenceStats(evidenceRequirements = [], evidenceRecords = []) {
  const applicable = evidenceRequirements.filter(isApplicable);
  const covered = applicable.filter((requirement) => hasEvidence(requirement, evidenceRecords));
  const missingItems = applicable.filter((requirement) => !hasEvidence(requirement, evidenceRecords));

  return {
    total: evidenceRequirements.length,
    applicable: applicable.length,
    covered: covered.length,
    missing: missingItems.length,
    coverage: applicable.length ? Math.round((covered.length / applicable.length) * 100) : 0,
    missingItems,
  };
}

function getPolicyStats(policies = []) {
  const applicable = policies.filter(isApplicable);
  const completed = applicable.filter((policy) => isComplete(policy) || policy.status === "Active").length;
  const missing = Math.max(applicable.length - completed, 0);

  return {
    rows: policies,
    total: policies.length,
    applicable: applicable.length,
    completed,
    missing,
    percentage: applicable.length ? Math.round((completed / applicable.length) * 100) : 0,
  };
}

function getRiskStats(risks = []) {
  const applicable = risks.filter(isApplicable);
  const open = applicable.filter((risk) => ["Open", "In Progress"].includes(risk.treatmentStatus || risk.status)).length;
  const closed = Math.max(applicable.length - open, 0);

  return {
    total: risks.length,
    applicable: applicable.length,
    open,
    closed,
    percentage: applicable.length ? Math.round((closed / applicable.length) * 100) : 100,
  };
}

function getTrainingStats(training = {}) {
  const library = Array.isArray(training.library) ? training.library : [];
  const totalAssigned = training.totalAssigned ?? 0;
  const totalCompleted = training.totalCompleted ?? 0;
  return {
    total: library.length,
    assigned: totalAssigned,
    completed: totalCompleted,
    incomplete: Math.max(totalAssigned - totalCompleted, 0),
    percentage: totalAssigned ? Math.round((totalCompleted / totalAssigned) * 100) : 100,
  };
}

function buildTimeline({ questionnaire = {}, activeEvidence = [], policies = [], risks = [], training = {}, reviews = {}, workspaceData = {}, frameworkName }) {
  const events = [];
  if (Object.keys(questionnaire.responses || {}).length) {
    events.push(event("Questionnaire Completed", frameworkName, latestResponseTimestamp(questionnaire), "Questionnaire"));
  }
  activeEvidence.forEach((record) => {
    events.push(event("Evidence Uploaded", record.title || record.metadata?.fileName || record.id, record.createdAt || record.metadata?.uploadedAt, "Evidence"));
    (record.auditHistory || []).forEach((history) => events.push(event(titleCase(history.action || "Evidence Updated"), record.title || record.id, history.timestamp || history.createdAt, "Evidence")));
  });
  policies.filter((policy) => policy.status === "Active").forEach((policy) => {
    events.push(event("Policy Published", policy.name || policy.title || policy.id, policy.effectiveDate || policy.updatedAt, "Policies"));
  });
  risks.forEach((risk) => {
    events.push(event("Risk Created", risk.riskName || risk.title || risk.id, risk.createdAt, "Risks"));
    if (["Mitigated", "Accepted"].includes(risk.treatmentStatus)) {
      events.push(event("Risk Closed", risk.riskName || risk.title || risk.id, risk.updatedAt || risk.reviewDate, "Risks"));
    }
  });
  Object.entries(training.completions || {}).forEach(([trainingId, completions]) => {
    Object.values(completions || {}).forEach((completion) => {
      events.push(event("Training Completed", trainingId, completion.completedAt, "Training"));
    });
  });
  Object.values(reviews || {}).forEach((review) => {
    events.push(event("Audit Review Completed", review.reviewer || "Reviewer", review.reviewedAt, "Audit"));
  });
  Object.entries(workspaceData || {}).forEach(([itemId, state]) => {
    if (isComplete(state)) events.push(event("Control Implemented", itemId, state.updatedAt || state.completedAt, "Controls"));
  });

  return events
    .filter((item) => item.timestamp)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 20);
}

function event(name, detail, timestamp, category) {
  return {
    id: `${name}:${detail}:${timestamp}`,
    name,
    detail,
    timestamp,
    category,
  };
}

function hasEvidence(requirement, evidenceRecords) {
  if (isComplete(requirement)) return true;
  const linkedIds = [
    requirement.id,
    ...(requirement.linkedControls || []),
    ...(requirement.relatedControls || []),
    ...(requirement.linkedTests || []),
    ...(requirement.relatedTests || []),
  ].filter(Boolean);

  return evidenceRecords.some((record) => {
    const recordLinks = [
      record.id,
      record.evidenceId,
      record.linkedTest,
      record.linkedTestId,
      record.testId,
      record.metadata?.linkedTest,
      ...(record.linkedControls || []),
      ...(record.linkedControlIds || []),
      ...(record.controlIds || []),
      ...(record.metadata?.linkedControls || []),
      ...(record.mappings || []).map((mapping) => mapping.controlId),
      ...(record.mappings || []).map((mapping) => mapping.testId),
    ].filter(Boolean);
    return linkedIds.some((id) => recordLinks.includes(id));
  });
}

function isApplicable(row) {
  return row?.applicabilityStatus !== QUESTIONNAIRE_STATUSES.NOT_APPLICABLE && row?.status !== QUESTIONNAIRE_STATUSES.NOT_APPLICABLE;
}

function isComplete(row) {
  const status = String(row?.status || row?.applicabilityStatus || row?.treatmentStatus || "").toLowerCase();
  return ["completed", "complete", "implemented", "approved", "active", "mitigated", "accepted"].includes(status);
}

function questionnaireReadiness(questionnaire = {}) {
  const responses = questionnaire.responses || {};
  if (Object.keys(responses).length === 0) return 0;
  return questionnaireFindings(questionnaire, "Framework").length ? 75 : 100;
}

function severityForRow(row, category) {
  const severity = row.riskLevel || row.severity || row.impact || "";
  if (AUDIT_SEVERITIES.includes(severity)) return severity;
  if (category === "Controls" && row.applicabilityStatus === QUESTIONNAIRE_STATUSES.PENDING_ASSESSMENT) return "High";
  if (category === "Tests") return "Medium";
  if (category === "Training") return "Low";
  return "Medium";
}

function countSeverity(findings, severity) {
  return findings.filter((finding) => finding.severity === severity).length;
}

function averageReadiness(values) {
  const usable = values.filter((value) => Number.isFinite(value));
  if (!usable.length) return 0;
  return Math.round(usable.reduce((sum, value) => sum + value, 0) / usable.length);
}

function latestResponseTimestamp(questionnaire = {}) {
  return questionnaire.updatedAt || "";
}

function getFrameworkName(activeFramework) {
  return activeFramework?.shortName || activeFramework?.name || activeFramework?.id || "Framework";
}

function isOverdue(date) {
  return Boolean(date && new Date(date).getTime() < Date.now());
}

function titleCase(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
