import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  CMMC_FRAMEWORK_ID,
  getFrameworkLibrary,
} from "../../../core/engines/framework-engine/frameworkRegistry";
import { CMMCImplementationLayout, useCMMCWorkspaceFilters } from "../components";
import {
  CMMC_CONTROL_WORKFLOW_STATUS_OPTIONS,
  getCMMCOrganizationProfileSearchText,
  useCMMCModuleState,
  useCMMCSPRSCalculation,
  useCMMCWorkflowState,
} from "../hooks";

const statuses = CMMC_CONTROL_WORKFLOW_STATUS_OPTIONS;
const cmmcLibrary = getFrameworkLibrary(CMMC_FRAMEWORK_ID) || emptyFrameworkLibrary();
const domainGroups = buildDomainGroups(cmmcLibrary);

export default function CMMCOrganizationPage() {
  const { searchQuery, domainFilter, resetVersion, statusFilter } = useCMMCWorkspaceFilters();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") === "assessment" ? "assessment" : "controls";
  const changeTab = (tab) => {
    const next = new URLSearchParams(searchParams);
    if (tab === "assessment") next.set("tab", "assessment");
    else next.delete("tab");
    setSearchParams(next, { replace: true });
  };

  return (
    <CMMCImplementationLayout>
      <CMMCOrganizationContent
        key={resetVersion}
        searchQuery={searchQuery}
        domainFilter={domainFilter}
        statusFilter={statusFilter}
        activeTab={activeTab}
        onTabChange={changeTab}
      />
    </CMMCImplementationLayout>
  );
}

