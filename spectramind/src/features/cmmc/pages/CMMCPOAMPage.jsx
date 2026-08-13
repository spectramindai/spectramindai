import { useMemo } from "react";
import {
  CMMC_FRAMEWORK_ID,
  getFrameworkLibrary,
} from "../../../core/engines/framework-engine/frameworkRegistry";
import {
  CMMCPageLayout,
  CMMCSectionCard,
  CMMCStatusBadge,
} from "../components";
import { useCMMCModule, useCMMCWorkflowState } from "../hooks";

const fallbackModule = {
  title: "POA&M",
  description: "Plan of Action and Milestones tracking foundation.",
};

const cmmcLibrary = getFrameworkLibrary(CMMC_FRAMEWORK_ID) || emptyFrameworkLibrary();
const poamRows = buildPoamRows(cmmcLibrary);

export default function CMMCPOAMPage() {
  const module = useCMMCModule("poam") || fallbackModule;
  const { controlWorkflowFields, evidenceWorkflowFields } = useCMMCWorkflowState();
  const frameworkName = cmmcLibrary.framework?.name || module.title;
  const workflowPoamRows = useMemo(
    () => poamRows
      .map((row) => applyPoamWorkflowFields(row, evidenceWorkflowFields, controlWorkflowFields))
      .filter((row) => !["Completed", "Not Applicable"].includes(row.evidenceStatus)),
    [controlWorkflowFields, evidenceWorkflowFields]
  );

  return (
    <CMMCPageLayout
      eyebrow="CMMC Workspace"
      title={module.title}
      description={module.description}
    >
      <CMMCSectionCard
        title="POA&M framework review"
        description={`${frameworkName} controls and mapped evidence from the framework library.`}
        actions={<CMMCStatusBadge tone="info">{workflowPoamRows.length} Open Items</CMMCStatusBadge>}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-black uppercase tracking-wide text-slate-400">
              <tr>
                <th className="w-28 px-4 py-3">Control ID</th>
                <th className="w-44 px-4 py-3">Family / Domain</th>
                <th className="px-4 py-3">Control Requirement</th>
                <th className="px-4 py-3">Evidence to Request</th>
                <th className="w-32 px-4 py-3">Evidence Status</th>
                <th className="w-36 px-4 py-3">Owner / Collector</th>
                <th className="w-36 px-4 py-3">Date Collected</th>
                <th className="w-40 px-4 py-3">Source System / Tool</th>
                <th className="w-44 px-4 py-3">Notes / Gaps</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {workflowPoamRows.map((row) => (
                <tr key={row.key} className="align-top transition hover:bg-slate-50/70">
                  <td className="px-4 py-3 font-black text-violet-700">{row.controlId}</td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-violet-100 px-2 py-1 text-xs font-black text-violet-700">
                      {row.domain}
                    </span>
                    <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">{row.controlFamily}</p>
                  </td>
                  <td className="px-4 py-3 font-semibold leading-5 text-slate-700">{row.requirement}</td>
                  <td className="px-4 py-3 text-xs font-semibold leading-5 text-violet-600">{row.evidence}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-600">{row.evidenceStatus}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-600">{row.ownerCollector}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-600">{row.dateCollected}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-600">{row.sourceSystemTool}</td>
                  <td className="px-4 py-3 text-xs font-semibold leading-5 text-slate-600">{row.notesGaps}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CMMCSectionCard>
    </CMMCPageLayout>
  );
}

function buildPoamRows(library) {
  const controlsById = new Map((library.controls || []).map((control) => [control.controlId || control["Control ID"] || control.id, control]));
  const evidenceById = new Map((library.evidence || []).map((evidence) => [evidence.id, evidence]));

  return (library.mappings || []).flatMap((mapping, mappingIndex) => {
    const control = controlsById.get(mapping.controlId) || {};
    const evidenceIds = mapping.evidenceRequirementIds || mapping.evidenceIds || [];
    const evidenceItems = evidenceIds.length ? evidenceIds.map((evidenceId) => evidenceById.get(evidenceId)).filter(Boolean) : [{}];
    const firstEvidence = evidenceItems[0] || {};
    const controlId = mapping.controlId || control.controlId || control["Control ID"] || firstEvidence.controlId || "";
    const controlFamily = control.controlFamily || control["Control Family"] || firstEvidence.controlFamily || firstEvidence["Control Family"] || "";
    const workflowKeys = evidenceIds.map((evidenceId, evidenceIndex) => `${controlId}-${evidenceId || evidenceIndex}`);

    return [
      {
        key: `${controlId}-${mapping.sourceOrder ?? mappingIndex}`,
        workflowKeys,
        controlId,
        controlFamily,
        domain: parseControlDomain(controlFamily, controlId),
        requirement: control.controlRequirement || control["Control Requirement"] || firstEvidence["Control Requirement"] || "",
        evidence: joinedEvidenceField(evidenceItems, "evidenceToRequest", "Evidence to Request"),
        evidenceStatus: firstEvidenceField(evidenceItems, "evidenceStatus", "Evidence Status"),
        ownerCollector: firstEvidenceField(evidenceItems, "ownerCollector", "Owner / Collector"),
        dateCollected: firstEvidenceField(evidenceItems, "dateCollected", "Date Collected"),
        sourceSystemTool: firstEvidenceField(evidenceItems, "sourceSystemTool", "Source System / Tool"),
        notesGaps: firstEvidenceField(evidenceItems, "notesGaps", "Notes / Gaps"),
      },
    ];
  });
}

function applyPoamWorkflowFields(row, evidenceWorkflowFields = {}, controlWorkflowFields = {}) {
  const fieldOverrides = findPoamWorkflowFields(row, evidenceWorkflowFields);

  return {
    ...row,
    evidenceStatus: workflowFieldValue(controlWorkflowFields[row.controlId], "status", row.evidenceStatus),
    ownerCollector: workflowFieldValue(fieldOverrides, "poamOwner", workflowFieldValue(fieldOverrides, "ownerCollector", row.ownerCollector)),
    dateCollected: workflowFieldValue(fieldOverrides, "poamDueDate", workflowFieldValue(fieldOverrides, "dateCollected", row.dateCollected)),
    sourceSystemTool: workflowFieldValue(fieldOverrides, "poamResources", workflowFieldValue(fieldOverrides, "sourceSystemTool", row.sourceSystemTool)),
    notesGaps: workflowFieldValue(fieldOverrides, "poamWeakness", workflowFieldValue(fieldOverrides, "notesGaps", row.notesGaps)),
  };
}

function findPoamWorkflowFields(row, evidenceWorkflowFields) {
  const workflowKeys = [row.key, ...(row.workflowKeys || [])];
  return workflowKeys.reduce((matchedFields, workflowKey) => {
    const fieldOverrides = evidenceWorkflowFields[workflowKey];
    return fieldOverrides ? { ...matchedFields, ...fieldOverrides } : matchedFields;
  }, {});
}

function workflowFieldValue(fieldOverrides, field, fallback) {
  return Object.prototype.hasOwnProperty.call(fieldOverrides || {}, field) ? fieldOverrides[field] : fallback;
}

function parseControlDomain(controlFamily, controlId) {
  return controlFamily.split(" - ")[0] || controlId.split(".")[0] || "";
}

function joinedEvidenceField(evidenceItems, camelCaseField, sourceField) {
  if (!evidenceItems.length) return "";
  return evidenceItems
    .map((item) => item[camelCaseField] ?? item[sourceField] ?? "")
    .join("\n");
}

function firstEvidenceField(evidenceItems, camelCaseField, sourceField) {
  if (!evidenceItems.length) return "";
  return evidenceItems[0]?.[camelCaseField] ?? evidenceItems[0]?.[sourceField] ?? "";
}

function emptyFrameworkLibrary() {
  return {
    framework: {},
    controls: [],
    evidence: [],
    mappings: [],
  };
}
