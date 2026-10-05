import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  CMMC_FRAMEWORK_ID,
  getFrameworkLibrary,
} from "../../../core/engines/framework-engine/frameworkRegistry";
import {
  CMMCPageLayout,
  CMMCProgressBar,
  CMMCSectionCard,
  CMMCStatusBadge,
  useCMMCWorkspaceFilters,
} from "../components";
import { useCMMCModule, useCMMCWorkflowState } from "../hooks";

const cmmcLibrary = getFrameworkLibrary(CMMC_FRAMEWORK_ID) || { controls: [], evidence: [], mappings: [] };
const controls = buildControls(cmmcLibrary);

export default function CMMCOperationalModulePage({ moduleId, domainId = "" }) {
  const module = useCMMCModule(moduleId) || {
    title: "CMMC Workspace",
    description: "CMMC Level 2 operational workspace.",
  };
  const { searchQuery, domainFilter, statusFilter } = useCMMCWorkspaceFilters();
  const { controlWorkflowFields, evidenceWorkflowFields } = useCMMCWorkflowState();
  const workflowControls = useMemo(
    () => controls.map((control) => applyWorkflow(control, controlWorkflowFields, evidenceWorkflowFields)),
    [controlWorkflowFields, evidenceWorkflowFields]
  );
  const visibleControls = useMemo(
    () => filterControls(workflowControls, { searchQuery, domainFilter, statusFilter, domainId }),
    [domainFilter, domainId, searchQuery, statusFilter, workflowControls]
  );

  return (
    <CMMCPageLayout eyebrow="CMMC Level 2 Workspace" title={module.title} description={module.description}>
      <div className="space-y-4">
        <ModuleContent
          moduleId={moduleId}
          controls={visibleControls}
          allControls={workflowControls}
        />
      </div>
    </CMMCPageLayout>
  );
}

function ModuleContent(props) {
  switch (props.moduleId) {
    case "domain-summary":
    case "domain-details":
      return <DomainWorkspace {...props} />;
    default:
      return <ControlsWorkspace {...props} />;
  }
}

function DomainWorkspace({ allControls, controls }) {
  const domains = aggregateDomains(allControls);
  return (
    <>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {domains.map((domain) => (
          <Link key={domain.code} to={`/cmmc/domains/${domain.code.toLowerCase()}`} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-violet-300">
            <p className="text-xs font-black uppercase text-violet-700">{domain.code}</p>
            <p className="mt-1 font-black text-slate-900">{domain.name}</p>
            <CMMCProgressBar value={domain.percentage} className="mt-4" />
            <p className="mt-2 text-xs font-semibold text-slate-500">{domain.completed} / {domain.total} completed</p>
          </Link>
        ))}
      </div>
      <CMMCSectionCard title="Domain controls" description={`${controls.length} controls match the selected domain and workspace filters.`}>
        <ControlTable controls={controls} />
      </CMMCSectionCard>
    </>
  );
}

function ControlsWorkspace({ controls }) {
  return <CMMCSectionCard title="Level 2 controls" description={`${controls.length} controls match the selected filters.`}><ControlTable controls={controls} /></CMMCSectionCard>;
}

function ControlTable({ controls: rows, extraHeader = [], children }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="border-y border-slate-100 bg-slate-50 text-[11px] font-black uppercase text-slate-400"><tr><th className="px-3 py-3">Control</th><th className="px-3 py-3">Requirement</th><th className="px-3 py-3">Status</th>{extraHeader.map((header) => <th key={header} className="px-3 py-3">{header}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">{rows.map((control) => <tr key={control.controlId} className="align-top"><td className="px-3 py-3 font-black text-violet-700">{control.controlId}<p className="mt-1 text-[11px] text-slate-400">{control.domain}</p></td><td className="max-w-xl px-3 py-3 text-xs font-semibold leading-5 text-slate-700">{control.requirement}</td><td className="px-3 py-3"><CMMCStatusBadge tone={control.status === "Completed" ? "success" : control.status === "In Progress" ? "warning" : "neutral"}>{control.status}</CMMCStatusBadge></td>{children?.(control)}</tr>)}</tbody>
      </table>
      {!rows.length && <p className="p-8 text-center text-sm font-semibold text-slate-500">No controls match the current filters.</p>}
    </div>
  );
}

function buildControls(library) {
  const evidenceById = new Map((library.evidence || []).map((item) => [item.id, item]));
  const mappings = new Map((library.mappings || []).map((item) => [item.controlId, item]));
  return (library.controls || []).map((control) => {
    const controlId = control.controlId || control.id;
    const mapping = mappings.get(controlId) || {};
    const evidenceItems = (mapping.evidenceRequirementIds || mapping.evidenceIds || []).map((id) => evidenceById.get(id)).filter(Boolean);
    const family = control.controlFamily || "";
    const [domain, ...name] = family.split(" - ");
    return {
      controlId,
      domain,
      domainName: name.join(" - "),
      requirement: control.controlRequirement || "",
      evidence: evidenceItems.map((item) => item.evidenceToRequest || "").filter(Boolean).join(" "),
      status: "Not Started",
      points: 0,
    };
  });
}

function applyWorkflow(control, controlFields, evidenceFields) {
  const evidence = Object.entries(evidenceFields || {}).find(([key]) => key.startsWith(control.controlId))?.[1] || {};
  return {
    ...control,
    status: controlFields?.[control.controlId]?.status || evidence.evidenceStatus || "Not Started",
    owner: evidence.ownerCollector || "",
    dateCollected: evidence.dateCollected || "",
    source: evidence.sourceSystemTool || "",
    notes: evidence.notesGaps || "",
  };
}

function filterControls(rows, { searchQuery, domainFilter, statusFilter, domainId }) {
  const search = String(searchQuery || "").trim().toLowerCase();
  const selectedDomain = domainId ? String(domainId).toUpperCase() : domainFilter;
  return rows.filter((row) => {
    const matchesSearch = !search || [row.controlId,row.domain,row.domainName,row.requirement,row.evidence,row.owner,row.notes].join(" ").toLowerCase().includes(search);
    const matchesDomain = !selectedDomain || selectedDomain === "all" || row.domain === selectedDomain;
    const matchesStatus = !statusFilter || statusFilter === "All" || row.status === statusFilter;
    return matchesSearch && matchesDomain && matchesStatus;
  });
}

function aggregateDomains(rows) {
  const map = new Map();
  rows.forEach((row) => {
    if (!map.has(row.domain)) map.set(row.domain, { code: row.domain, name: row.domainName, total: 0, completed: 0 });
    const domain = map.get(row.domain); domain.total += 1; if (row.status === "Completed") domain.completed += 1;
  });
  return Array.from(map.values()).map((domain) => ({ ...domain, percentage: domain.total ? Math.round((domain.completed / domain.total) * 100) : 0 }));
}