function CMMCOrganizationContent({ searchQuery, domainFilter, statusFilter, activeTab, onTabChange }) {
  const {
    organizationProfile,
    controlWorkflowFields,
    updateControlWorkflowField,
    updateControlWorkflowStatus,
  } = useCMMCWorkflowState();
  const sprsMetrics = useCMMCSPRSCalculation();
  const [openDomains, setOpenDomains] = useState({ AC: true });
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const organizationProfileSearchText = useMemo(
    () => getCMMCOrganizationProfileSearchText(organizationProfile),
    [organizationProfile]
  );
  const workflowDomainGroups = useMemo(
    () => applyControlWorkflowFields(domainGroups, controlWorkflowFields),
    [controlWorkflowFields]
  );
  const assessmentInitialState = useMemo(() => ({
    assessment: {
      id: "",
      c3pao: "",
      leadAssessor: "",
      status: "Planning",
      startDate: "",
      endDate: "",
      scope: "",
      reference: "",
      updatedAt: "",
    },
    results: {},
  }), []);
  const assessmentModule = useCMMCModuleState("assessment-objectives", assessmentInitialState);

  const statusCounts = useMemo(() => {
    if (Number(sprsMetrics.totalControls)) {
      return {
        Completed: Number(sprsMetrics.completedControls) || 0,
        "In Progress": Number(sprsMetrics.inProgressControls) || 0,
        "Not Started": Number(sprsMetrics.notStartedControls) || 0,
      };
    }
    return workflowDomainGroups.flatMap((domain) => domain.controls.map((control) => control.status)).reduce(
      (counts, status) => {
        if (counts[status] !== undefined) counts[status] += 1;
        return counts;
      },
      { "Not Started": 0, "In Progress": 0, Completed: 0 }
    );
  }, [sprsMetrics.completedControls, sprsMetrics.inProgressControls, sprsMetrics.notStartedControls, sprsMetrics.totalControls, workflowDomainGroups]);
  const notStartedTotal = statusCounts["Not Started"];
  const visibleDomains = useMemo(() => {
    return workflowDomainGroups
      .map((domain) => {
        const domainMatches =
          !normalizedSearch ||
          `${domain.code} ${domain.name}`.toLowerCase().includes(normalizedSearch);
        const workflowMatches = Boolean(
          normalizedSearch && organizationProfileSearchText.includes(normalizedSearch)
        );
        const controls = domain.controls.filter((control) => {
          const status = control.status || "";
          const matchesSearch =
            domainMatches ||
            workflowMatches ||
            [
              control.id,
              control.description,
              control.evidence,
              control.objective,
              control.ownerCollector,
              control.dateCollected,
              control.sourceSystemTool,
              control.notesGaps,
              status,
              domain.code,
              domain.name,
            ]
              .join(" ")
              .toLowerCase()
              .includes(normalizedSearch);
          const matchesDomain = domainFilter === "all" || domainFilter === domain.code;
          const matchesStatus = statusFilter === "All" || statusFilter === status;

          return matchesSearch && matchesDomain && matchesStatus;
        });

        return { ...domain, controls };
      })
      .filter((domain) => domain.controls.length > 0);
  }, [domainFilter, normalizedSearch, organizationProfileSearchText, statusFilter, workflowDomainGroups]);

  const updateStatus = (controlKey, status) => {
    updateControlWorkflowStatus(controlKey, status);
  };

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
        <TabButton active={activeTab === "controls"} onClick={() => onTabChange("controls")}>
          Control status
        </TabButton>
        <TabButton active={activeTab === "assessment"} onClick={() => onTabChange("assessment")}>
          Assessment
        </TabButton>
      </div>

      {activeTab === "assessment" ? (
        <AssessmentWorkspace
          controls={visibleDomains.flatMap((domain) => domain.controls.map((control) => ({
            ...control,
            domainCode: domain.code,
          })))}
          module={assessmentModule}
          onStatusChange={updateControlWorkflowStatus}
        />
      ) : (
        <>
        <div className="grid gap-3 sm:grid-cols-4">
          <StatusCard value={statusCounts.Completed} label="Completed" tone="text-emerald-500" />
          <StatusCard value={statusCounts["In Progress"]} label="In Progress" tone="text-amber-500" />
          <StatusCard value={notStartedTotal} label="Not Started" tone="text-slate-900" />
          <StatusCard value={domainGroups.length} label="Domains" tone="text-slate-400" />
        </div>

        <div className="space-y-2">
          {visibleDomains.map((domain) => {
            const isOpen = Boolean(openDomains[domain.code]);
            const completedCount = domain.controls.filter(
              (control) => control.status === "Completed"
            ).length;

            return (
              <section key={domain.code} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => setOpenDomains((current) => ({ ...current, [domain.code]: !current[domain.code] }))}
                  className={`flex w-full items-center justify-between gap-4 px-4 py-3 text-left text-sm font-black transition ${
                    isOpen ? "bg-violet-600 text-white" : "bg-white text-slate-800 hover:bg-slate-50"
                  }`}
                >
                  <span className="min-w-0">
                    <span className={`mr-3 rounded px-2 py-1 text-xs ${isOpen ? "bg-white/15" : "bg-violet-50 text-violet-700"}`}>
                      {domain.code}
                    </span>
                    {domain.name}
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    {completedCount}/{domain.total}
                    <ChevronDown size={16} className={`transition ${isOpen ? "rotate-180" : ""}`} />
                  </span>
                </button>

                {isOpen && (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[920px] text-left text-sm">
                      <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-black uppercase tracking-wide text-slate-400">
                        <tr>
                          <th className="w-12 px-4 py-3">Done</th>
                          <th className="w-24 px-4 py-3">Control ID</th>
                          <th className="px-4 py-3">Control Description</th>
                          <th className="w-48 px-4 py-3">Evidence Needed</th>
                          <th className="w-56 px-4 py-3">Assessment Objective</th>
                          <th className="w-44 px-4 py-3">Owner</th>
                          <th className="w-40 px-4 py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {domain.controls.map((control) => {
                          const controlKey = control.key;
                          const status = control.status || "";

                          return (
                            <tr key={controlKey} className="align-top transition hover:bg-slate-50/70">
                              <td className="px-4 py-3">
                                <input
                                  type="checkbox"
                                  checked={status === "Completed"}
                                  onChange={(event) => updateStatus(control.workflowKey, event.target.checked ? "Completed" : "Not Started")}
                                  className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                                />
                              </td>
                              <td className="px-4 py-3 font-black text-violet-700">{control.id}</td>
                              <td className="px-4 py-3 font-semibold leading-5 text-slate-700">{control.description}</td>
                              <td className="px-4 py-3 text-xs font-semibold leading-5 text-violet-600">{control.evidence}</td>
                              <td className="px-4 py-3 text-xs font-semibold leading-5 text-slate-500">{control.objective}</td>
                              <td className="px-4 py-3">
                                <input
                                  value={control.owner || ""}
                                  onChange={(event) => updateControlWorkflowField(control.workflowKey, "owner", event.target.value)}
                                  placeholder="Assign owner"
                                  className="h-8 w-full rounded border border-slate-200 px-2 text-xs font-semibold outline-none focus:border-violet-400"
                                />
                              </td>
                              <td className="px-4 py-3">
                                <select
                                  value={status}
                                  onChange={(event) => updateStatus(control.workflowKey, event.target.value)}
                                  className="h-8 w-full rounded border border-slate-200 bg-white px-2 text-xs font-bold text-slate-600 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-200"
                                >
                                  <option value=""></option>
                                  {statuses.map((statusOption) => (
                                    <option key={statusOption} value={statusOption}>{statusOption}</option>
                                  ))}
                                </select>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            );
          })}
        </div>
        </>
      )}
    </div>
  );
}

function TabButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-4 py-2 text-sm font-black transition ${
        active ? "bg-slate-950 text-white" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
      }`}
    >
      {children}
    </button>
  );
}

function AssessmentWorkspace({ controls, module, onStatusChange }) {
  const assessment = module.state.assessment || {};
  const results = module.state.results || {};
  const counts = controls.reduce(
    (totals, control) => {
      const outcome = results[control.workflowKey]?.outcome;
      if (outcome === "MET") totals.met += 1;
      else if (outcome === "NOT MET") totals.notMet += 1;
      else if (outcome === "NOT APPLICABLE") totals.notApplicable += 1;
      else totals.pending += 1;
      return totals;
    },
    { met: 0, notMet: 0, notApplicable: 0, pending: 0 }
  );
  const updateAssessment = (field, value) => {
    module.updateState((current) => ({
      ...current,
      assessment: {
        ...(current.assessment || {}),
        [field]: value,
        updatedAt: new Date().toISOString(),
      },
    }));
  };
  const updateResult = (controlId, field, value) => {
    module.updateState((current) => ({
      ...current,
      results: {
        ...(current.results || {}),
        [controlId]: {
          ...(current.results?.[controlId] || {}),
          [field]: value,
          updatedAt: new Date().toISOString(),
        },
      },
    }));
    if (field === "outcome") {
      const workflowStatus = {
        MET: "Completed",
        "NOT MET": "In Progress",
        "NOT APPLICABLE": "Not Applicable",
      }[value] || "Not Started";
      onStatusChange(controlId, workflowStatus, {
        source: "assessment",
      });
    }
  };

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-950">CMMC assessment record</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Record assessment context and the assessor&apos;s determination for each in-scope control.
            </p>
          </div>
          <PersistenceStatus persistence={module.persistence} />
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <AssessmentField label="Assessment ID" value={assessment.id} onChange={(value) => updateAssessment("id", value)} />
          <AssessmentField label="C3PAO / assessor organization" value={assessment.c3pao} onChange={(value) => updateAssessment("c3pao", value)} />
          <AssessmentField label="Lead assessor" value={assessment.leadAssessor} onChange={(value) => updateAssessment("leadAssessor", value)} />
          <label className="text-xs font-black uppercase tracking-wide text-slate-500">
            Assessment status
            <select value={assessment.status || "Planning"} onChange={(event) => updateAssessment("status", event.target.value)} className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold normal-case tracking-normal text-slate-700 outline-none focus:border-violet-400">
              {["Planning", "Evidence Collection", "Fieldwork", "Findings Review", "Conditional Closeout", "Complete"].map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>
          <AssessmentField label="Start date" type="date" value={assessment.startDate} onChange={(value) => updateAssessment("startDate", value)} />
          <AssessmentField label="End date" type="date" value={assessment.endDate} onChange={(value) => updateAssessment("endDate", value)} />
          <AssessmentField label="Scope" value={assessment.scope} onChange={(value) => updateAssessment("scope", value)} />
          <AssessmentField label="Reference" value={assessment.reference} onChange={(value) => updateAssessment("reference", value)} />
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-4">
        <StatusCard value={counts.met} label="Met" tone="text-emerald-600" />
        <StatusCard value={counts.notMet} label="Not Met" tone="text-rose-600" />
        <StatusCard value={counts.pending} label="Pending" tone="text-amber-600" />
        <StatusCard value={counts.notApplicable} label="Not Applicable" tone="text-slate-400" />
      </div>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-black uppercase tracking-wide text-slate-400">
              <tr>
                <th className="w-28 px-4 py-3">Control</th>
                <th className="px-4 py-3">Assessment objective</th>
                <th className="w-48 px-4 py-3">Method</th>
                <th className="w-44 px-4 py-3">Outcome</th>
                <th className="w-52 px-4 py-3">Assessor</th>
                <th className="w-72 px-4 py-3">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {controls.map((control) => {
                const result = results[control.workflowKey] || {};
                return (
                  <tr key={control.key} className="align-top hover:bg-slate-50/70">
                    <td className="px-4 py-3"><p className="font-black text-violet-700">{control.id}</p><p className="mt-1 text-xs font-bold text-slate-400">{control.domainCode}</p></td>
                    <td className="px-4 py-3"><p className="font-semibold leading-5 text-slate-700">{control.description}</p><p className="mt-2 text-xs font-semibold leading-5 text-slate-500">{control.objective}</p></td>
                    <td className="px-4 py-3"><ResultSelect value={result.method} onChange={(value) => updateResult(control.workflowKey, "method", value)} options={["Examine", "Interview", "Test", "Examine + Interview + Test"]} /></td>
                    <td className="px-4 py-3"><ResultSelect value={result.outcome} onChange={(value) => updateResult(control.workflowKey, "outcome", value)} options={["MET", "NOT MET", "NOT APPLICABLE"]} /></td>
                    <td className="px-4 py-3"><input value={result.assessor || ""} onChange={(event) => updateResult(control.workflowKey, "assessor", event.target.value)} placeholder="Assessor name" className="h-9 w-full rounded-lg border border-slate-200 px-3 text-xs font-semibold outline-none focus:border-violet-400" /></td>
                    <td className="px-4 py-3"><textarea value={result.notes || ""} onChange={(event) => updateResult(control.workflowKey, "notes", event.target.value)} placeholder="Decision notes or evidence checked" className="min-h-20 w-full rounded-lg border border-slate-200 p-3 text-xs font-semibold outline-none focus:border-violet-400" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!controls.length ? <p className="p-8 text-center text-sm font-bold text-slate-500">No controls match the current CMMC workspace filters.</p> : null}
      </section>
    </div>
  );
}

function AssessmentField({ label, onChange, type = "text", value = "" }) {
  return (
    <label className="text-xs font-black uppercase tracking-wide text-slate-500">
      {label}
      <input type={type} value={value || ""} onChange={(event) => onChange(event.target.value)} className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold normal-case tracking-normal text-slate-700 outline-none focus:border-violet-400" />
    </label>
  );
}

function ResultSelect({ onChange, options, value = "" }) {
  return (
    <select value={value || ""} onChange={(event) => onChange(event.target.value)} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700 outline-none focus:border-violet-400">
      <option value="">Pending</option>
      {options.map((option) => <option key={option}>{option}</option>)}
    </select>
  );
}

function PersistenceStatus({ persistence }) {
  const labels = {
    loading: "Loading saved assessment…",
    saving: "Saving assessment…",
    saved: "Assessment saved",
    error: "Assessment could not be saved",
  };
  const label = labels[persistence.status] || (persistence.mode === "api" ? "API persistence" : "Browser fallback");
  return <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">{label}</span>;
}

function StatusCard({ value, label, tone }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 text-center shadow-sm">
      <p className={`text-2xl font-black ${tone}`}>{value}</p>
      <p className="mt-1 text-xs font-black uppercase text-slate-400">{label}</p>
    </div>
  );
}

function applyControlWorkflowFields(domainGroups, controlWorkflowFields = {}) {
  return domainGroups.map((domain) => ({
    ...domain,
    controls: domain.controls.map((control) => ({
      ...control,
      status: workflowFieldValue(controlWorkflowFields[control.workflowKey], "status", control.status),
      owner: workflowFieldValue(controlWorkflowFields[control.workflowKey], "owner", ""),
    })),
  }));
}

function workflowFieldValue(fieldOverrides, field, fallback) {
  return Object.prototype.hasOwnProperty.call(fieldOverrides || {}, field) ? fieldOverrides[field] : fallback;
}

function buildDomainGroups(library) {
  const evidenceById = new Map((library.evidence || []).map((item) => [item.id, item]));
  const mappingByControlId = new Map((library.mappings || []).map((mapping) => [mapping.controlId, mapping]));
  const domainsByCode = new Map();

  (library.controls || []).forEach((control) => {
    const controlId = control.controlId || control["Control ID"] || control.id || "";
    const controlFamily = control.controlFamily || control["Control Family"] || "";
    const { code, name } = parseControlFamily(controlFamily, controlId);
    const mapping = mappingByControlId.get(controlId) || {};
    const evidenceItems = (mapping.evidenceRequirementIds || mapping.evidenceIds || [])
      .map((evidenceId) => evidenceById.get(evidenceId))
      .filter(Boolean);

    if (!domainsByCode.has(code)) {
      domainsByCode.set(code, {
        code,
        name,
        total: 0,
        controls: [],
      });
    }

    const domain = domainsByCode.get(code);
    domain.controls.push({
      key: `${code}-${controlId}`,
      workflowKey: controlId,
      id: controlId,
      description: control.controlRequirement || control["Control Requirement"] || "",
      evidence: joinedEvidenceField(evidenceItems, "evidenceToRequest", "Evidence to Request"),
      objective: joinedEvidenceField(evidenceItems, "publicNotesUse", "Public Notes / Use"),
      status: firstEvidenceField(evidenceItems, "evidenceStatus", "Evidence Status"),
      ownerCollector: firstEvidenceField(evidenceItems, "ownerCollector", "Owner / Collector"),
      dateCollected: firstEvidenceField(evidenceItems, "dateCollected", "Date Collected"),
      sourceSystemTool: firstEvidenceField(evidenceItems, "sourceSystemTool", "Source System / Tool"),
      notesGaps: firstEvidenceField(evidenceItems, "notesGaps", "Notes / Gaps"),
    });
    domain.total = domain.controls.length;
  });

  return Array.from(domainsByCode.values());
}

function parseControlFamily(controlFamily, controlId) {
  const [familyCode, ...familyNameParts] = controlFamily.split(" - ");
  const code = familyCode || controlId.split(".")[0] || "";
  const name = familyNameParts.join(" - ") || controlFamily || code;
  return { code, name };
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
    controls: [],
    evidence: [],
    mappings: [],
  };
}
