import { AlertTriangle, CircleDot } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CMMC_FRAMEWORK_ID,
  getFrameworkLibrary,
} from "../../../core/engines/framework-engine/frameworkRegistry";
import { CMMCImplementationLayout } from "../components";
import { CMMC_CONTROL_WORKFLOW_STATUS_OPTIONS, useCMMCSPRSCalculation, useCMMCWorkflowState } from "../hooks";

const cmmcLibrary = getFrameworkLibrary(CMMC_FRAMEWORK_ID) || emptyFrameworkLibrary();
const baseGapItems = buildGapItems(cmmcLibrary);

export default function CMMCGapWizardPage() {
  const { controlWorkflowFields, updateControlWorkflowStatus } = useCMMCWorkflowState();
  const sprsMetrics = useCMMCSPRSCalculation();
  const [reviewStarted, setReviewStarted] = useState(false);
  const [activeGapIndex, setActiveGapIndex] = useState(0);
  const sprsStatusByControl = useMemo(
    () => new Map((sprsMetrics.controls || []).map((control) => [control.controlId, control.displayStatus || displayStatus(control.status)])),
    [sprsMetrics.controls]
  );
  const gapItems = useMemo(
    () => applyGapWorkflowFields(baseGapItems, controlWorkflowFields, sprsStatusByControl).filter((gap) => !isCompletedStatus(gap.evidenceStatus)),
    [controlWorkflowFields, sprsStatusByControl]
  );
  const gapMetrics = useMemo(() => buildGapMetrics(cmmcLibrary, gapItems, sprsMetrics), [gapItems, sprsMetrics]);
  const activeGap = gapItems[activeGapIndex] || emptyGapItem();

  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      setActiveGapIndex((current) => Math.min(current, Math.max(gapItems.length - 1, 0)));
    });
    return () => cancelAnimationFrame(frameId);
  }, [gapItems.length]);

  return (
    <CMMCImplementationLayout>
      <div className="mx-auto max-w-[760px] space-y-3 pt-6">
        <div className="flex flex-col gap-3 rounded-md border border-amber-300 bg-[#fff3bf] px-4 py-3 text-amber-950 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle size={17} className="shrink-0 text-amber-700" />
            <p className="text-[13px] font-black leading-5">
              System scope not completed.
              <span className="ml-2 font-semibold text-amber-800">
                Some controls may not reflect your actual environment.
              </span>
            </p>
          </div>
          <Link
            to="/cmmc"
            className="inline-flex min-h-8 shrink-0 items-center justify-center rounded-md border border-amber-200 bg-white px-3 text-[12px] font-black text-slate-700 shadow-sm transition hover:bg-amber-50"
          >
            Complete Scoping →
          </Link>
        </div>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl shadow-slate-900/5">
          <div className="bg-gradient-to-r from-[#1d123f] to-[#684cf5] px-7 py-6 text-white">
            <div className="flex items-center gap-2">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-amber-300 text-[#1d123f]">
                <CircleDot size={12} />
              </span>
              <h1 className="text-xl font-black tracking-normal">Gap Wizard</h1>
            </div>
            <p className="mt-2 text-[13px] font-semibold leading-5 text-violet-100">
              Walk through your open gaps one at a time, plain English explanations, concrete action steps, highest impact first.
            </p>
          </div>

          <div className="grid border-b border-slate-100 text-center sm:grid-cols-3">
            <ProgressMetric value={gapMetrics.openGaps} label="Open Gaps" />
            <ProgressMetric value={gapMetrics.criticalGaps} label="Critical (5-PT)" />
            <ProgressMetric value={gapMetrics.currentSPRS} label="Current SPRS" />
          </div>

          <div className="space-y-5 px-7 py-6 text-[13px] font-semibold leading-6 text-slate-600">
            <p>
              The wizard will show you each incomplete control starting with the highest-value ones. For each control you will see what it actually means in plain English, what "done" looks like for a small business, and specific first steps to take.
            </p>
            <p>
              As you work through gaps and mark controls complete in the <strong className="text-slate-900">Organization</strong> tab, your SPRS score updates in real time. You're currently at risk of losing <strong className="text-slate-900">{gapMetrics.pointsAtRisk} SPRS points</strong> from the maximum score of {gapMetrics.maximumSPRS}.
            </p>

            <button
              type="button"
              onClick={() => setReviewStarted(true)}
              className="inline-flex min-h-10 items-center justify-center rounded-md bg-[#5b4bea] px-5 text-[13px] font-black text-white shadow-lg shadow-violet-600/20 transition hover:bg-[#4f40dc]"
            >
              Start Reviewing My {gapMetrics.openGaps} Gaps {"\u2192"}
            </button>

            {reviewStarted && (
              <GapReview
                gap={activeGap}
                currentIndex={activeGapIndex}
                total={gapItems.length}
                onStatusChange={(status) => updateControlWorkflowStatus(activeGap.workflowKey, status, { source: "gap-wizard" })}
                onPrevious={() => setActiveGapIndex((current) => Math.max(current - 1, 0))}
                onNext={() => setActiveGapIndex((current) => Math.min(current + 1, gapItems.length - 1))}
              />
            )}
          </div>
        </section>
      </div>
    </CMMCImplementationLayout>
  );
}

