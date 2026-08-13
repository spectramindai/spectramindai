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
  title: "Auditor",
  description: "Auditor review and collaboration workspace.",
};

const cmmcLibrary = getFrameworkLibrary(CMMC_FRAMEWORK_ID) || emptyFrameworkLibrary();
const auditorRows = buildAuditorRows(cmmcLibrary);

export default function CMMCAuditorPage() {
  const module = useCMMCModule("auditor") || fallbackModule;
  const { scopeAnswers, organizationProfile, controlWorkflowFields, evidenceWorkflowFields } = useCMMCWorkflowState();
  const frameworkName = cmmcLibrary.framework?.name || module.title;
  const auditorWorkflowContext = useMemo(
    () => buildAuditorWorkflowContext(frameworkName, organizationProfile, scopeAnswers),
    [frameworkName, organizationProfile, scopeAnswers]
  );
  const workflowAuditorRows = useMemo(
    () => auditorRows.map((row) => applyAuditorWorkflowFields(row, evidenceWorkflowFields, controlWorkflowFields)),
    [controlWorkflowFields, evidenceWorkflowFields]
  );

  return (
    <CMMCPageLayout
      eyebrow="CMMC Workspace"
      title={module.title}
      description={module.description}
    >
      <CMMCSectionCard
        title="Auditor framework review"
        description={`${frameworkName} controls and mapped evidence from the framework library.`}
        actions={<CMMCStatusBadge tone="info">{workflowAuditorRows.length} Controls</CMMCStatusBadge>}
      >
        <div className="overflow-x-auto">
          <table
            className="w-full min-w-[1160px] text-left text-sm"
            aria-label={auditorWorkflowContext}
          >
            <caption className="sr-only">{auditorWorkflowContext}</caption>
            <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-black uppercase tracking-wide text-slate-400">
              <tr>
                <th className="w-28 px-4 py-3">Control ID</th>
                <th className="w-44 px-4 py-3">Family / Domain</th>
                <th className="px-4 py-3">Control Requirement</th>
                <th className="px-4 py-3">Evidence to Request</th>
                <th className="w-32 px-4 py-3">Evidence Status</th>
                <th className="w-36 px-4 py-3">Owner</th>
                <th className="w-36 px-4 py-3">Date Collected</th>
                <th className="w-40 px-4 py-3">Source System</th>
                <th className="w-40 px-4 py-3">Notes / Gaps</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {workflowAuditorRows.map((row) => (
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

function applyAuditorWorkflowFields(row, evidenceWorkflowFields = {}, controlWorkflowFields = {}) {
  const fieldOverrides = findAuditorWorkflowFields(row, evidenceWorkflowFields);
  const evidenceStatus = workflowFieldValue(fieldOverrides, "evidenceStatus", row.evidenceStatus);

  return {
    ...row,
    evidenceStatus: workflowFieldValue(controlWorkflowFields[row.controlId], "status", evidenceStatus),
    ownerCollector: workflowFieldValue(fieldOverrides, "ownerCollector", row.ownerCollector),
    dateCollected: workflowFieldValue(fieldOverrides, "dateCollected", row.dateCollected),
    sourceSystemTool: workflowFieldValue(fieldOverrides, "sourceSystemTool", row.sourceSystemTool),
    notesGaps: workflowFieldValue(fieldOverrides, "notesGaps", row.notesGaps),
  };
}

function findAuditorWorkflowFields(row, evidenceWorkflowFields) {
  const workflowKeys = [row.key, ...(row.workflowKeys || [])];
  return workflowKeys.reduce((matchedFields, workflowKey) => {
    const fieldOverrides = evidenceWorkflowFields[workflowKey];
    return fieldOverrides ? { ...matchedFields, ...fieldOverrides } : matchedFields;
  }, {});
}

function workflowFieldValue(fieldOverrides, field, fallback) {
  return Object.prototype.hasOwnProperty.call(fieldOverrides || {}, field) ? fieldOverrides[field] : fallback;
}

function buildAuditorWorkflowContext(frameworkName, organizationProfile = {}, scopeAnswers = {}) {
  const cuiFlow = organizationProfile.cuiFlow || {};
  const workforce = organizationProfile.workforce || {};
  const externalConnections = organizationProfile.externalConnections || {};
  const contextLines = [
    workflowContextLine("Organization Name", organizationProfile.organizationName),
    workflowContextLine("Organization Type", organizationProfile.organizationType),
    workflowContextLine("System Name", organizationProfile.systemName),
    workflowContextLine("Scope Information", [
      scopeAnswers.systemBoundaryScope,
      cuiFlow.flowDescription,
      cuiFlow.receivedFrom,
      cuiFlow.storageLocations,
      cuiFlow.transmissionMethods,
      cuiFlow.retentionPeriod,
    ]),
    workflowContextLine("CUI Types", organizationProfile.cuiTypes),
    workflowContextLine("Cloud Platforms", organizationProfile.cloudPlatforms),
    workflowContextLine("Email Platform", organizationProfile.emailPlatform),
    workflowContextLine("Storage Platform", organizationProfile.storagePlatform),
    workflowContextLine("Devices", organizationProfile.devices),
    workflowContextLine("Workforce", [
      workforce.cuiEmployeeAccess,
      workforce.remoteEmployees,
      workforce.byodUse,
      workforce.dedicatedItSupport,
    ]),
    workflowContextLine("External Connections", [
      externalConnections.vpnRequired,
      externalConnections.thirdPartyAccess,
      externalConnections.govPortals,
      externalConnections.connectionReview,
      externalConnections.interconnectionNotes,
    ]),
  ].filter(Boolean);

  const baseContext = `${frameworkName} controls and mapped evidence from the framework library.`;
  return contextLines.length ? `${baseContext} Workflow context: ${contextLines.join("; ")}.` : baseContext;
}

function workflowContextLine(label, value) {
  const formattedValue = formatWorkflowContextValue(value);
  return formattedValue ? `${label}: ${formattedValue}` : "";
}

function formatWorkflowContextValue(value) {
  if (Array.isArray(value)) {
    return value.map(formatWorkflowContextValue).filter(Boolean).join(", ");
  }

  return String(value ?? "").trim();
}

function buildAuditorRows(library) {
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
