import {
  CMMC_FRAMEWORK_ID,
  getFrameworkLibrary,
} from "../../../core/engines/framework-engine/frameworkRegistry";

const cmmcLibrary = getFrameworkLibrary(CMMC_FRAMEWORK_ID) || emptyFrameworkLibrary();
export function buildCMMCPolicyDocumentRows({
  controlWorkflowFields = {},
  evidenceWorkflowFields = {},
  frameworkLibrary = cmmcLibrary,
} = {}) {
  const evidenceRows = buildEvidenceRows(frameworkLibrary).map((row) => {
    const evidenceFieldOverrides = evidenceWorkflowFields[row.key] || {};
    const controlFieldOverrides = controlWorkflowFields[row.controlId] || {};
    const workflowStatus = workflowFieldValue(
      controlFieldOverrides,
      "status",
      workflowFieldValue(evidenceFieldOverrides, "evidenceStatus", row.evidenceStatus)
    );
    const policyStatus = toCMMCPolicyDocumentStatus(workflowStatus);

    return {
      ...row,
      evidenceStatus: policyStatus,
      policyStatus,
      workflowStatus: normalizeWorkflowStatus(workflowStatus),
      ownerCollector: workflowFieldValue(
        controlFieldOverrides,
        "owner",
        workflowFieldValue(evidenceFieldOverrides, "ownerCollector", row.ownerCollector)
      ),
      dateCollected: workflowFieldValue(evidenceFieldOverrides, "dateCollected", row.dateCollected),
      sourceSystemTool: workflowFieldValue(evidenceFieldOverrides, "sourceSystemTool", row.sourceSystemTool),
      notesGaps: workflowFieldValue(evidenceFieldOverrides, "notesGaps", row.notesGaps),
      attachments: Array.isArray(controlFieldOverrides?.attachments) ? controlFieldOverrides.attachments : [],
    };
  });

  const rowsByControl = new Map();
  evidenceRows.forEach((row) => {
    if (!row.controlId || rowsByControl.has(row.controlId)) return;
    rowsByControl.set(row.controlId, {
      ...row,
      title: `${row.controlId} Control Policy`,
      description: row.requirement,
      linkedControls: [row.controlId],
      controlCount: 1,
      evidenceRequests: [row.evidence].filter(Boolean),
    });
  });

  return Array.from(rowsByControl.values());
}

export function buildCMMCPolicyDocumentMetrics(rows = []) {
  const totalPolicies = rows.length;
  const publishedPolicies = rows.filter((row) => row.policyStatus === "Published").length;
  const inProgressPolicies = rows.filter((row) => row.policyStatus === "In Progress").length;
  const notStartedPolicies = rows.filter((row) => row.policyStatus === "Not Started").length;
  const remainingPolicies = Math.max(totalPolicies - publishedPolicies, 0);

  return {
    totalPolicies,
    publishedPolicies,
    inProgressPolicies,
    notStartedPolicies,
    remainingPolicies,
    publishedPercentage: totalPolicies ? Math.round((publishedPolicies / totalPolicies) * 100) : 0,
    evidenceCount: totalPolicies,
    controlCount: new Set(rows.map((row) => row.controlId).filter(Boolean)).size,
    familyCount: new Set(rows.map((row) => row.domain).filter(Boolean)).size,
    blankStatusCount: notStartedPolicies,
  };
}

export function toCMMCPolicyDocumentStatus(status) {
  const normalizedStatus = normalizeWorkflowStatus(status);
  if (normalizedStatus === "Completed") return "Published";
  if (normalizedStatus === "In Progress") return "In Progress";
  return "Not Started";
}

function buildEvidenceRows(library) {
  const controlsById = new Map(
    (library.controls || []).map((control) => [
      control.controlId || control["Control ID"] || control.id,
      control,
    ])
  );
  const evidenceById = new Map((library.evidence || []).map((evidence) => [evidence.id, evidence]));

  return (library.mappings || []).flatMap((mapping, mappingIndex) => {
    const control = controlsById.get(mapping.controlId);
    const evidenceIds = mapping.evidenceRequirementIds || mapping.evidenceIds || [];

    return evidenceIds.map((evidenceId, evidenceIndex) => {
      const evidence = evidenceById.get(evidenceId) || {};
      const controlId = mapping.controlId || evidence.controlId || control?.controlId || control?.["Control ID"] || "";
      const controlFamily = evidence.controlFamily || evidence["Control Family"] || control?.controlFamily || control?.["Control Family"] || "";
      const { domain, family, section } = parseControlFamily(controlFamily, controlId);

      return {
        key: `${controlId}-${evidenceId || evidenceIndex}`,
        poamId: "",
        section,
        domain,
        family,
        controlId,
        requirement: control?.controlRequirement || control?.["Control Requirement"] || evidence["Control Requirement"] || "",
        evidence: evidence.evidenceToRequest || evidence["Evidence to Request"] || "",
        publicNotesUse: evidence.publicNotesUse || evidence["Public Notes / Use"] || "",
        evidenceStatus: evidence.evidenceStatus || evidence["Evidence Status"] || "",
        ownerCollector: evidence.ownerCollector || evidence["Owner / Collector"] || "",
        dateCollected: evidence.dateCollected || evidence["Date Collected"] || "",
        sourceSystemTool: evidence.sourceSystemTool || evidence["Source System / Tool"] || "",
        notesGaps: evidence.notesGaps || evidence["Notes / Gaps"] || "",
        sourceOrder: mapping.sourceOrder ?? evidence._sourceOrder ?? control?._sourceOrder ?? mappingIndex,
      };
    });
  });
}

function workflowFieldValue(fieldOverrides, field, fallback) {
  return Object.prototype.hasOwnProperty.call(fieldOverrides || {}, field) ? fieldOverrides[field] : fallback;
}

function normalizeWorkflowStatus(status) {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "completed" || normalized === "published") return "Completed";
  if (normalized === "in progress" || normalized === "in_progress") return "In Progress";
  if (normalized === "not applicable" || normalized === "not_applicable") return "Not Applicable";
  return "Not Started";
}

function parseControlFamily(controlFamily, controlId) {
  const [domainPart, ...familyNameParts] = String(controlFamily || "").split(" - ");
  const domain = domainPart || String(controlId || "").split(".")[0] || "";
  const family = familyNameParts.join(" - ") || controlFamily || domain;
  const section = String(controlId || "").match(/L2-(3\.\d+)/)?.[1] || "";

  return { domain, family, section };
}

function emptyFrameworkLibrary() {
  return {
    controls: [],
    evidence: [],
    mappings: [],
  };
}