function GapReview({ gap, currentIndex, total, onStatusChange, onPrevious, onNext }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
            Gap {total ? currentIndex + 1 : 0} of {total}
          </p>
          <h2 className="mt-1 text-base font-black text-slate-900">{gap.controlId}</h2>
        </div>
        <span className="w-fit rounded bg-violet-100 px-2 py-1 text-xs font-black text-violet-700">
          {gap.domain}
        </span>
      </div>

      <div className="mt-4 space-y-3">
        <GapField label="Control Family / Domain" value={gap.controlFamily} />
        <GapField label="Control Requirement" value={gap.requirement} />
        <GapField label="Evidence to Request" value={gap.evidence} />
        <GapStatusField value={gap.evidenceStatus || ""} onChange={onStatusChange} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onPrevious}
          disabled={currentIndex === 0}
          className="inline-flex min-h-8 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-[12px] font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Previous Gap
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!total || currentIndex >= total - 1}
          className="inline-flex min-h-8 items-center justify-center rounded-md bg-[#5b4bea] px-3 text-[12px] font-black text-white transition hover:bg-[#4f40dc] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next Gap
        </button>
      </div>
    </section>
  );
}

function GapStatusField({ value, onChange }) {
  return (
    <div>
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Workflow Status</p>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-8 w-full rounded border border-slate-200 bg-white px-2 text-xs font-bold text-slate-600 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-200"
      >
        <option value=""></option>
        {CMMC_CONTROL_WORKFLOW_STATUS_OPTIONS.map((statusOption) => (
          <option key={statusOption} value={statusOption}>{statusOption}</option>
        ))}
      </select>
    </div>
  );
}

function GapField({ label, value }) {
  return (
    <div>
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-[13px] font-semibold leading-6 text-slate-700">{value}</p>
    </div>
  );
}

function ProgressMetric({ value, label }) {
  return (
    <div className="border-slate-100 px-4 py-6 sm:border-r last:sm:border-r-0">
      <p className="text-3xl font-black leading-none text-red-500">{value}</p>
      <p className="mt-2 text-[10px] font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>
    </div>
  );
}

function applyGapWorkflowFields(items, controlWorkflowFields = {}, sprsStatusByControl = new Map()) {
  return items.map((item) => ({
    ...item,
    evidenceStatus: workflowFieldValue(controlWorkflowFields[item.workflowKey], "status", sprsStatusByControl.get(item.workflowKey) || item.evidenceStatus),
  }));
}

function workflowFieldValue(fieldOverrides, field, fallback) {
  return Object.prototype.hasOwnProperty.call(fieldOverrides || {}, field) ? fieldOverrides[field] : fallback;
}

function isCompletedStatus(status) {
  return String(status ?? "").trim().toLowerCase() === "completed";
}

function buildGapItems(library) {
  const controlsById = new Map((library.controls || []).map((control) => [control.controlId || control["Control ID"] || control.id, control]));
  const evidenceById = new Map((library.evidence || []).map((evidence) => [evidence.id, evidence]));

  return (library.mappings || []).flatMap((mapping, mappingIndex) => {
    const control = controlsById.get(mapping.controlId) || {};
    const evidenceItems = (mapping.evidenceRequirementIds || mapping.evidenceIds || [])
      .map((evidenceId) => evidenceById.get(evidenceId))
      .filter(Boolean);
    const firstEvidence = evidenceItems[0] || {};
    const controlId = mapping.controlId || control.controlId || control["Control ID"] || firstEvidence.controlId || "";
    const controlFamily = control.controlFamily || control["Control Family"] || firstEvidence.controlFamily || firstEvidence["Control Family"] || "";
    const evidenceStatus = firstEvidenceField(evidenceItems, "evidenceStatus", "Evidence Status");

    return [
      {
        key: `${controlId}-${mapping.sourceOrder ?? mappingIndex}`,
        workflowKey: controlId,
        controlId,
        controlFamily,
        domain: parseControlDomain(controlFamily, controlId),
        requirement: control.controlRequirement || control["Control Requirement"] || firstEvidence["Control Requirement"] || "",
        evidence: joinedEvidenceField(evidenceItems, "evidenceToRequest", "Evidence to Request"),
        evidenceStatus,
        ownerCollector: firstEvidenceField(evidenceItems, "ownerCollector", "Owner / Collector"),
        dateCollected: firstEvidenceField(evidenceItems, "dateCollected", "Date Collected"),
        sourceSystemTool: firstEvidenceField(evidenceItems, "sourceSystemTool", "Source System / Tool"),
        notesGaps: firstEvidenceField(evidenceItems, "notesGaps", "Notes / Gaps"),
      },
    ];
  });
}

function buildGapMetrics(library, items, sprsMetrics = {}) {
  const hasMappings = Boolean((library.mappings || []).length);

  return {
    openGaps: Number(sprsMetrics.openGapCount) || (hasMappings ? items.length : library.framework?.controlCount || 0),
    criticalGaps: Number(sprsMetrics.criticalGapCount) || 0,
    currentSPRS: formatNumber(sprsMetrics.currentSPRSScore),
    pointsAtRisk: formatNumber(sprsMetrics.pointsAtRisk),
    maximumSPRS: formatNumber(sprsMetrics.scoreRange?.maximum ?? 110),
  };
}

function displayStatus(status) {
  return {
    IMPLEMENTED: "Completed",
    NOT_APPLICABLE: "Not Applicable",
    PARTIALLY_IMPLEMENTED: "Partially Implemented",
    IN_PROGRESS: "In Progress",
    PLANNED: "Planned",
    NOT_STARTED: "Not Started",
  }[status] || "";
}

function formatNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? String(Math.round(number)) : "0";
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

function emptyGapItem() {
  return {
    controlId: "",
    controlFamily: "",
    domain: "",
    requirement: "",
    evidence: "",
    evidenceStatus: "",
    workflowKey: "",
  };
}

function emptyFrameworkLibrary() {
  return {
    framework: {},
    controls: [],
    evidence: [],
    mappings: [],
  };
}
