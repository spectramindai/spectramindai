import {
  ArrowRight,
  ArrowUpDown,
  X,
  ChevronDown,
  Download,
  FileText,
  Filter,
  MessageSquare,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { Component, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useUser } from "../auth/UserContext";
import { readScopedJson } from "../auth/session";
import AppShell from "../components/layout/AppShell";
import { useFrameworkData } from "../core/adapters/useFrameworkData";
import { useRelationshipGraph, getLinkedItemsFromGraph } from "../core/adapters/useRelationshipGraph";
import { useOrganizationStore } from "../core/adapters/useOrganizationStore";
import { useComplianceState } from "../compliance/ComplianceStateContext";
import { ISO27001_FRAMEWORK_ID, resolveFrameworkId } from "../core/engines/framework-engine/frameworkRegistry";
import EvidenceManagementSection from "../evidence/EvidenceManagementSection";
import { buildCrossModuleTarget, implementationTabForItemType, normalizeItemType } from "../navigation/crossModuleNavigation";
import {
  getQuestionnaireApplicability,
  isRelevantToQuestionnaire,
  loadQuestionnaireResponses,
} from "../data/questionnaireEngine";
import { frameworkHasLibrary, useFrameworkWorkspace } from "../framework/FrameworkWorkspaceContext";
import { loadPolicyLibrary } from "../policies/PolicyService";

const implementationTabs = [
  "Risk Scenarios",
  "Controls",
  "Tests",
  "Policies",
  "Populations",
];

const iso27001ImplementationTabs = [
  "Risk Scenarios",
  "Controls",
  "Tests",
  "Mandatory Docs",
];

const emptyImplementationData = {
  risks: [],
  controls: [],
  tests: [],
  policies: [],
  populations: [],
};

const riskColumns = [
  { key: "id", label: "ID" },
  { key: "title", label: "Description" },
  { key: "status", label: "Status" },
  { key: "progressStatus", label: "Progress" },
  { key: "owner", label: "Assigned To" },
  { key: "dueDate", label: "Due Date" },
  { key: "category", label: "Category" },
  { key: "initialRiskScore", label: "Initial Risk Score" },
  { key: "residualRiskScore", label: "Residual Risk Score" },
  { key: "controls", label: "Controls" },
  { key: "comments", label: "Comment" },
];

const controlColumns = [
  { key: "id", label: "ID" },
  { key: "title", label: "Description" },
  { key: "status", label: "Status" },
  { key: "progressStatus", label: "Progress" },
  { key: "owner", label: "Assigned To" },
  { key: "dueDate", label: "Due Date" },
  { key: "category", label: "Category" },
  { key: "trustServiceCriteria", label: "Trust Service Criteria" },
  { key: "mappedTests", label: "Tests" },
  { key: "mappedRisks", label: "Risk Scenarios" },
];

const testColumns = [
  { key: "id", label: "ID" },
  { key: "title", label: "Title" },
  { key: "status", label: "Status" },
  { key: "progressStatus", label: "Progress" },
  { key: "owner", label: "Assigned To" },
  { key: "dueDate", label: "Due Date" },
  { key: "category", label: "Category" },
  { key: "comments", label: "Comments" },
];

const policyColumns = [
  { key: "id", label: "ID" },
  { key: "title", label: "Policy" },
  { key: "status", label: "Status" },
  { key: "owner", label: "Assigned To" },
  { key: "dueDate", label: "Due Date" },
  { key: "category", label: "Category" },
  { key: "comments", label: "Comments" },
];

const populationColumns = [
  { key: "id", label: "ID" },
  { key: "title", label: "Description" },
  { key: "status", label: "Status" },
  { key: "progressStatus", label: "Progress" },
  { key: "owner", label: "Assigned To" },
  { key: "dueDate", label: "Due Date" },
  { key: "category", label: "Category" },
  { key: "mappedTests", label: "Tests" },
  { key: "comments", label: "Comments" },
];

export default function Implementation() {
  const location = useLocation();
  const navigate = useNavigate();
  const frameworkWorkspace = useFrameworkWorkspace();
  const requestedItemType = new URLSearchParams(location.search).get("itemType");
  const [activeTab, setActiveTab] = useState(() => implementationTabForItemType(requestedItemType, "Tests"));
  const activeImplementationFrameworks = useMemo(
    () => getImplementationFrameworkOptions(frameworkWorkspace.selectedFrameworks),
    [frameworkWorkspace.selectedFrameworks]
  );
  const selectedFramework = getSelectedFramework(location, activeImplementationFrameworks);
  const fallbackImplementationFramework =
    activeImplementationFrameworks.find((framework) => framework.id === frameworkWorkspace.activeFrameworkId) ||
    activeImplementationFrameworks[0] ||
    null;
  const selectedFrameworkId = selectedFramework ? resolveFrameworkId(selectedFramework.slug) || selectedFramework.id : "";

  // OrganizationEngine now owns workspace state — routes status changes through
  // trackControlStatus() with full audit history, while keeping the legacy
  // flat-map format that all downstream components already read.
  const { workspaceData, saveWorkspaceItem } = useOrganizationStore(selectedFrameworkId);

  const [questionnaireResponses, setQuestionnaireResponses] = useState(() => loadQuestionnaireResponses(selectedFrameworkId));
  const isCMMC = isCMMCFramework(selectedFramework);
  const shouldRedirectToCanonicalCMMC = isCMMC || (!selectedFramework && isCMMCFramework(fallbackImplementationFramework));
  const isISO27001 = selectedFrameworkId === ISO27001_FRAMEWORK_ID;
  const currentTabs = isISO27001 ? iso27001ImplementationTabs : implementationTabs;
  const defaultActiveTab = isISO27001 ? "Mandatory Docs" : "Tests";
  const visibleActiveTab = currentTabs.includes(activeTab) ? activeTab : defaultActiveTab;
  // FrameworkEngine is now the source of truth — the framework library JSON
  // files are never modified. useFrameworkData returns the same shape that
  // getFrameworkLibrary() previously returned so all downstream components
  // continue to work without any changes.
  const rawImplementationData = useFrameworkData(selectedFramework?.slug);

  const implementationData = useMemo(() => {
    if (!rawImplementationData || !rawImplementationData.controls) {
      return { controls: [], risks: [], tests: [], policies: [], populations: [] };
    }

    const risks = rawImplementationData.risks.map((r) => {
      const saved = (workspaceData && workspaceData[r.id]) ?? {};
      const initialLikelihood = saved.initialLikelihood ?? 3;
      const initialImpact = saved.initialImpact ?? 5;
      const residualLikelihood = saved.residualLikelihood ?? 1;
      const residualImpact = saved.residualImpact ?? 3;
      return {
        ...r,
        owner: saved.assignments?.owner || "Unassigned",
        status: saved.status || r.status || "Ready",
        dueDate: saved.dueDate || r.dueDate || "",
        initialRiskScore: initialLikelihood * initialImpact,
        residualRiskScore: residualLikelihood * residualImpact,
        comments: saved.comments?.length || "",
      };
    });

    const controls = rawImplementationData.controls.map((c) => {
      const saved = (workspaceData && workspaceData[c.id]) ?? {};
      return {
        ...c,
        owner: saved.assignments?.owner || "Unassigned",
        status: saved.status || c.status || "Ready",
        dueDate: saved.dueDate || c.dueDate || "",
        comments: saved.comments?.length || "",
      };
    });

    const tests = rawImplementationData.tests.map((t) => {
      const saved = (workspaceData && workspaceData[t.id]) ?? {};
      return {
        ...t,
        owner: saved.assignments?.owner || "Unassigned",
        status: saved.status || t.status || "Ready",
        dueDate: saved.dueDate || t.dueDate || "",
        comments: saved.comments?.length || "",
      };
    });

    const policies = rawImplementationData.policies.map((p) => {
      const saved = (workspaceData && workspaceData[p.id]) ?? {};
      return {
        ...p,
        owner: saved.assignments?.owner || "Unassigned",
        status: saved.status || p.status || "Ready",
        dueDate: saved.dueDate || p.dueDate || "",
        comments: saved.comments?.length || "",
      };
    });

    const populations = rawImplementationData.populations.map((p) => {
      const saved = (workspaceData && workspaceData[p.id]) ?? {};
      return {
        ...p,
        owner: saved.assignments?.owner || "Unassigned",
        status: saved.status || p.status || "Ready",
        dueDate: saved.dueDate || p.dueDate || "",
        comments: saved.comments?.length || "",
      };
    });

    return {
      ...rawImplementationData,
      risks,
      controls,
      tests,
      policies,
      populations,
    };
  }, [rawImplementationData, workspaceData]);

  // RelationshipEngine is seeded from the framework mappings JSON so the
  // workspace panel resolves linked items via graph lookups instead of
  // hardcoded array references.
  const relationshipGraph = useRelationshipGraph(selectedFramework?.slug);

  const [workspaceItem, setWorkspaceItem] = useState(() =>
    getWorkspaceItemFromLocation(window.location, implementationData)
  );
  const [isWorkspaceClosing, setIsWorkspaceClosing] = useState(false);
  const selectWorkspaceItem = (item, { replace = false } = {}) => {
    setIsWorkspaceClosing(false);
    setWorkspaceItem(item);
    updateWorkspaceHistory(item, replace);
  };
  const closeWorkspaceItem = () => {
    setIsWorkspaceClosing(true);
    updateWorkspaceHistory(null);
    window.setTimeout(() => {
      setWorkspaceItem(null);
      setIsWorkspaceClosing(false);
    }, 200);
  };
  const navigateRelatedItem = (type, relatedItem, { mode = "resolve" } = {}) => {
    if (!relatedItem?.id) return;

    const implementationType = {
      Control: "Control",
      Test: "Test",
      Risk: "Risk",
      Policy: "Policy",
      Population: "Population",
      Implementation: "Population",
    }[type];

    if (implementationType) {
      setActiveTab(implementationTabForItemType(implementationType, visibleActiveTab));
      selectWorkspaceItem(createWorkspaceItem(implementationType, relatedItem));
      return;
    }

    const target = buildCrossModuleTarget({
      activeFramework: selectedFramework,
      itemId: relatedItem.id,
      itemType: type,
      moduleContext: relatedItem.title || relatedItem.name || "",
      mode,
    });
    navigate(target.path, { state: target.state });
  };

  useEffect(() => {
    const requestedTab = implementationTabForItemType(requestedItemType, defaultActiveTab);
    const frameId = requestAnimationFrame(() => setActiveTab(requestedTab));

    return () => cancelAnimationFrame(frameId);
  }, [defaultActiveTab, requestedItemType, selectedFramework?.slug]);

  useEffect(() => {
    const item = getWorkspaceItemFromLocation({ search: location.search }, implementationData);
    if (!item) return undefined;
    const frameId = requestAnimationFrame(() => setWorkspaceItem(item));
    return () => cancelAnimationFrame(frameId);
  }, [implementationData, location.search]);

  useEffect(() => {
    const syncWorkspaceFromUrl = () => {
      setWorkspaceItem(getWorkspaceItemFromLocation(window.location, implementationData));
    };

    window.addEventListener("popstate", syncWorkspaceFromUrl);

    return () => window.removeEventListener("popstate", syncWorkspaceFromUrl);
  }, [implementationData]);

  useEffect(() => {
    const refreshQuestionnaireResponses = () => setQuestionnaireResponses(loadQuestionnaireResponses(selectedFrameworkId));
    window.addEventListener("spectramind:questionnaire-updated", refreshQuestionnaireResponses);
    window.addEventListener("storage", refreshQuestionnaireResponses);

    return () => {
      window.removeEventListener("spectramind:questionnaire-updated", refreshQuestionnaireResponses);
      window.removeEventListener("storage", refreshQuestionnaireResponses);
    };
  }, [selectedFrameworkId]);

  if (shouldRedirectToCanonicalCMMC) {
    return <CanonicalCMMCRedirect frameworkWorkspace={frameworkWorkspace} />;
  }

  if (!selectedFramework && fallbackImplementationFramework?.slug) {
    return <Navigate to={`/implementation?framework=${fallbackImplementationFramework.slug}`} replace />;
  }

  if (!selectedFramework) {
    return <SelectFrameworkScreen frameworks={activeImplementationFrameworks} />;
  }

  const shouldShowWorkspace = !isCMMC && workspaceItem;

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="rounded-lg border border-white/75 bg-white/70 p-5 shadow-lg shadow-slate-900/5 backdrop-blur-2xl">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-black uppercase tracking-widest text-amber-700">
                Implementation
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-normal text-slate-950">
              Compliance Implementation
              </h1>
              <p className="mt-2 text-2xl font-black text-slate-900">
                {selectedFramework.name}
              </p>
            </div>

            <div className="flex flex-col items-start gap-3 xl:items-end">
              <FrameworkSwitcher
                activeSlug={selectedFramework.slug}
                frameworks={activeImplementationFrameworks}
                onSelect={(framework) => {
                  frameworkWorkspace.setActiveFramework(framework.id);
                  navigate(framework.slug === "cmmc" ? "/cmmc" : `/implementation?framework=${framework.slug}`);
                }}
              />
              <div className="flex flex-wrap items-center gap-2">
                <button className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50">
                  Description of System
                </button>
                <ExportMenu data={implementationData} />
              </div>
            </div>
          </div>
        </div>

        <section className="grid gap-4 xl:grid-cols-1 xl:items-start">
          <div className="min-w-0 space-y-3">
            {!isCMMC && <OverviewRings data={implementationData} workspaceData={workspaceData} selectedFramework={selectedFramework} />}
            <ImplementationTabs tabs={currentTabs} activeTab={visibleActiveTab} onTabChange={setActiveTab} />

            <TabPanel
              activeTab={visibleActiveTab}
              selectedFramework={selectedFramework}
              data={implementationData}
              questionnaireResponses={questionnaireResponses}
              workspaceData={workspaceData}
              onSelectWorkspaceItem={selectWorkspaceItem}
            />
          </div>

          {shouldShowWorkspace && (
            <div
              className={`fixed inset-y-0 right-0 z-50 w-full max-w-[430px] transform border-l border-slate-200 bg-white shadow-xl shadow-slate-900/10 transition-transform duration-200 ease-out ${
                isWorkspaceClosing ? "translate-x-full" : "translate-x-0"
              }`}
            >
              <WorkspaceErrorBoundary itemKey={workspaceItem.id} onClose={closeWorkspaceItem}>
                <ImplementationWorkspace
                  key={workspaceItem.id}
                  item={workspaceItem}
                  framework={selectedFramework}
                  data={implementationData}
                  savedState={workspaceData && workspaceData[workspaceItem.id]}
                  workspaceData={workspaceData}
                  relationshipGraph={relationshipGraph}
                  onWorkspaceStateChange={(itemId, nextState) => {
                    // Route through OrganizationEngine for proper audit tracking,
                    // then the hook syncs both the engine snapshot and the legacy
                    // flat-map so all downstream reads continue to work.
                    saveWorkspaceItem(itemId, nextState);
                  }}
                  onNavigateRelatedItem={navigateRelatedItem}
                  onClose={closeWorkspaceItem}
                />
              </WorkspaceErrorBoundary>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function FrameworkSwitcher({ activeSlug, frameworks = [], onSelect }) {
  const implementationFrameworks = getImplementationFrameworkOptions(frameworks);

  return (
    <div className="inline-flex w-fit flex-wrap items-center gap-1 rounded-lg border border-slate-200/80 bg-white/75 p-1 shadow-sm lg:flex-nowrap lg:justify-end">
      {implementationFrameworks.map((framework) => {
        const isActive = framework.slug === activeSlug;

        return (
          <button
            key={framework.id}
            type="button"
            onClick={() => onSelect(framework)}
            className={`inline-flex h-9 min-w-[88px] items-center justify-center whitespace-nowrap rounded-md px-3 text-sm font-black transition ${
              isActive
                ? "bg-amber-700 text-white shadow-sm shadow-amber-700/20"
                : "text-slate-600 hover:bg-white hover:text-slate-950"
            }`}
            aria-pressed={isActive}
          >
            {framework.shortName || framework.name}
          </button>
        );
      })}
    </div>
  );
}

function SelectFrameworkScreen({ frameworks = [] }) {
  const { setActiveFramework } = useFrameworkWorkspace();

  return (
    <AppShell>
      <div className="space-y-7">
        <div>
          <p className="text-sm font-black uppercase tracking-widest text-blue-700">
            Compliance Implementation
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-normal text-slate-900">
            Select a Framework
          </h1>
          <p className="mt-2 max-w-2xl text-slate-600">
            Choose a framework to open its implementation workspace.
          </p>
        </div>

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {frameworks.map((framework) => {
            const slug = framework.slug;
            const isCMMCCard = isCMMCFramework(framework);

            return (
              <Link
                key={framework.id}
                to={isCMMCCard ? "/cmmc" : `/implementation?framework=${slug}`}
                state={isCMMCCard ? undefined : { framework }}
                onClick={() => setActiveFramework(framework.id)}
                className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <ShieldCheck size={22} />
                </div>
                <h2 className="mt-5 text-2xl font-bold text-slate-950">
                  {framework.name}
                </h2>
                <p className="mt-1 text-slate-500">{framework.status || "Active"}</p>
                <div className="mt-5 flex items-center justify-between text-sm font-semibold text-slate-700">
                  <span>{typeof framework.progress === "number" ? `${framework.progress}% complete` : "Open workspace"}</span>
                  <ArrowRight size={18} />
                </div>
              </Link>
            );
          })}
        </section>
      </div>
    </AppShell>
  );
}

function CanonicalCMMCRedirect({ frameworkWorkspace }) {
  const {
    activeFramework,
    isFrameworkSelected,
    selectFramework,
    setActiveFramework,
  } = frameworkWorkspace;

  useEffect(() => {
    if (activeFramework?.slug === "cmmc") return;
    if (isFrameworkSelected("cmmc")) {
      setActiveFramework("cmmc");
      return;
    }

    selectFramework("cmmc");
  }, [activeFramework?.slug, isFrameworkSelected, selectFramework, setActiveFramework]);

  if (activeFramework?.slug !== "cmmc") {
    return null;
  }

  return <Navigate to="/cmmc" replace />;
}

function OverviewRings({ data, workspaceData, selectedFramework }) {
  const isISO27001 = selectedFramework?.slug === "iso-27001";
  const riskProgress = progressFromRows(data.risks, (row) => isCompletedStatus(row, workspaceData));
  const controlProgress = progressFromRows(data.controls, (row) => isCompletedStatus(row, workspaceData));
  const testProgress = progressFromRows(data.tests, (row) => isCompletedStatus(row, workspaceData));
  const policyProgress = progressFromRows(data.policies, (row) => isApprovedStatus(row, workspaceData));
  const evidenceProgress = progressFromRows(
    [...data.controls, ...data.tests, ...data.policies],
    (row) => hasUploadedEvidence(row, workspaceData)
  );
  const auditReadiness = Math.round(
    (controlProgress + testProgress + evidenceProgress + policyProgress) / 4
  );

  const rings = isISO27001 ? [
    {
      label: "Risk Scenarios",
      value: riskProgress,
      caption: `${completedCount(data.risks, (row) => isCompletedStatus(row, workspaceData))}/${data.risks.length} completed`,
      tone: "#60a5fa",
    },
    {
      label: "Tests",
      value: testProgress,
      caption: `${completedCount(data.tests, (row) => isCompletedStatus(row, workspaceData))}/${data.tests.length} completed`,
      tone: "#22d3ee",
    },
    {
      label: "Controls",
      value: controlProgress,
      caption: `${completedCount(data.controls, (row) => isCompletedStatus(row, workspaceData))}/${data.controls.length} completed`,
      tone: "#3b82f6",
    },
    {
      label: "Audit",
      value: auditReadiness,
      caption: "Controls, tests, evidence",
      tone: "#facc15",
    },
  ] : [
    {
      label: "Risk Progress",
      value: riskProgress,
      caption: `${completedCount(data.risks, (row) => isCompletedStatus(row, workspaceData))}/${data.risks.length} completed`,
      tone: "#60a5fa",
    },
    {
      label: "Control Progress",
      value: controlProgress,
      caption: `${completedCount(data.controls, (row) => isCompletedStatus(row, workspaceData))}/${data.controls.length} completed`,
      tone: "#3b82f6",
    },
    {
      label: "Test Progress",
      value: testProgress,
      caption: `${completedCount(data.tests, (row) => isCompletedStatus(row, workspaceData))}/${data.tests.length} completed`,
      tone: "#22d3ee",
    },
    {
      label: "Policy Progress",
      value: policyProgress,
      caption: `${completedCount(data.policies, (row) => isApprovedStatus(row, workspaceData))}/${data.policies.length} approved`,
      tone: "#8b5cf6",
    },
    {
      label: "Audit Readiness",
      value: auditReadiness,
      caption: "Controls, tests, evidence, policies",
      tone: "#facc15",
    },
  ];

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <button className="inline-flex items-center gap-2 text-sm font-black text-slate-800">
          <span className="text-slate-500">⌄</span>
          Overview
        </button>
        <p className="ml-6 text-xs font-semibold text-slate-400">
          Organization progress from implementation status, evidence, and policy approval
        </p>
      </div>

      <div className={`grid gap-4 sm:grid-cols-2 ${isISO27001 ? "xl:grid-cols-4" : "xl:grid-cols-5"}`}>
        {rings.map((ring) => (
          <div
            key={ring.label}
            className="flex flex-col items-center justify-center border-slate-100 py-2 xl:border-r xl:last:border-r-0"
          >
            <p className="mb-2 text-xs font-black text-slate-600">
              {ring.label}
            </p>
            <div
              className="grid h-24 w-24 place-items-center rounded-full"
              style={{
                background: `conic-gradient(${ring.tone} ${ring.value * 3.6}deg, #f1f5f9 0deg)`,
              }}
            >
              <div className="grid h-20 w-20 place-items-center rounded-full bg-white">
                <span className="text-xl font-black text-slate-950">
                  {ring.value}%
                </span>
              </div>
            </div>
            <p className="mt-2 text-xs font-semibold text-slate-400">
              {ring.caption}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ImplementationTabs({ tabs = implementationTabs, activeTab, onTabChange }) {
  return (
    <div className="overflow-x-auto border-b border-slate-200 bg-transparent">
      <div className="flex min-w-max gap-6 px-1">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => onTabChange(tab)}
            className={`border-b-2 px-0 py-3 text-sm font-black transition ${
              activeTab === tab
                ? "border-slate-950 text-slate-950"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
    </div>
  );
}

function ExportMenu({ compact = false, data = emptyImplementationData }) {
  const options = [
    ["Export all", "all", [...data.risks, ...data.tests, ...data.controls, ...data.policies, ...data.populations]],
    ["Export tests", "tests", data.tests],
    ["Export controls", "controls", data.controls],
    ["Export risk scenarios", "risk-scenarios", data.risks],
    ["Export policies", "policies", data.policies],
    ["Export populations", "populations", data.populations],
  ];

  return (
    <details className="relative">
      <summary
        className={`inline-flex cursor-pointer list-none items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 ${
          compact ? "h-11 px-3" : "px-4 py-2"
        }`}
      >
        <Download size={16} />
        Export
        {!compact && <ArrowRight size={15} />}
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-52 rounded-lg border border-slate-200 bg-white p-2 shadow-xl">
        {options.map(([label, fileName, rows]) => (
          <button
            key={fileName}
            type="button"
            onClick={() => downloadExcelFile(fileName, rows)}
            className="block w-full rounded-lg px-3 py-2 text-left text-sm font-bold text-slate-700 transition hover:bg-slate-50"
          >
            {label}
          </button>
        ))}
      </div>
    </details>
  );
}

function TabPanel({ activeTab, selectedFramework, data, questionnaireResponses, workspaceData, onSelectWorkspaceItem }) {
  if (activeTab === "Controls") {
    return (
      <ControlsSection rows={data.controls} questionnaireResponses={questionnaireResponses} workspaceData={workspaceData} selectedFramework={selectedFramework} onSelectWorkspaceItem={onSelectWorkspaceItem} />
    );
  }

  if (activeTab === "Risk Scenarios") {
    return (
      <RiskScenariosSection rows={data.risks} questionnaireResponses={questionnaireResponses} workspaceData={workspaceData} selectedFramework={selectedFramework} onSelectWorkspaceItem={onSelectWorkspaceItem} />
    );
  }

  if (activeTab === "Tests") {
    return (
      <TestsSection rows={data.tests} questionnaireResponses={questionnaireResponses} workspaceData={workspaceData} selectedFramework={selectedFramework} onSelectWorkspaceItem={onSelectWorkspaceItem} />
    );
  }

  if (activeTab === "Mandatory Docs") {
    return (
      <MandatoryDocsSection rows={data.policies} workspaceData={workspaceData} selectedFramework={selectedFramework} onSelectWorkspaceItem={onSelectWorkspaceItem} />
    );
  }

  if (activeTab === "Policies") {
    return (
      <PoliciesSection rows={data.policies} questionnaireResponses={questionnaireResponses} workspaceData={workspaceData} selectedFramework={selectedFramework} onSelectWorkspaceItem={onSelectWorkspaceItem} />
    );
  }

  return (
    <PopulationSection rows={data.populations} questionnaireResponses={questionnaireResponses} workspaceData={workspaceData} selectedFramework={selectedFramework} onSelectWorkspaceItem={onSelectWorkspaceItem} />
  );
}

function RiskScenariosSection({ rows, questionnaireResponses, workspaceData, selectedFramework, onSelectWorkspaceItem }) {
  const [query, setQuery] = useState("");
  const [filterBy, setFilterBy] = useState("All");
  const [sortBy, setSortBy] = useState("dueDate");
  const [selectedRisk, setSelectedRisk] = useState(null);
  const [visibleColumns, setVisibleColumns] = useState(
    riskColumns.reduce((columns, column) => ({ ...columns, [column.key]: true }), {})
  );

  const filteredRisks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return rows
      .filter((risk) => {
        const matchesQuery =
          !normalizedQuery ||
          Object.values(risk).join(" ").toLowerCase().includes(normalizedQuery);
        const matchesFilter =
          filterBy === "All" ||
          risk.status === filterBy ||
          risk.severity === filterBy ||
          risk.category === filterBy;

        return matchesQuery && matchesFilter;
      })
      .sort((a, b) => compareRiskRows(a, b, sortBy));
  }, [filterBy, query, rows, sortBy]);

  const resetTable = () => {
    setQuery("");
    setFilterBy("All");
    setSortBy("dueDate");
    setSelectedRisk(null);
  };

  return (
    <section className="overflow-hidden rounded-lg border border-white/75 bg-white/62 shadow-xl shadow-slate-900/5 backdrop-blur">
      <div className="border-b border-slate-100 px-6 py-5">
        <SectionHeader
          title="Risk Scenarios"
          description={`Search, review, and prioritize mapped risk scenarios for ${selectedFramework.name}.`}
        />
      </div>

      <div className="border-b border-slate-100 p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <label className="relative min-w-0 flex-1">
            <Search
              size={17}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm font-semibold text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500"
              placeholder="Search risks by ID, title, owner, reviewer, or category"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <label className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm">
              <Filter size={16} />
              <select
                value={filterBy}
                onChange={(event) => setFilterBy(event.target.value)}
                className="bg-transparent font-bold outline-none"
              >
                <option value="All">Filter</option>
                <option value="High">High severity</option>
                <option value="Medium">Medium severity</option>
                <option value="Low">Low severity</option>
                <option value="Open">Open</option>
                <option value="In Progress">In progress</option>
                <option value="In Review">In review</option>
                <option value="Ready">Ready</option>
              </select>
            </label>

            <label className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm">
              <ArrowUpDown size={16} />
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
                className="bg-transparent font-bold outline-none"
              >
                <option value="dueDate">Sort by due date</option>
                <option value="severity">Sort by severity</option>
                <option value="status">Sort by status</option>
                <option value="title">Sort by title</option>
              </select>
            </label>

            <details className="relative">
              <summary className="inline-flex h-11 cursor-pointer list-none items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50">
                <SlidersHorizontal size={16} />
                Column Settings
              </summary>
              <div className="absolute right-0 z-20 mt-2 w-56 rounded-lg border border-slate-200 bg-white p-3 shadow-xl">
                <p className="mb-2 text-xs font-black uppercase tracking-widest text-slate-500">
                  Columns
                </p>
                <div className="space-y-2">
                  {riskColumns.map((column) => (
                    <label
                      key={column.key}
                      className="flex items-center gap-2 text-sm font-semibold text-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={visibleColumns[column.key]}
                        onChange={() =>
                          setVisibleColumns((current) => ({
                            ...current,
                            [column.key]: !current[column.key],
                          }))
                        }
                      />
                      {column.label}
                    </label>
                  ))}
                </div>
              </div>
            </details>

            <ExportMenu compact data={{ ...emptyImplementationData, risks: rows }} />

            <button
              type="button"
              onClick={resetTable}
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[980px] w-full border-collapse text-left text-sm">
          <thead className="bg-slate-50/90 text-xs font-black uppercase tracking-wider text-slate-500">
            <tr>
              <th className="w-12 border-b border-slate-200 px-4 py-3">
                <input type="checkbox" aria-label="Select all risk scenarios" />
              </th>
              {riskColumns
                .filter((column) => visibleColumns[column.key])
                .map((column) => (
                  <th key={column.key} className="border-b border-slate-200 px-4 py-3">
                    {column.label}
                  </th>
                ))}
            </tr>
          </thead>
          <tbody className="bg-white/60">
            {filteredRisks.map((risk) => {
              const applicability = getQuestionnaireApplicability(risk, questionnaireResponses);
              const isDisabled = applicability === "Not applicable";

              return (
              <tr
                key={risk.id}
                onClick={() => {
                  if (isDisabled) return;
                  setSelectedRisk(risk);
                  onSelectWorkspaceItem(createWorkspaceItem("Risk", risk));
                }}
                onKeyDown={(event) => {
                  if (!isDisabled && (event.key === "Enter" || event.key === " ")) {
                    setSelectedRisk(risk);
                    onSelectWorkspaceItem(createWorkspaceItem("Risk", risk));
                  }
                }}
                role={isDisabled ? undefined : "button"}
                tabIndex={isDisabled ? -1 : 0}
                aria-disabled={isDisabled}
                className={`border-b border-slate-100 transition last:border-0 ${
                  isDisabled
                    ? "cursor-not-allowed bg-slate-50/70 opacity-60"
                    : `cursor-pointer hover:bg-blue-50/50 ${selectedRisk?.id === risk.id ? "bg-blue-50/70" : ""}`
                }`}
              >
                <RiskCell>
                  <input type="checkbox" aria-label={`Select ${risk.id}`} onClick={(event) => event.stopPropagation()} />
                </RiskCell>
                {visibleColumns.id && <RiskCell strong>{risk.id}</RiskCell>}
                {visibleColumns.title && (
                  <RiskCell>
                    <span className="font-black text-slate-900">
                      {risk.title}
                    </span>
                  </RiskCell>
                )}
                {visibleColumns.status && (
                  <RiskCell>
                    {renderStatusPill(risk, applicability, workspaceData)}
                  </RiskCell>
                )}
                {visibleColumns.progressStatus && (
                  <RiskCell>{renderProgressStatusPill(risk, workspaceData)}</RiskCell>
                )}
                {visibleColumns.owner && <RiskCell>{risk.owner}</RiskCell>}
                {visibleColumns.dueDate && <RiskCell>{risk.dueDate}</RiskCell>}
                {visibleColumns.category && <RiskCell>{risk.category}</RiskCell>}
                {visibleColumns.initialRiskScore && <RiskCell>{risk.initialRiskScore}</RiskCell>}
                {visibleColumns.residualRiskScore && <RiskCell>{risk.residualRiskScore}</RiskCell>}
                {visibleColumns.controls && <RiskCell>{risk.controls}</RiskCell>}
                {visibleColumns.comments && (
                  <RiskCell>
                    <span className="inline-flex items-center gap-1 font-black">
                      <MessageSquare size={14} />
                      {risk.comments}
                    </span>
                  </RiskCell>
                )}
              </tr>
              );
            })}
          </tbody>
        </table>
        {!filteredRisks.length && <EmptyRows label="risk scenarios" />}
      </div>

    </section>
  );
}

function ControlsSection({ rows, questionnaireResponses, workspaceData, selectedFramework, onSelectWorkspaceItem }) {
  const [query, setQuery] = useState("");
  const [filterBy, setFilterBy] = useState("All");
  const [sortBy, setSortBy] = useState("dueDate");
  const [selectedControl, setSelectedControl] = useState(null);

  const filteredControls = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return rows
      .filter((control) => {
        const matchesQuery =
          !normalizedQuery ||
          Object.values(control).join(" ").toLowerCase().includes(normalizedQuery);
        const matchesFilter =
          filterBy === "All" ||
          control.status === filterBy ||
          control.evidenceStatus === filterBy ||
          control.owner === filterBy;

        return matchesQuery && matchesFilter;
      })
      .sort((a, b) => compareControlRows(a, b, sortBy));
  }, [filterBy, query, rows, sortBy]);

  const resetTable = () => {
    setQuery("");
    setFilterBy("All");
    setSortBy("dueDate");
    setSelectedControl(null);
  };

  return (
    <section className="overflow-hidden rounded-lg border border-white/75 bg-white/62 shadow-xl shadow-slate-900/5 backdrop-blur">
      <div className="border-b border-slate-100 px-6 py-5">
        <SectionHeader
          title="Controls"
          description={`Search, review, and prioritize mapped controls for ${selectedFramework.name}. Questionnaire matches are highlighted.`}
        />
      </div>

      <div className="border-b border-slate-100 p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <label className="relative min-w-0 flex-1">
            <Search
              size={17}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm font-semibold text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500"
              placeholder="Search controls by ID, title, owner, reviewer, or evidence status"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <label className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm">
              <Filter size={16} />
              <select
                value={filterBy}
                onChange={(event) => setFilterBy(event.target.value)}
                className="bg-transparent font-bold outline-none"
              >
                <option value="All">Filter</option>
                <option value="Implemented">Implemented</option>
                <option value="In Progress">In progress</option>
                <option value="Needs Review">Needs review</option>
                <option value="Open">Open</option>
                <option value="Ready">Evidence ready</option>
                <option value="Partial">Evidence partial</option>
                <option value="Missing">Evidence missing</option>
              </select>
            </label>

            <label className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm">
              <ArrowUpDown size={16} />
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
                className="bg-transparent font-bold outline-none"
              >
                <option value="dueDate">Sort by due date</option>
                <option value="status">Sort by status</option>
                <option value="evidenceStatus">Sort by evidence</option>
                <option value="title">Sort by title</option>
              </select>
            </label>

            <ExportMenu compact data={{ ...emptyImplementationData, controls: rows }} />

            <button
              type="button"
              onClick={resetTable}
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[920px] w-full border-collapse text-left text-sm">
          <thead className="bg-slate-50/90 text-xs font-black uppercase tracking-wider text-slate-500">
            <tr>
              <th className="w-12 border-b border-slate-200 px-4 py-3">
                <input type="checkbox" aria-label="Select all controls" />
              </th>
              {controlColumns.map((column) => (
                <th key={column.key} className="border-b border-slate-200 px-4 py-3">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white/60">
            {filteredControls.map((control) => {
              const applicability = getQuestionnaireApplicability(control, questionnaireResponses);
              const isDisabled = applicability === "Not applicable";

              return (
              <tr
                key={control.id}
                onClick={() => {
                  if (isDisabled) return;
                  setSelectedControl(control);
                  onSelectWorkspaceItem(createWorkspaceItem("Control", control));
                }}
                onKeyDown={(event) => {
                  if (!isDisabled && (event.key === "Enter" || event.key === " ")) {
                    setSelectedControl(control);
                    onSelectWorkspaceItem(createWorkspaceItem("Control", control));
                  }
                }}
                role={isDisabled ? undefined : "button"}
                tabIndex={isDisabled ? -1 : 0}
                aria-disabled={isDisabled}
                className={`border-b border-slate-100 transition last:border-0 ${
                  isDisabled
                    ? "cursor-not-allowed bg-slate-50/70 opacity-60"
                    : `cursor-pointer hover:bg-blue-50/50 ${
                        selectedControl?.id === control.id || isRelevantToQuestionnaire(control, questionnaireResponses) ? "bg-blue-50/70" : ""
                      }`
                }`}
              >
                <RiskCell>
                  <input type="checkbox" aria-label={`Select ${control.id}`} onClick={(event) => event.stopPropagation()} />
                </RiskCell>
                <RiskCell strong>{control.id}</RiskCell>
                <RiskCell>
                  <span className="font-black text-slate-900">
                    {control.title}
                  </span>
                  {isRelevantToQuestionnaire(control, questionnaireResponses) && (
                    <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-black text-blue-800">
                      Prioritized
                    </span>
                  )}
                </RiskCell>
                <RiskCell>
                  {renderStatusPill(control, applicability, workspaceData)}
                </RiskCell>
                <RiskCell>{renderProgressStatusPill(control, workspaceData)}</RiskCell>
                <RiskCell>{control.owner}</RiskCell>
                <RiskCell>{control.dueDate}</RiskCell>
                <RiskCell>{control.category}</RiskCell>
                <RiskCell>{control.trustServiceCriteria}</RiskCell>
                <RiskCell>{control.mappedTests}</RiskCell>
                <RiskCell>{control.mappedRisks}</RiskCell>
              </tr>
              );
            })}
          </tbody>
        </table>
        {!filteredControls.length && <EmptyRows label="controls" />}
      </div>

    </section>
  );
}

function TestsSection({ rows, questionnaireResponses, workspaceData, selectedFramework, onSelectWorkspaceItem }) {
  const [query, setQuery] = useState("");
  const [filterBy, setFilterBy] = useState("All");
  const [sortBy, setSortBy] = useState("dueDate");
  const [selectedTest, setSelectedTest] = useState(null);

  const filteredTests = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return rows
      .filter((test) => {
        const matchesQuery =
          !normalizedQuery ||
          Object.values(test).join(" ").toLowerCase().includes(normalizedQuery);
        const matchesFilter =
          filterBy === "All" ||
          test.status === filterBy ||
          test.evidenceStatus === filterBy ||
          test.owner === filterBy;

        return matchesQuery && matchesFilter;
      })
      .sort((a, b) => compareTestRows(a, b, sortBy));
  }, [filterBy, query, rows, sortBy]);

  const resetTable = () => {
    setQuery("");
    setFilterBy("All");
    setSortBy("dueDate");
    setSelectedTest(null);
  };

  return (
    <section className="overflow-hidden rounded-lg border border-white/75 bg-white/62 shadow-xl shadow-slate-900/5 backdrop-blur">
      <div className="border-b border-slate-100 px-6 py-5">
        <SectionHeader
          title="Tests"
          description={`Search, review, and prioritize mapped tests for ${selectedFramework.name}.`}
        />
      </div>

      <div className="border-b border-slate-100 p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <label className="relative min-w-0 flex-1">
            <Search
              size={17}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm font-semibold text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500"
              placeholder="Search tests by ID, title, owner, reviewer, or evidence status"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <label className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm">
              <Filter size={16} />
              <select
                value={filterBy}
                onChange={(event) => setFilterBy(event.target.value)}
                className="bg-transparent font-bold outline-none"
              >
                <option value="All">Filter</option>
                <option value="Ready">Ready</option>
                <option value="In Progress">In progress</option>
                <option value="In Review">In review</option>
                <option value="Open">Open</option>
                <option value="Partial">Evidence partial</option>
                <option value="Missing">Evidence missing</option>
              </select>
            </label>

            <label className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm">
              <ArrowUpDown size={16} />
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
                className="bg-transparent font-bold outline-none"
              >
                <option value="dueDate">Sort by due date</option>
                <option value="status">Sort by status</option>
                <option value="evidenceStatus">Sort by evidence</option>
                <option value="title">Sort by title</option>
              </select>
            </label>

            <ExportMenu compact data={{ ...emptyImplementationData, tests: rows }} />

            <button
              type="button"
              onClick={resetTable}
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[980px] w-full border-collapse text-left text-sm">
          <thead className="bg-slate-50/90 text-xs font-black uppercase tracking-wider text-slate-500">
            <tr>
              <th className="w-12 border-b border-slate-200 px-4 py-3">
                <input type="checkbox" aria-label="Select all tests" />
              </th>
              {testColumns.map((column) => (
                <th key={column.key} className="border-b border-slate-200 px-4 py-3">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white/60">
            {filteredTests.map((test) => {
              const applicability = getQuestionnaireApplicability(test, questionnaireResponses);
              const isDisabled = applicability === "Not applicable";

              return (
              <tr
                key={test.id}
                onClick={() => {
                  if (isDisabled) return;
                  setSelectedTest(test);
                  onSelectWorkspaceItem(createWorkspaceItem("Test", test));
                }}
                onKeyDown={(event) => {
                  if (!isDisabled && (event.key === "Enter" || event.key === " ")) {
                    setSelectedTest(test);
                    onSelectWorkspaceItem(createWorkspaceItem("Test", test));
                  }
                }}
                role={isDisabled ? undefined : "button"}
                tabIndex={isDisabled ? -1 : 0}
                aria-disabled={isDisabled}
                className={`border-b border-slate-100 transition last:border-0 ${
                  isDisabled
                    ? "cursor-not-allowed bg-slate-50/70 opacity-60"
                    : `cursor-pointer hover:bg-blue-50/50 ${selectedTest?.id === test.id ? "bg-blue-50/70" : ""}`
                }`}
              >
                <RiskCell>
                  <input type="checkbox" aria-label={`Select ${test.id}`} onClick={(event) => event.stopPropagation()} />
                </RiskCell>
                <RiskCell strong>{test.id}</RiskCell>
                <RiskCell>
                  <span className="font-black text-slate-900">
                    {test.title}
                  </span>
                </RiskCell>
                <RiskCell>
                  {renderStatusPill(test, applicability, workspaceData)}
                </RiskCell>
                <RiskCell>{renderProgressStatusPill(test, workspaceData)}</RiskCell>
                <RiskCell>{test.owner}</RiskCell>
                <RiskCell>{test.dueDate}</RiskCell>
                <RiskCell>{test.category}</RiskCell>
                <RiskCell>
                  <span className="inline-flex items-center gap-1 font-black">
                    <MessageSquare size={14} />
                    {test.comments}
                  </span>
                </RiskCell>
              </tr>
              );
            })}
          </tbody>
        </table>
        {!filteredTests.length && <EmptyRows label="tests" />}
      </div>

    </section>
  );
}

function PoliciesSection({ rows, questionnaireResponses, workspaceData, selectedFramework, onSelectWorkspaceItem }) {
  const [query, setQuery] = useState("");
  const [filterBy, setFilterBy] = useState("All");
  const [sortBy, setSortBy] = useState("title");

  const filteredPolicies = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return rows
      .filter((policy) => {
        const matchesQuery =
          !normalizedQuery ||
          Object.values(policy).join(" ").toLowerCase().includes(normalizedQuery);
        const matchesFilter =
          filterBy === "All" ||
          policy.status === filterBy ||
          policy.category === filterBy;

        return matchesQuery && matchesFilter;
      })
      .sort((a, b) => compareControlRows(a, b, sortBy));
  }, [filterBy, query, rows, sortBy]);

  const resetTable = () => {
    setQuery("");
    setFilterBy("All");
    setSortBy("title");
  };

  return (
    <section className="overflow-hidden rounded-lg border border-white/75 bg-white/62 shadow-xl shadow-slate-900/5 backdrop-blur">
      <div className="border-b border-slate-100 px-6 py-5">
        <SectionHeader
          title="Policies"
          description={`Review the policy library for ${selectedFramework.name}.`}
        />
      </div>

      <div className="border-b border-slate-100 p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <label className="relative min-w-0 flex-1">
            <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm font-semibold text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500"
              placeholder="Search policies by ID, title, or category"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <label className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm">
              <Filter size={16} />
              <select value={filterBy} onChange={(event) => setFilterBy(event.target.value)} className="bg-transparent font-bold outline-none">
                <option value="All">Filter</option>
                <option value="Library">Library</option>
                <option value="Access Control">Access control</option>
                <option value="Operations">Operations</option>
                <option value="Data Protection">Data protection</option>
                <option value="Governance">Governance</option>
              </select>
            </label>

            <label className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm">
              <ArrowUpDown size={16} />
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="bg-transparent font-bold outline-none">
                <option value="title">Sort by title</option>
                <option value="status">Sort by status</option>
                <option value="category">Sort by category</option>
              </select>
            </label>

            <ExportMenu compact data={{ ...emptyImplementationData, policies: rows }} />

            <button type="button" onClick={resetTable} className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50">
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[860px] w-full border-collapse text-left text-sm">
          <thead className="bg-slate-50/90 text-xs font-black uppercase tracking-wider text-slate-500">
            <tr>
              <th className="w-12 border-b border-slate-200 px-4 py-3">
                <input type="checkbox" aria-label="Select all policies" />
              </th>
              {policyColumns.map((column) => (
                <th key={column.key} className="border-b border-slate-200 px-4 py-3">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white/60">
            {filteredPolicies.map((policy) => {
              const applicability = getQuestionnaireApplicability(policy, questionnaireResponses);
              const isDisabled = applicability === "Not applicable";

              return (
              <tr
                key={policy.id}
                onClick={() => {
                  if (!isDisabled) onSelectWorkspaceItem(createWorkspaceItem("Policy", policy));
                }}
                onKeyDown={(event) => {
                  if (!isDisabled && (event.key === "Enter" || event.key === " ")) {
                    event.preventDefault();
                    onSelectWorkspaceItem(createWorkspaceItem("Policy", policy));
                  }
                }}
                role={isDisabled ? undefined : "button"}
                tabIndex={isDisabled ? -1 : 0}
                aria-disabled={isDisabled}
                className={`border-b border-slate-100 transition last:border-0 ${
                  isDisabled ? "cursor-not-allowed bg-slate-50/70 opacity-60" : "cursor-pointer hover:bg-blue-50/50"
                }`}
              >
                <RiskCell>
                  <input type="checkbox" aria-label={`Select ${policy.id}`} onClick={(event) => event.stopPropagation()} />
                </RiskCell>
                <RiskCell strong>{policy.id}</RiskCell>
                <RiskCell><span className="font-black text-slate-900">{policy.title}</span></RiskCell>
                <RiskCell>{renderStatusPill(policy, applicability, workspaceData)}</RiskCell>
                <RiskCell>{policy.owner}</RiskCell>
                <RiskCell>{policy.dueDate}</RiskCell>
                <RiskCell>{policy.category}</RiskCell>
                <RiskCell>{policy.comments}</RiskCell>
              </tr>
              );
            })}
          </tbody>
        </table>
        {!filteredPolicies.length && <EmptyRows label="policies" />}
      </div>
    </section>
  );
}

function MandatoryDocsSection({ rows, workspaceData, selectedFramework, onSelectWorkspaceItem }) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="divide-y divide-slate-100">
        {rows.map((document) => {
          const status = getMandatoryDocStatus(document, workspaceData);
          const isReady = status === "READY";

          return (
            <button
              key={document.id}
              type="button"
              onClick={() => onSelectWorkspaceItem(createWorkspaceItem("Policy", document))}
              className="grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 px-6 py-4 text-left transition hover:bg-blue-50/40 focus:bg-blue-50/60 focus:outline-none"
            >
              <span className="min-w-0 text-sm font-black text-slate-700">
                {document.title}
              </span>
              <span className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide ${
                isReady ? "text-blue-700" : "text-rose-600"
              }`}>
                <span className={`grid h-3.5 w-3.5 place-items-center rounded-full border text-[9px] leading-none ${
                  isReady ? "border-blue-500 text-blue-700" : "border-rose-500 text-rose-600"
                }`}>
                  {isReady ? "OK" : "!"}
                </span>
                {status}
              </span>
              <ArrowRight size={15} className="text-slate-300" aria-hidden="true" />
            </button>
          );
        })}
      </div>

      {!rows.length && (
        <div className="px-6 py-10 text-center text-sm font-semibold text-slate-400">
          No mandatory documents found for {selectedFramework.name}.
        </div>
      )}
    </section>
  );
}

function PopulationSection({ rows, questionnaireResponses, workspaceData, selectedFramework, onSelectWorkspaceItem }) {
  const [query, setQuery] = useState("");
  const [filterBy, setFilterBy] = useState("All");
  const [sortBy, setSortBy] = useState("dueDate");

  const filteredPopulations = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return rows
      .filter((population) => {
        const matchesQuery =
          !normalizedQuery ||
          Object.values(population).join(" ").toLowerCase().includes(normalizedQuery);
        const matchesFilter =
          filterBy === "All" ||
          population.status === filterBy ||
          population.category === filterBy;

        return matchesQuery && matchesFilter;
      })
      .sort((a, b) => compareControlRows(a, b, sortBy));
  }, [filterBy, query, rows, sortBy]);

  const resetTable = () => {
    setQuery("");
    setFilterBy("All");
    setSortBy("dueDate");
  };

  return (
    <section className="overflow-hidden rounded-lg border border-white/75 bg-white/62 shadow-xl shadow-slate-900/5 backdrop-blur">
      <div className="border-b border-slate-100 px-6 py-5">
        <SectionHeader
          title="Populations"
          description={`Review scoped populations for ${selectedFramework.name}.`}
        />
      </div>

      <div className="border-b border-slate-100 p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <label className="relative min-w-0 flex-1">
            <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm font-semibold text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500"
              placeholder="Search populations by ID, title, owner, or category"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <label className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm">
              <Filter size={16} />
              <select value={filterBy} onChange={(event) => setFilterBy(event.target.value)} className="bg-transparent font-bold outline-none">
                <option value="All">Filter</option>
                <option value="Ready">Ready</option>
                <option value="In Review">In review</option>
                <option value="Access Control">Access control</option>
                <option value="Infrastructure">Infrastructure</option>
                <option value="Workforce">Workforce</option>
              </select>
            </label>

            <label className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm">
              <ArrowUpDown size={16} />
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="bg-transparent font-bold outline-none">
                <option value="dueDate">Sort by due date</option>
                <option value="status">Sort by status</option>
                <option value="title">Sort by title</option>
              </select>
            </label>

            <ExportMenu compact data={{ ...emptyImplementationData, populations: rows }} />

            <button type="button" onClick={resetTable} className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50">
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[860px] w-full border-collapse text-left text-sm">
          <thead className="bg-slate-50/90 text-xs font-black uppercase tracking-wider text-slate-500">
            <tr>
              <th className="w-12 border-b border-slate-200 px-4 py-3">
                <input type="checkbox" aria-label="Select all populations" />
              </th>
              {populationColumns.map((column) => (
                <th key={column.key} className="border-b border-slate-200 px-4 py-3">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white/60">
            {filteredPopulations.map((population) => {
              const applicability = getQuestionnaireApplicability(population, questionnaireResponses);
              const isDisabled = applicability === "Not applicable";

              return (
              <tr
                key={population.id}
                onClick={() => {
                  if (!isDisabled) onSelectWorkspaceItem(createWorkspaceItem("Population", population));
                }}
                role={isDisabled ? undefined : "button"}
                tabIndex={isDisabled ? -1 : 0}
                aria-disabled={isDisabled}
                className={`border-b border-slate-100 transition last:border-0 ${
                  isDisabled ? "cursor-not-allowed bg-slate-50/70 opacity-60" : "cursor-pointer hover:bg-blue-50/50"
                }`}
              >
                <RiskCell>
                  <input type="checkbox" aria-label={`Select ${population.id}`} onClick={(event) => event.stopPropagation()} />
                </RiskCell>
                <RiskCell strong>{population.id}</RiskCell>
                <RiskCell><span className="font-black text-slate-900">{population.title}</span></RiskCell>
                <RiskCell>{renderStatusPill(population, applicability, workspaceData)}</RiskCell>
                <RiskCell>{renderProgressStatusPill(population, workspaceData)}</RiskCell>
                <RiskCell>{population.owner}</RiskCell>
                <RiskCell>{population.dueDate}</RiskCell>
                <RiskCell>{population.category}</RiskCell>
                <RiskCell>{population.mappedTests}</RiskCell>
                <RiskCell>{population.comments}</RiskCell>
              </tr>
              );
            })}
          </tbody>
        </table>
        {!filteredPopulations.length && <EmptyRows label="populations" />}
      </div>
    </section>
  );
}

class WorkspaceErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Implementation workspace failed to render", error, info);
  }

  componentDidUpdate(previousProps) {
    if (previousProps.itemKey !== this.props.itemKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <aside className="h-full min-w-0 overflow-y-auto bg-white p-5">
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-rose-500">Panel Error</p>
            <h2 className="mt-2 text-xl font-black text-slate-950">Details could not load</h2>
          </div>
          <button
            type="button"
            onClick={this.props.onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
            aria-label="Close details panel"
          >
            <X size={18} />
          </button>
        </div>
        <div className="mt-5 rounded-lg border border-rose-100 bg-rose-50 p-4">
          <p className="text-sm font-bold text-rose-800">
            The table is okay, but this record has saved data the details panel cannot display yet.
          </p>
          <p className="mt-3 break-words text-xs font-semibold leading-5 text-rose-700">
            {safeDisplayText(this.state.error?.message, "Unknown render error")}
          </p>
        </div>
      </aside>
    );
  }
}

function ImplementationWorkspace({ item, framework, data, savedState, workspaceData = {}, onWorkspaceStateChange, onClose, relationshipGraph, onNavigateRelatedItem }) {
  const { user } = useUser();
  const location = useLocation();
  const state = useMemo(() => savedState || {}, [savedState]);
  const graphLinkedItems = useMemo(
    () => getLinkedItemsFromGraph(item, data, relationshipGraph),
    [data, item, relationshipGraph]
  );
  const linkedItems = useMemo(
    () => resolveLinkedItemsWithOverrides(graphLinkedItems, data, state),
    [data, graphLinkedItems, state]
  );
  const frameworkBadge = framework?.shortName || framework?.name || "Framework";
  const [organizationStatus, setOrganizationStatus] = useState(state.status || "");
  const [dueDate, setDueDate] = useState(state.dueDate || "");
  const [linkingSection, setLinkingSection] = useState("");
  const [linkSelection, setLinkSelection] = useState("");
  const [assignments, setAssignments] = useState({
    owner: safeDisplayText(state.assignments?.owner, "Unassigned"),
    reviewer: safeDisplayText(state.assignments?.reviewer, "Unassigned"),
    approver: safeDisplayText(state.assignments?.approver, "Unassigned"),
  });
  const evidenceFiles = normalizeRelationshipList(state.evidenceFiles);
  const evidenceByRequirement = state.evidenceByRequirement && typeof state.evidenceByRequirement === "object" ? state.evidenceByRequirement : {};
  const linkedEvidenceIds = normalizeRelationshipList(state.linkedEvidenceIds);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState(() => normalizeRelationshipList(state.comments));
  const [timeline, setTimeline] = useState(() => normalizeRelationshipList(state.timeline));
  const tasks = normalizeRelationshipList(state.tasks);
  const {
    audit,
    evidenceStore,
    policies: centralPolicies,
    questionnaireResponses: centralQuestionnaireResponses,
    tasks: centralTasks,
    actions,
  } = useComplianceState();
  const evidenceRecords = evidenceStore.records;
  const setEvidenceRecords = actions.saveEvidenceRecords;
  const relationshipDetails = useMemo(
    () =>
      buildImplementationRelationshipDetails({
        item,
        linkedItems,
        data,
        evidenceRecords,
        audit,
        tasks: centralTasks,
        policies: centralPolicies,
        questionnaireResponses: centralQuestionnaireResponses,
        workspaceState: state,
      }),
    [audit, centralPolicies, centralQuestionnaireResponses, centralTasks, data, evidenceRecords, item, linkedItems, state]
  );
  const mappedPolicyDocument = useMemo(() => {
    if (item.type !== "Policy" || !framework?.id) return null;
    return loadPolicyLibrary(framework.id, centralPolicies, framework)
      .find((policy) => policy.id === item.id)?.document || null;
  }, [centralPolicies, framework, item.id, item.type]);
  const hasCurrentItemEvidence = hasEvidenceForItem(item, state);
  const linkedTests = normalizeRelationshipList(linkedItems.tests);
  const linkedControls = normalizeRelationshipList(linkedItems.controls);
  const completionRules = {
    test: {
      canComplete: hasCurrentItemEvidence,
      reason: "Add evidence for this test before marking it completed.",
    },
    control: {
      canComplete: linkedTests.length > 0 && linkedTests.every((test) => isStrictlyCompletedStatus(test, workspaceData)),
      reason: linkedTests.length
        ? "Complete every connected test before marking this control completed."
        : "Link at least one test and complete it before marking this control completed.",
    },
    risk: {
      canComplete:
        (linkedControls.length > 0 || linkedTests.length > 0) &&
        linkedControls.every((control) => isStrictlyCompletedStatus(control, workspaceData)) &&
        linkedTests.every((test) => isStrictlyCompletedStatus(test, workspaceData)),
      reason: linkedControls.length || linkedTests.length
        ? "Complete every connected control and test before marking this risk completed."
        : "Link connected controls or tests and complete them before marking this risk completed.",
    },
  };
  const navigateRelated = (type, relatedItem, mode = "resolve") => {
    if (!onNavigateRelatedItem) return;
    onNavigateRelatedItem(type, relatedItem, { mode });
  };

  const getLinkedIds = (family) =>
    normalizeRelationshipList(linkedItems[family]).map((relatedItem) => safeDisplayText(relatedItem.id)).filter(Boolean);

  const getAvailableLinkOptions = (family) => {
    const linkedIds = new Set(getLinkedIds(family));
    return normalizeRelationshipList(data?.[family])
      .filter((candidate) => {
        const id = safeDisplayText(candidate.id || candidate.name);
        return id && !linkedIds.has(id) && id !== safeDisplayText(item.id);
      })
      .map((candidate) => ({
        id: safeDisplayText(candidate.id || candidate.name),
        label: safeDisplayText(candidate.title || candidate.name || candidate.id, "Untitled"),
      }));
  };

  const openLinkPicker = (family) => {
    setLinkingSection((current) => (current === family ? "" : family));
    setLinkSelection("");
  };

  const linkRelatedItem = (family, relatedId) => {
    const key = linkedStateKeyByFamily[family];
    if (!key || !relatedId) return;

    const nextIds = [...new Set([...getLinkedIds(family), relatedId])];
    setLinkingSection("");
    setLinkSelection("");
    addTimelineEvent(`Linked ${singularRelationshipLabel(family)}`, { [key]: nextIds });
  };

  const unlinkRelatedItem = (family, relatedId) => {
    const key = linkedStateKeyByFamily[family];
    if (!key || !relatedId) return;

    const nextIds = getLinkedIds(family).filter((id) => id !== relatedId);
    addTimelineEvent(`Unlinked ${singularRelationshipLabel(family)}`, { [key]: nextIds });
  };

  const renderLinkPicker = (family) => {
    if (linkingSection !== family) return null;

    const options = getAvailableLinkOptions(family);
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
        {options.length ? (
          <>
            <select
              value={linkSelection}
              onChange={(event) => setLinkSelection(event.target.value)}
              className="h-9 w-full rounded border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700 outline-none"
            >
              <option value="">Select {singularRelationshipLabel(family).toLowerCase()}</option>
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.id} - {option.label}
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setLinkingSection("")}
                className="rounded border border-slate-200 bg-white px-3 py-1 text-xs font-black text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!linkSelection}
                onClick={() => linkRelatedItem(family, linkSelection)}
                className="rounded bg-slate-900 px-3 py-1 text-xs font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Add
              </button>
            </div>
          </>
        ) : (
          <p className="text-xs font-semibold text-slate-400">No available items to link.</p>
        )}
      </div>
    );
  };

  const renderLinkedCard = (family, relatedItem, typeLabel, options = {}) => (
    <div key={relatedItem.id} className={options.className || "rounded-lg border border-slate-200 bg-slate-50/50 p-3.5 space-y-3"}>
      <button
        type="button"
        onClick={() => navigateRelated(typeLabel, relatedItem)}
        className="block w-full text-left text-sm font-black text-slate-900 hover:text-blue-700"
      >
        {safeDisplayText(relatedItem.title || relatedItem.name || relatedItem.id, typeLabel)}
      </button>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-bold text-slate-500">{safeDisplayText(relatedItem.id)}</span>
        <div className="flex items-center gap-3">
          {options.badge && (
            <span className={options.badgeClassName || "rounded bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-500 uppercase"}>
              {options.badge}
            </span>
          )}
          <button
            type="button"
            onClick={() => unlinkRelatedItem(family, relatedItem.id)}
            className="text-xs font-black text-blue-600 hover:text-blue-700 hover:underline"
          >
            Unlink
          </button>
        </div>
      </div>
    </div>
  );

  // Load dynamic employee list (no fake fallbacks)
  const employeesList = useMemo(() => {
    try {
      const list = readScopedJson("spectramind:employees", []);
      const names = list.map((emp) => safeDisplayText(emp.name)).filter(Boolean);
      if (!names.includes("Unassigned")) names.push("Unassigned");
      return names;
    } catch {
      return ["Unassigned"];
    }
  }, []);

  // Risk Parameters
  const [initialLikelihood, setInitialLikelihood] = useState(state.initialLikelihood ?? 3);
  const [initialImpact, setInitialImpact] = useState(state.initialImpact ?? 5);
  const [treatment, setTreatment] = useState(state.treatment ?? "Minimize");
  const [residualLikelihood, setResidualLikelihood] = useState(state.residualLikelihood ?? 1);
  const [residualImpact, setResidualImpact] = useState(state.residualImpact ?? 3);

  const saveWorkspaceState = (overrides = {}) => {
    onWorkspaceStateChange(item.id, {
      status: organizationStatus,
      dueDate,
      assignments,
      evidenceFiles,
      evidenceByRequirement,
      linkedEvidenceIds,
      comments,
      timeline,
      tasks,
      ...getSavedLinkedOverrides(state),
      initialLikelihood,
      initialImpact,
      treatment,
      residualLikelihood,
      residualImpact,
      ...overrides,
    });
  };

  const handleEvidenceChange = (linkedEvidence) => {
    const nextEvidenceFiles = linkedEvidence.map((record) => {
      const version = record.versions?.find((candidate) => candidate.id === record.currentVersionId) || record.versions?.at(-1);
      return {
        id: record.id,
        name: version?.fileName || record.title,
        status: record.evidenceStatus || "Pending Review",
        version: version?.versionNumber || 1,
        uploadedAt: version?.uploadedAt || record.createdAt,
      };
    });
    const nextEvidenceIds = nextEvidenceFiles.map((evidence) => evidence.id);
    const nextTimeline = [
      // Event handlers intentionally create unique timeline identifiers.
      // eslint-disable-next-line react-hooks/purity
      { id: `evidence-${Date.now()}`, label: "Evidence updated" },
      ...timeline,
    ];

    setTimeline(nextTimeline);
    saveWorkspaceState({
      status: nextEvidenceFiles.length ? "Pending Review" : organizationStatus,
      evidenceFiles: nextEvidenceFiles,
      linkedEvidenceIds: nextEvidenceIds,
      evidenceCount: nextEvidenceFiles.length,
      timeline: nextTimeline,
    });
  };

  const addTimelineEvent = (label, stateOverrides = {}) => {
    const nextTimeline = [
      // Event handlers intentionally create unique timeline identifiers.
      // eslint-disable-next-line react-hooks/purity
      { id: `${timeline.length + 1}-${label}-${Date.now()}`, label },
      ...timeline,
    ];
    setTimeline(nextTimeline);
    saveWorkspaceState({ ...stateOverrides, timeline: nextTimeline });
  };

  const updateOrganizationStatus = (value) => {
    setOrganizationStatus(value);
    addTimelineEvent("Status updated", { status: value });
  };

  const updateDueDate = (value) => {
    setDueDate(value);
    addTimelineEvent("Due date updated", { dueDate: value });
  };

  const updateAssignment = (field, value) => {
    const nextAssignments = { ...assignments, [field]: value };
    setAssignments(nextAssignments);
    addTimelineEvent(`${fieldLabel(field)} updated`, { assignments: nextAssignments });
  };

  const handleRiskParamChange = (params) => {
    const nextParams = {
      initialLikelihood,
      initialImpact,
      treatment,
      residualLikelihood,
      residualImpact,
      ...params,
    };
    if (params.initialLikelihood !== undefined) setInitialLikelihood(params.initialLikelihood);
    if (params.initialImpact !== undefined) setInitialImpact(params.initialImpact);
    if (params.treatment !== undefined) setTreatment(params.treatment);
    if (params.residualLikelihood !== undefined) setResidualLikelihood(params.residualLikelihood);
    if (params.residualImpact !== undefined) setResidualImpact(params.residualImpact);

    saveWorkspaceState(nextParams);
    addTimelineEvent("Risk parameters updated", nextParams);
  };

  const addComment = () => {
    const trimmedComment = commentText.trim();
    if (!trimmedComment) return;
    const newCommentObj = {
      // Event handlers intentionally create unique comment identifiers.
      // eslint-disable-next-line react-hooks/purity
      id: `comment-${Date.now()}`,
      user: user?.name || "User",
      text: trimmedComment,
      timestamp: new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
    };
    const nextComments = [newCommentObj, ...comments];
    setComments(nextComments);
    setCommentText("");
    addTimelineEvent("Comment added", { comments: nextComments });
  };

  const renderComment = (comment, index) => {
    const isObj = typeof comment === "object" && comment !== null;
    const userName = isObj ? comment.user : "User";
    const userLabel = safeDisplayText(userName, "User");
    const userInitial = userLabel[0] || "U";
    const text = safeDisplayText(isObj ? comment.text : comment);
    const time = safeDisplayText(isObj ? comment.timestamp : "Just now", "Just now");

    return (
      <div key={index} className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-xs font-black text-blue-700 uppercase">
              {userInitial}
            </span>
            <div>
              <p className="text-xs font-black text-slate-900">{userLabel}</p>
              <p className="text-[10px] font-bold text-slate-400">{time}</p>
            </div>
          </div>
        </div>
        <p className="text-xs leading-5 text-slate-600 font-semibold">{text}</p>
      </div>
    );
  };

  const renderRelationshipExtras = () => (
    <>
      <RelationshipSummaryBadges details={relationshipDetails} onNavigate={navigateRelated} />
      <RelatedSection
        title="Connected Policies"
        items={relationshipDetails.policies}
        emptyLabel="No connected policies."
        onOpen={(policy) => navigateRelated("Policy", policy)}
      />
      <RelatedSection
        title="Connected Evidence"
        items={relationshipDetails.evidence}
        emptyLabel="No connected evidence."
        onOpen={(evidence) => navigateRelated("Evidence", evidence)}
      />
      <RelatedSection
        title="Recent Activity"
        items={relationshipDetails.activity}
        emptyLabel="No recent activity."
        readOnly
      />
    </>
  );

  // ── 1. TEST DRAWER LAYOUT ──────────────────────────────────────────────────
  if (item.type === "Test") {
    const progressStatus = getProgressStatus(item, { [item.id]: state });
    const isCompleted = progressStatus === "Completed";

    return (
      <aside className="h-full min-w-0 overflow-y-auto bg-white p-5 space-y-6 w-full">
        {/* Drawer Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div className="space-y-2">
            <div className="flex gap-2">
              <span className="inline-flex rounded bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-500 uppercase tracking-wide">
                {isCompleted ? "COMPLETED" : "READY"}
              </span>
              <span className="inline-flex rounded bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-500 uppercase tracking-wide">
                {frameworkBadge}
              </span>
            </div>
            <h2 className="text-xl font-black text-slate-950">
              {safeDisplayText(item.id, "Test").replace("TEST-", "Test ")}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-50 hover:text-slate-750"
          >
            <X size={18} />
          </button>
        </div>

        {/* Guidance Callout Box */}
        <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-4">
          <h4 className="text-[10px] font-black uppercase tracking-wider text-indigo-700">Guidance</h4>
          <p className="mt-2 text-sm leading-6 text-indigo-950/90">
            {safeDisplayText(item.guidance, "Provide documentation showing that your organization completed a physical access review within the last 12 months.")}
          </p>
        </div>

        {/* Completion Section */}
        <div className="space-y-2 border-b border-slate-100 pb-5">
          <CompletionStatusControl
            typeLabel="test"
            isCompleted={isCompleted}
            canComplete={completionRules.test.canComplete}
            blockedReason={completionRules.test.reason}
            onComplete={() => updateOrganizationStatus("Completed")}
            onReopen={() => updateOrganizationStatus("In Progress")}
          />
        </div>

        {/* Details Section */}
        <div className="space-y-3 border-b border-slate-100 pb-5">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Details</h4>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-semibold">Assigned</span>
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-50 text-[10px] font-black text-blue-700 uppercase">
                  {assignments.owner[0]}
                </span>
                <select
                  value={assignments.owner}
                  onChange={(e) => updateAssignment("owner", e.target.value)}
                  className="bg-transparent font-bold text-slate-800 outline-none cursor-pointer"
                >
                  {employeesList.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-semibold">Due Date</span>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => updateDueDate(e.target.value)}
                className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 font-bold text-slate-700 outline-none text-xs"
              />
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-semibold">Category</span>
              <span className="font-bold text-slate-800">{safeDisplayText(item.category, "General")}</span>
            </div>
          </div>
        </div>

        {renderRelationshipExtras()}

        {/* Mapped Controls Section */}
        <div className="space-y-3 border-b border-slate-100 pb-5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Mapped Controls</h4>
            <button
              type="button"
              onClick={() => openLinkPicker("controls")}
              className="rounded border border-slate-200 px-2 py-0.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              Link
            </button>
          </div>
          {renderLinkPicker("controls")}
          {linkedItems.controls?.map((ctrl) =>
            renderLinkedCard("controls", ctrl, "Control", { badge: "Implemented" })
          )}
          {!linkedItems.controls?.length && (
            <p className="text-xs font-semibold text-slate-400 italic">No mapped controls.</p>
          )}
        </div>

        <EvidenceManagementSection
          context={buildEvidenceContext({ item, linkedItems, framework, frameworkBadge })}
          records={evidenceRecords}
          onRecordsChange={setEvidenceRecords}
          onEvidenceChange={handleEvidenceChange}
        />

        {/* History Section */}
        <div className="space-y-3 border-b border-slate-100 pb-5">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">History</h4>
          <div className="space-y-3">
            {/* Custom comments list */}
            {comments.map((comment, index) => renderComment(comment, index))}

            {!comments.length && (
              <p className="py-2 text-center text-xs font-semibold text-slate-400">There are no comments yet</p>
            )}
          </div>
        </div>

        {/* Comment Editor Box */}
        <div className="space-y-3">
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Write a comment..."
            className="w-full min-h-20 rounded-lg border border-slate-200 p-3 text-sm text-slate-800 outline-none focus:border-blue-500"
          />
          <div className="flex items-center justify-between">
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50">
              Unassigned
              <ChevronDown size={14} />
            </button>
            <button
              onClick={addComment}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white transition hover:bg-blue-700"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </aside>
    );
  }

  // ── 2. CONTROL DRAWER LAYOUT ───────────────────────────────────────────────
  if (item.type === "Control") {
    const progressStatus = getProgressStatus(item, { [item.id]: state });
    const isImplemented = progressStatus === "Completed";

    return (
      <aside className="h-full min-w-0 overflow-y-auto bg-white p-5 space-y-6 w-full">
        {/* Drawer Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div className="space-y-2">
            <div className="flex gap-2">
              <span className="inline-flex rounded bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-500 uppercase tracking-wide">
                {isImplemented ? "IMPLEMENTED" : "IN PROGRESS"}
              </span>
              <span className="inline-flex rounded bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-500 uppercase tracking-wide">
                {frameworkBadge}
              </span>
            </div>
            <h2 className="text-xl font-black text-slate-950">
              {safeDisplayText(item.id)}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-50 hover:text-slate-750"
          >
            <X size={18} />
          </button>
        </div>

        {/* Description Section */}
        <div className="space-y-2 border-b border-slate-100 pb-5">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Description</h4>
          <p className="text-sm leading-6 text-slate-700">
            {safeDisplayText(item.description)}
          </p>
        </div>

        {/* Details Section */}
        <div className="space-y-3 border-b border-slate-100 pb-5">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Details</h4>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-semibold">Assigned</span>
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-50 text-[10px] font-black text-blue-700 uppercase">
                  {assignments.owner[0]}
                </span>
                <select
                  value={assignments.owner}
                  onChange={(e) => updateAssignment("owner", e.target.value)}
                  className="bg-transparent font-bold text-slate-800 outline-none cursor-pointer"
                >
                  {employeesList.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-semibold">Due Date</span>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => updateDueDate(e.target.value)}
                className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 font-bold text-slate-700 outline-none text-xs"
              />
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-semibold">Category</span>
              <span className="font-bold text-slate-800">{safeDisplayText(item.category, "Compliance")}</span>
            </div>
          </div>
        </div>

        {renderRelationshipExtras()}

        <div className="space-y-2 border-b border-slate-100 pb-5">
          <CompletionStatusControl
            typeLabel="control"
            isCompleted={isImplemented}
            canComplete={completionRules.control.canComplete}
            blockedReason={completionRules.control.reason}
            onComplete={() => updateOrganizationStatus("Completed")}
            onReopen={() => updateOrganizationStatus("In Progress")}
          />
        </div>

        {/* Linked Tests Section */}
        <div className="space-y-3 border-b border-slate-100 pb-5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Connected Tests</h4>
            <button
              type="button"
              onClick={() => openLinkPicker("tests")}
              className="rounded border border-slate-200 px-2 py-0.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              Link
            </button>
          </div>
          {renderLinkPicker("tests")}
          {linkedItems.tests?.map((t) =>
            renderLinkedCard("tests", t, "Test", {
              badge: "Ready",
              badgeClassName: "rounded bg-blue-50 px-2.5 py-0.5 text-[10px] font-black text-blue-700 uppercase",
            })
          )}
          {!linkedItems.tests?.length && (
            <p className="text-xs font-semibold text-slate-400 italic">No connected tests.</p>
          )}
        </div>

        {/* Linked Risk Scenarios Section */}
        <div className="space-y-3 border-b border-slate-100 pb-5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Mitigated Risks</h4>
            <button
              type="button"
              onClick={() => openLinkPicker("risks")}
              className="rounded border border-slate-200 px-2 py-0.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              Link
            </button>
          </div>
          {renderLinkPicker("risks")}
          {linkedItems.risks?.map((r) =>
            renderLinkedCard("risks", r, "Risk", {
              badge: "Mitigated",
              badgeClassName: "rounded bg-rose-50 px-2 py-0.5 text-[10px] font-black text-rose-700",
            })
          )}
          {!linkedItems.risks?.length && (
            <p className="text-xs font-semibold text-slate-400 italic">No mitigated risks.</p>
          )}
        </div>

        {/* Comment History Section */}
        <div className="space-y-3 border-b border-slate-100 pb-5">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">History</h4>
          <div className="space-y-3">
            {comments.map((comment, index) => renderComment(comment, index))}
            {!comments.length && (
              <p className="py-2 text-center text-xs font-semibold text-slate-400">There are no comments yet</p>
            )}
          </div>
        </div>

        {/* Comment Input */}
        <div className="space-y-3">
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Write a comment..."
            className="w-full min-h-20 rounded-lg border border-slate-200 p-3 text-sm text-slate-800 outline-none focus:border-blue-500"
          />
          <div className="flex justify-end">
            <button
              onClick={addComment}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white transition hover:bg-blue-700"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </aside>
    );
  }

  // ── 3. RISK SCENARIO DRAWER LAYOUT (MATCHES SCREENSHOT) ─────────────────────
  if (item.type === "Risk") {
    const progressStatus = getProgressStatus(item, { [item.id]: state });
    const isCompleted = progressStatus === "Completed";
    const initialRiskScore = initialLikelihood * initialImpact;
    const residualRiskScore = residualLikelihood * residualImpact;

    return (
      <aside className="h-full min-w-0 overflow-y-auto bg-white p-5 space-y-6 w-full">
        {/* Drawer Header */}
        <div className="flex items-start justify-between border-b border-slate-105 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-black tracking-wide uppercase ${
                isCompleted ? "bg-emerald-50 text-emerald-700" : "bg-purple-50 text-purple-700"
              }`}>
                {!isCompleted && (
                  <span className="h-1.5 w-1.5 rounded-full bg-purple-500 inline-block mr-0.5" />
                )}
                {isCompleted ? "COMPLETED" : "READY"}
              </span>
              <span className="inline-flex rounded bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-500 uppercase tracking-wide">
                {frameworkBadge}
              </span>
            </div>
            <h2 className="text-xl font-black text-slate-950 mt-1">
              Risk Scenario {safeDisplayText(item.id)}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-50 hover:text-slate-750"
          >
            <X size={18} />
          </button>
        </div>

        {/* Description Section */}
        <div className="space-y-1">
          <p className="text-sm leading-6 text-slate-700">
            {safeDisplayText(item.description, "The absence or failure to ensure compliance with information security policies, rules, and standards...")}
          </p>
        </div>

        {/* Completion Action */}
        <div className="border-b border-slate-100 pb-4">
          <CompletionStatusControl
            typeLabel="risk scenario"
            isCompleted={isCompleted}
            canComplete={completionRules.risk.canComplete}
            blockedReason={completionRules.risk.reason}
            onComplete={() => updateOrganizationStatus("Completed")}
            onReopen={() => updateOrganizationStatus("In Progress")}
          />
        </div>

        {/* Details Section */}
        <div className="space-y-3 border-t border-slate-100 pt-4">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Details</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-400 font-semibold text-xs uppercase">Assigned to</p>
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] font-black text-white uppercase">
                  {assignments.owner[0]}
                </span>
                <select
                  value={assignments.owner}
                  onChange={(e) => updateAssignment("owner", e.target.value)}
                  className="bg-transparent font-bold text-slate-800 outline-none cursor-pointer"
                >
                  {employeesList.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <p className="text-slate-400 font-semibold text-xs uppercase">Category</p>
              <p className="font-bold text-slate-800 mt-2">{safeDisplayText(item.category, "Operations")}</p>
            </div>
          </div>
        </div>

        {renderRelationshipExtras()}

        {/* Initial Risk Section */}
        <div className="rounded-xl border border-slate-150 p-4 space-y-4 bg-white shadow-sm">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-black text-slate-900">Initial Risk</h4>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-black text-slate-600">
              {initialRiskScore}
            </span>
          </div>

          {/* Likelihood Slider */}
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-850">Likelihood:</p>
            <input
              type="range"
              min="1"
              max="5"
              step="1"
              value={initialLikelihood}
              disabled={isCompleted}
              onChange={(e) => handleRiskParamChange({ initialLikelihood: parseInt(e.target.value) })}
              className={`w-full h-1 rounded-lg appearance-none cursor-pointer accent-indigo-650 ${
                isCompleted ? "bg-slate-100 cursor-not-allowed" : "bg-indigo-100"
              }`}
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-bold px-1 mt-1">
              <span>1</span>
              <span>2</span>
              <span>3</span>
              <span>4</span>
              <span>5</span>
            </div>
          </div>

          {/* Impact Slider */}
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-850">Impact:</p>
            <input
              type="range"
              min="1"
              max="5"
              step="1"
              value={initialImpact}
              disabled={isCompleted}
              onChange={(e) => handleRiskParamChange({ initialImpact: parseInt(e.target.value) })}
              className={`w-full h-1 rounded-lg appearance-none cursor-pointer accent-indigo-650 ${
                isCompleted ? "bg-slate-100 cursor-not-allowed" : "bg-indigo-100"
              }`}
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-bold px-1 mt-1">
              <span>1</span>
              <span>2</span>
              <span>3</span>
              <span>4</span>
              <span>5</span>
            </div>
          </div>
        </div>

        {/* Treatment Radios */}
        <div className="space-y-2">
          <div className="flex items-center gap-1">
            <h4 className="text-sm font-black text-slate-900">Treatment</h4>
            <span className="text-slate-400 cursor-help">ℹ️</span>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-700">
            {["Tolerate", "Eliminate", "Minimize", "Outsource"].map((option) => (
              <label key={option} className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="risk-treatment"
                  value={option}
                  disabled={isCompleted}
                  checked={treatment === option}
                  onChange={() => handleRiskParamChange({ treatment: option })}
                  className="h-4 w-4 text-indigo-650 border-indigo-350 focus:ring-indigo-500 cursor-pointer"
                />
                {option}
              </label>
            ))}
          </div>
        </div>

        {/* Residual Risk Section */}
        <div className="rounded-xl border border-slate-150 p-4 space-y-4 bg-white shadow-sm">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-black text-slate-900">Residual Risk</h4>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-black text-slate-600">
              {residualRiskScore}
            </span>
          </div>

          {/* Likelihood Slider */}
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-850">Likelihood:</p>
            <input
              type="range"
              min="1"
              max="5"
              step="1"
              value={residualLikelihood}
              disabled={isCompleted}
              onChange={(e) => handleRiskParamChange({ residualLikelihood: parseInt(e.target.value) })}
              className={`w-full h-1 rounded-lg appearance-none cursor-pointer accent-indigo-650 ${
                isCompleted ? "bg-slate-100 cursor-not-allowed" : "bg-indigo-100"
              }`}
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-bold px-1 mt-1">
              <span>1</span>
              <span>2</span>
              <span>3</span>
              <span>4</span>
              <span>5</span>
            </div>
          </div>

          {/* Impact Slider */}
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-850">Impact:</p>
            <input
              type="range"
              min="1"
              max="5"
              step="1"
              value={residualImpact}
              disabled={isCompleted}
              onChange={(e) => handleRiskParamChange({ residualImpact: parseInt(e.target.value) })}
              className={`w-full h-1 rounded-lg appearance-none cursor-pointer accent-indigo-650 ${
                isCompleted ? "bg-slate-100 cursor-not-allowed" : "bg-indigo-100"
              }`}
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-bold px-1 mt-1">
              <span>1</span>
              <span>2</span>
              <span>3</span>
              <span>4</span>
              <span>5</span>
            </div>
          </div>
        </div>

        {/* Mapped Controls Section */}
        <div className="space-y-3 border-b border-slate-100 pb-5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Mapped Controls</h4>
            <button
              type="button"
              onClick={() => openLinkPicker("controls")}
              className="rounded bg-slate-900 border border-slate-900 px-3 py-1 text-xs font-black text-white hover:bg-slate-800"
            >
              Link
            </button>
          </div>
          {renderLinkPicker("controls")}
          {linkedItems.controls?.map((ctrl) =>
            renderLinkedCard("controls", ctrl, "Control", {
              badge: "Implemented",
              className: "rounded-lg border border-slate-150 p-4 space-y-3.5 bg-white",
              badgeClassName: "rounded bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[10px] font-black text-indigo-700 uppercase",
            })
          )}
          {!linkedItems.controls?.length && (
            <p className="text-xs font-semibold text-slate-400 italic">No mapped controls.</p>
          )}
        </div>

        {/* History / Comment Timeline Section */}
        <div className="space-y-3">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">History</h4>
          <div className="space-y-3">
            {comments.map((comment, index) => renderComment(comment, index))}
            {!comments.length && (
              <p className="py-8 text-center text-xs font-semibold text-slate-400">There are no comments yet</p>
            )}
          </div>
        </div>

        {/* Comment Editor Box */}
        <div className="space-y-3">
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Write a comment..."
            className="w-full min-h-20 rounded-lg border border-slate-200 p-3 text-sm text-slate-800 outline-none focus:border-blue-500"
          />
          <div className="flex justify-end">
            <button
              onClick={addComment}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white transition hover:bg-blue-700"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </aside>
    );
  }

  if (item.type === "Population") {
    const progressStatus = getProgressStatus(item, { [item.id]: state });
    const isCompleted = progressStatus === "Completed";

    return (
      <aside className="h-full min-w-0 overflow-y-auto bg-white p-5 space-y-6 w-full">
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div className="space-y-2">
            <div className="flex gap-2">
              <span className={`inline-flex rounded px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${
                isCompleted ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"
              }`}>
                {isCompleted ? "COMPLETED" : "IN PROGRESS"}
              </span>
              <span className="inline-flex rounded bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-slate-500">
                {frameworkBadge}
              </span>
            </div>
            <h2 className="text-xl font-black text-slate-950">
              {safeDisplayText(item.title || item.name || item.id, "Population")}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-50 hover:text-slate-750"
            aria-label="Close details panel"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-2 border-b border-slate-100 pb-5">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Description</h4>
          <p className="text-sm leading-6 text-slate-700">
            {safeDisplayText(item.description || item.title, "Review this scoped population and keep ownership, due date, evidence, and linked tests current.")}
          </p>
        </div>

        <div className="space-y-2 border-b border-slate-100 pb-5">
          <CompletionStatusControl
            typeLabel="population"
            isCompleted={isCompleted}
            onComplete={() => updateOrganizationStatus("Completed")}
            onReopen={() => updateOrganizationStatus("In Progress")}
          />
        </div>

        <div className="space-y-3 border-b border-slate-100 pb-5">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Details</h4>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-500">Assigned</span>
              <select
                value={assignments.owner}
                onChange={(event) => updateAssignment("owner", event.target.value)}
                className="bg-transparent font-bold text-slate-800 outline-none cursor-pointer"
              >
                {employeesList.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-500">Due Date</span>
              <input
                type="date"
                value={dueDate}
                onChange={(event) => updateDueDate(event.target.value)}
                className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-bold text-slate-700 outline-none"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-500">Category</span>
              <span className="font-bold text-slate-800">{safeDisplayText(item.category, "Population Management")}</span>
            </div>
          </div>
        </div>

        {renderRelationshipExtras()}

        <div className="space-y-3 border-b border-slate-100 pb-5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Connected Tests</h4>
            <button
              type="button"
              onClick={() => openLinkPicker("tests")}
              className="rounded border border-slate-200 px-2 py-0.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              Link
            </button>
          </div>
          {renderLinkPicker("tests")}
          {linkedItems.tests?.map((test) =>
            renderLinkedCard("tests", test, "Test", {
              badge: "Ready",
              badgeClassName: "rounded bg-blue-50 px-2.5 py-0.5 text-[10px] font-black text-blue-700 uppercase",
            })
          )}
          {!linkedItems.tests?.length && (
            <p className="text-xs font-semibold text-slate-400 italic">No connected tests.</p>
          )}
        </div>

        <div className="space-y-3 border-b border-slate-100 pb-5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Mapped Controls</h4>
            <button
              type="button"
              onClick={() => openLinkPicker("controls")}
              className="rounded border border-slate-200 px-2 py-0.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              Link
            </button>
          </div>
          {renderLinkPicker("controls")}
          {linkedItems.controls?.map((control) =>
            renderLinkedCard("controls", control, "Control", { badge: "Implemented" })
          )}
          {!linkedItems.controls?.length && (
            <p className="text-xs font-semibold text-slate-400 italic">No mapped controls.</p>
          )}
        </div>

        <div className="space-y-3 border-b border-slate-100 pb-5">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">History</h4>
          {comments.map((comment, index) => renderComment(comment, index))}
          {!comments.length && (
            <p className="py-2 text-center text-xs font-semibold text-slate-400">There are no comments yet</p>
          )}
        </div>

        <div className="space-y-3">
          <textarea
            value={commentText}
            onChange={(event) => setCommentText(event.target.value)}
            placeholder="Write a comment..."
            className="w-full min-h-20 rounded-lg border border-slate-200 p-3 text-sm text-slate-800 outline-none focus:border-blue-500"
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={addComment}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white transition hover:bg-blue-700"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </aside>
    );
  }

  if (item.type === "Policy") {
    const isReady = ["ready", "approved", "implemented", "complete", "completed"].includes(
      String(organizationStatus).toLowerCase()
    );

    return (
      <aside className="h-full min-w-0 overflow-y-auto bg-white p-5 space-y-6 w-full">
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div className="space-y-2">
            <div className="flex gap-2">
              <span className={`inline-flex rounded px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${
                isReady ? "bg-blue-50 text-blue-700" : "bg-rose-50 text-rose-700"
              }`}>
                {isReady ? "READY" : "NOT READY"}
              </span>
              <span className="inline-flex rounded bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-slate-500">
                {frameworkBadge}
              </span>
            </div>
            <h2 className="text-xl font-black text-slate-950">
              {safeDisplayText(item.title || item.name || item.id, "Policy")}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-50 hover:text-slate-750"
            aria-label="Close details panel"
          >
            <X size={18} />
          </button>
        </div>

        <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-4">
          <h4 className="text-[10px] font-black uppercase tracking-wider text-blue-700">Mandatory Document</h4>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            {safeDisplayText(item.description, `Review the ${safeDisplayText(item.title || item.name || item.id, "selected")} policy document status for the selected framework.`)}
          </p>
        </div>

        <div className="grid gap-3 border-b border-slate-100 pb-5 text-sm">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Details</h4>
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-500">Assigned to</span>
            <select
              value={assignments.owner}
              onChange={(e) => updateAssignment("owner", e.target.value)}
              className="bg-transparent font-bold text-slate-800 outline-none cursor-pointer"
            >
              {employeesList.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-500">Due Date</span>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => updateDueDate(e.target.value)}
              className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-bold text-slate-700 outline-none"
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-500">Category</span>
            <span className="font-bold text-slate-800">{safeDisplayText(item.category, "Mandatory Docs")}</span>
          </div>
        </div>

        <div className="space-y-3 border-b border-slate-100 pb-5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Linked Documents</h4>
            <button
              type="button"
              onClick={() => updateOrganizationStatus("Ready")}
              className="rounded border border-slate-200 px-2 py-1 text-xs font-black text-slate-700 transition hover:bg-slate-50"
            >
              Mark Ready
            </button>
          </div>
          {mappedPolicyDocument ? (
            <Link
              to={`/policies/${encodeURIComponent(item.id)}/document`}
              state={{ returnTo: `${location.pathname}${location.search}` }}
              className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-blue-100 bg-blue-50/50 p-3 transition hover:border-blue-300 hover:bg-blue-50"
            >
              <div className="flex min-w-0 items-center gap-3">
                <FileText size={17} className="shrink-0 text-blue-600" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-slate-900" title={mappedPolicyDocument.name}>{safeDisplayText(mappedPolicyDocument.name, `${item.title}.html`)}</p>
                  <p className="text-xs font-semibold text-slate-400">Mapped policy document</p>
                </div>
              </div>
              <ArrowRight size={16} className="shrink-0 text-blue-500" />
            </Link>
          ) : null}
          {evidenceFiles.length ? (
            <div className="space-y-2">
              {evidenceFiles.map((file) => (
                <div key={file.id || file.name} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                  <FileText size={16} className="text-blue-600" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-slate-900">{safeDisplayText(file.name, "Document")}</p>
                    <p className="text-xs font-semibold text-slate-400">{safeDisplayText(file.uploadedAt, "Uploaded")}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : !mappedPolicyDocument ? (
            <p className="rounded-lg border border-dashed border-slate-200 px-4 py-5 text-center text-xs font-semibold text-slate-400">
              No policy document linked yet.
            </p>
          ) : null}
        </div>

        <div className="space-y-3 border-b border-slate-100 pb-5">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Mapped Controls</h4>
          {linkedItems.controls?.length ? (
            linkedItems.controls.map((ctrl) => (
              <div key={ctrl.id} className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-sm font-black text-slate-900">{safeDisplayText(ctrl.title || ctrl.name || ctrl.id, "Control")}</p>
                <p className="mt-1 text-xs font-bold text-slate-400">{safeDisplayText(ctrl.id)}</p>
              </div>
            ))
          ) : (
            <p className="text-xs font-semibold text-slate-400 italic">No mapped controls.</p>
          )}
        </div>

        <div className="space-y-3">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">History</h4>
          {comments.map((comment, index) => renderComment(comment, index))}
          {!comments.length && (
            <p className="py-6 text-center text-xs font-semibold text-slate-400">There are no comments yet</p>
          )}
        </div>
      </aside>
    );
  }

  return (
    <aside className="h-full min-w-0 overflow-y-auto bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">
            Library · {framework.name}
          </p>
          <h2 className="mt-2 text-xl font-black text-slate-950">
            {safeDisplayText(item.id)}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          aria-label="Close details panel"
        >
          <X size={18} />
        </button>
      </div>
    </aside>
  );
}

function buildEvidenceContext({ item, linkedItems, framework, frameworkBadge }) {
  const itemType = String(item.type || "").toLowerCase();
  const linkedControlIds = normalizeRelationshipList(linkedItems.controls).map((control) => safeDisplayText(control.id)).filter(Boolean);
  const itemLinkedControlIds = normalizeRelationshipList(item.linkedControls).map((controlId) => safeDisplayText(controlId)).filter(Boolean);
  const controlIds = itemType === "control"
    ? [safeDisplayText(item.id)].filter(Boolean)
    : [...new Set([...linkedControlIds, ...itemLinkedControlIds])];

  return {
    frameworkId: framework?.id || framework?.slug || frameworkBadge,
    domain: safeDisplayText(item.category || item.domain || item.annexDomain, "General"),
    controlIds,
    testId: itemType === "test" ? safeDisplayText(item.id) : "",
    implementationId: safeDisplayText(item.id),
  };
}

function CompletionStatusControl({ typeLabel, isCompleted, canComplete = true, blockedReason = "", onComplete, onReopen }) {
  const isBlocked = !isCompleted && !canComplete;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-black text-slate-900">
            {isCompleted ? `This ${typeLabel} is completed` : `Mark this ${typeLabel} as completed`}
          </h4>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
            {isCompleted
              ? "Completed items appear as completed in the implementation table."
              : isBlocked
                ? blockedReason
                : "Use this when the work for this item is finished."}
          </p>
        </div>
        {isCompleted ? (
          <span className="shrink-0 rounded bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase text-emerald-700">
            Completed
          </span>
        ) : null}
      </div>
      <button
        type="button"
        disabled={isBlocked}
        onClick={isCompleted ? onReopen : onComplete}
        className={`rounded-lg px-4 py-2 text-xs font-black transition ${
          isCompleted
            ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            : isBlocked
              ? "cursor-not-allowed bg-slate-200 text-slate-500"
            : "bg-emerald-600 text-white hover:bg-emerald-700"
        }`}
      >
        {isCompleted ? "Mark as In Progress" : "Mark as Completed"}
      </button>
    </div>
  );
}

function RelationshipSummaryBadges({ details, onNavigate }) {
  const summaries = [
    { label: "Policies", count: details.policies.length, type: "Policy", item: details.policies[0] },
    { label: "Evidence", count: details.evidence.length, type: "Evidence", item: details.evidence[0] },
    { label: "Tasks", count: details.tasks.length, type: "Task", item: details.tasks[0] },
    { label: "Findings", count: details.auditFindings.length, type: "Audit", item: details.auditFindings[0] },
  ];

  if (!summaries.some((summary) => summary.count)) return null;

  return (
    <div className="grid grid-cols-2 gap-2 border-b border-slate-100 pb-5">
      {summaries.map((summary) => (
        <button
          key={summary.label}
          type="button"
          disabled={!summary.count || !summary.item}
          onClick={() => summary.item && onNavigate?.(summary.type, summary.item, "view")}
          className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-left transition hover:bg-blue-50 disabled:cursor-default disabled:hover:bg-slate-50/70"
        >
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{summary.label}</p>
          <p className="mt-1 text-lg font-black text-slate-900">{summary.count}</p>
        </button>
      ))}
    </div>
  );
}

function RelatedSection({ title, items, emptyLabel, onOpen, readOnly = false }) {
  return (
    <div className="space-y-3 border-b border-slate-100 pb-5">
      <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">{title}</h4>
      {items.length ? (
        items.slice(0, 4).map((relatedItem) => {
          const body = relatedItem.description || relatedItem.summary || relatedItem.reason || relatedItem.status || relatedItem.id;
          const titleText = safeDisplayText(relatedItem.title || relatedItem.name || relatedItem.id, "Related item");
          const statusText = safeDisplayText(relatedItem.status);
          const bodyText = safeDisplayText(body);
          const content = (
            <>
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-black text-slate-900">{titleText}</p>
                {statusText ? (
                  <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase text-slate-500">
                    {statusText}
                  </span>
                ) : null}
              </div>
              {bodyText ? <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-slate-500">{bodyText}</p> : null}
            </>
          );

          if (readOnly) {
            return (
              <div key={relatedItem.id || relatedItem.title} className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                {content}
              </div>
            );
          }

          return (
            <button
              key={relatedItem.id || relatedItem.title}
              type="button"
              onClick={() => onOpen?.(relatedItem)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-left transition hover:bg-blue-50/40"
            >
              {content}
            </button>
          );
        })
      ) : (
        <p className="text-xs font-semibold italic text-slate-400">{emptyLabel}</p>
      )}
    </div>
  );
}

function buildImplementationRelationshipDetails({
  item,
  linkedItems,
  data,
  evidenceRecords,
  audit,
  tasks,
  policies,
  questionnaireResponses,
  workspaceState,
}) {
  const relatedIds = collectRelatedIds(item, linkedItems, workspaceState);
  const policyRows = uniqueById([
    ...normalizeRelationshipList(linkedItems.policies),
    ...normalizeRelationshipList(data.policies).filter((policy) => relatedIds.has(policy.id) || intersects(policy.linkedControls, relatedIds)),
    ...normalizeRelationshipList(policies).filter((policy) => relatedIds.has(policy.id) || intersects(policy.linkedControls || policy.relatedControls, relatedIds)),
  ]).map((policy) => ({
    id: safeDisplayText(policy.id),
    title: safeDisplayText(policy.title || policy.name || policy.id, "Policy"),
    status: safeDisplayText(policy.status || policy.approvalStatus || "Policy"),
    description: safeDisplayText(policy.description || policy.summary),
  }));

  return {
    policies: policyRows,
    evidence: collectRelatedEvidence(evidenceRecords, relatedIds, item),
    questionnaire: collectQuestionnaireAnswers(questionnaireResponses, relatedIds, item),
    tasks: collectRelatedTasks(tasks, relatedIds, item),
    auditFindings: collectAuditFindings(audit, relatedIds, item),
    activity: collectActivity(workspaceState, item),
  };
}

function collectRelatedIds(item, linkedItems, workspaceState) {
  return new Set([
    item.id,
    ...normalizeRelationshipList(item.linkedControls),
    ...normalizeRelationshipList(item.linkedTests),
    ...normalizeRelationshipList(item.linkedRisks),
    ...normalizeRelationshipList(item.linkedPolicies),
    ...normalizeRelationshipList(workspaceState?.linkedEvidenceIds),
    ...normalizeRelationshipList(linkedItems.controls).map((control) => control.id),
    ...normalizeRelationshipList(linkedItems.tests).map((test) => test.id),
    ...normalizeRelationshipList(linkedItems.risks).map((risk) => risk.id),
    ...normalizeRelationshipList(linkedItems.policies).map((policy) => policy.id),
  ].filter(Boolean));
}

function collectRelatedEvidence(records = [], relatedIds, item) {
  return records
    .filter((record) => {
      if (record.deletedAt) return false;
      const metadata = record.metadata || {};
      const mappings = Array.isArray(record.mappings) ? record.mappings : [];
      const recordLinks = [
        record.id,
        metadata.linkedTest,
        metadata.linkedImplementation,
        metadata.linkedPolicy,
        ...normalizeRelationshipList(metadata.linkedControls),
        ...mappings.flatMap((mapping) => [mapping.controlId, mapping.testId, mapping.policyId]),
      ].filter(Boolean);
      return recordLinks.some((id) => relatedIds.has(id)) || metadata.linkedTest === item.id;
    })
    .map((record) => ({
      id: safeDisplayText(record.id),
      title: safeDisplayText(record.title || record.versions?.at(-1)?.fileName || record.id, "Evidence"),
      status: safeDisplayText(record.evidenceStatus || "Evidence"),
      description: safeDisplayText(record.description || record.metadata?.linkedDomain),
    }));
}

function collectQuestionnaireAnswers(responses = {}, relatedIds, item) {
  return Object.entries(responses || {})
    .filter(([key, response]) => {
      const haystack = [
        key,
        response?.questionId,
        response?.controlId,
        response?.testId,
        response?.riskId,
        ...normalizeRelationshipList(response?.linkedControls),
        ...normalizeRelationshipList(response?.relatedControls),
      ].filter(Boolean);
      return haystack.some((id) => relatedIds.has(id)) || key.includes(item.id);
    })
    .map(([key, response]) => ({
      id: safeDisplayText(key),
      title: safeDisplayText(response?.question || response?.label || key, "Questionnaire answer"),
      status: safeDisplayText(response?.answer || response?.status || "Answer"),
      description: safeDisplayText(response?.notes || response?.reason),
    }));
}

function collectRelatedTasks(tasks = [], relatedIds, item) {
  return (tasks || [])
    .filter((task) => {
      const taskLinks = [
        task.id,
        task.itemId,
        task.controlId,
        task.testId,
        task.policyId,
        ...normalizeRelationshipList(task.linkedControls),
      ].filter(Boolean);
      return taskLinks.some((id) => relatedIds.has(id)) || task.itemId === item.id;
    })
    .map((task) => ({
      id: safeDisplayText(task.id),
      title: safeDisplayText(task.title || task.name || task.id, "Task"),
      status: safeDisplayText(task.status || "Open"),
      description: safeDisplayText(task.description || task.dueDate),
    }));
}

function collectAuditFindings(audit, relatedIds, item) {
  const findings = [
    ...normalizeRelationshipList(audit?.findings),
    ...normalizeRelationshipList(audit?.openFindings),
    ...normalizeRelationshipList(audit?.gaps),
    ...normalizeRelationshipList(audit?.missingEvidence),
  ];

  return findings
    .filter((finding) => {
      const findingLinks = [
        finding.id,
        finding.relatedItemId,
        finding.itemId,
        finding.controlId,
        finding.testId,
        ...normalizeRelationshipList(finding.linkedControls),
      ].filter(Boolean);
      return findingLinks.some((id) => relatedIds.has(id)) || finding.relatedItemId === item.id;
    })
    .map((finding) => ({
      id: safeDisplayText(finding.id || `${safeDisplayText(finding.relatedItemId || item.id)}-${safeDisplayText(finding.title || finding.reason || "finding")}`),
      relatedItemId: safeDisplayText(finding.relatedItemId || finding.itemId || finding.controlId || item.id),
      title: safeDisplayText(finding.title || finding.name || finding.reason || "Audit finding"),
      status: safeDisplayText(finding.status || finding.severity || "Open"),
      description: safeDisplayText(finding.description || finding.summary),
      type: safeDisplayText(finding.type || finding.itemType || "Audit"),
    }));
}

function collectActivity(workspaceState, item) {
  return [
    ...normalizeRelationshipList(workspaceState?.timeline),
    ...normalizeRelationshipList(item.activityTimeline),
  ].map((activity, index) => ({
    id: safeDisplayText(activity.id || `${item.id}-activity-${index}`),
    title: safeDisplayText(activity.label || activity.title || activity, "Activity"),
    status: safeDisplayText(activity.timestamp || activity.createdAt || "Activity"),
    description: safeDisplayText(activity.description),
  }));
}

function uniqueById(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (!item?.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function intersects(values = [], relatedIds) {
  return normalizeRelationshipList(values).some((value) => relatedIds.has(value));
}

function normalizeRelationshipList(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value && typeof value === "object") return Object.values(value).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function safeDisplayText(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toLocaleString();
  if (Array.isArray(value)) return value.map((item) => safeDisplayText(item)).filter(Boolean).join(", ") || fallback;
  if (typeof value === "object") {
    return (
      safeDisplayText(value.label) ||
      safeDisplayText(value.title) ||
      safeDisplayText(value.name) ||
      safeDisplayText(value.id) ||
      fallback
    );
  }
  return fallback;
}


function RiskCell({ children, strong = false }) {
  return (
    <td
      className={`px-4 py-3 align-top ${
        strong ? "font-black text-blue-700" : "font-semibold text-slate-600"
      }`}
    >
      {children}
    </td>
  );
}

function fieldLabel(field) {
  return {
    owner: "Owner",
    reviewer: "Reviewer",
    approver: "Approver",
  }[field];
}

function RiskPill({ children, tone }) {
  const toneClass =
    tone === "High"
      ? "bg-rose-50 text-rose-700"
      : tone === "Medium"
        ? "bg-amber-50 text-amber-700"
        : tone === "Low"
          ? "bg-emerald-50 text-emerald-700"
          : "bg-blue-50 text-blue-800";

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${toneClass}`}>
      {children}
    </span>
  );
}

function SectionHeader({ title, description }) {
  return (
    <div>
      <h2 className="text-xl font-black text-slate-900">
        {title}
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        {description}
      </p>
    </div>
  );
}

function EmptyRows({ label }) {
  return (
    <div className="border-t border-slate-100 bg-white px-6 py-10 text-center">
      <p className="text-sm font-black text-slate-900">No {label} available.</p>
      <p className="mt-1 text-sm font-semibold text-slate-500">
        Reset the library or upload your company data from the section above.
      </p>
    </div>
  );
}

function progressFromRows(rows, predicate) {
  if (!rows.length) return 0;
  return Math.round((completedCount(rows, predicate) / rows.length) * 100);
}

function completedCount(rows, predicate) {
  return rows.filter(predicate).length;
}

function renderStatusPill(row, defaultApplicability, workspaceData) {
  const saved = (workspaceData && workspaceData[row.id]) || {};
  const status = String(saved.status || row.status || "").toLowerCase();

  if (status === "not_applicable" || status === "not applicable") {
    return <RiskPill tone="Medium">Not Applicable</RiskPill>;
  }
  if (defaultApplicability === "Not applicable") {
    return <RiskPill tone="Medium">Not Applicable</RiskPill>;
  }
  return <RiskPill>Applicable</RiskPill>;
}

function renderProgressStatusPill(row, workspaceData) {
  const progressStatus = getProgressStatus(row, workspaceData);
  const tone = progressStatus === "Completed" ? "Low" : progressStatus === "Delayed" ? "High" : "Default";
  return <RiskPill tone={tone}>{progressStatus}</RiskPill>;
}

function getProgressStatus(row, workspaceData) {
  const saved = (workspaceData && workspaceData[row.id]) || {};
  const rawStatus = String(saved.status || row.status || "").toLowerCase().trim();

  if (["complete", "completed", "implemented", "approved"].includes(rawStatus)) {
    return "Completed";
  }

  const dueDateValue = saved.dueDate || row.dueDate;
  if (isPastDue(dueDateValue)) {
    return "Delayed";
  }

  return "In Progress";
}

function isPastDue(value) {
  if (!value) return false;
  const due = new Date(value);
  if (Number.isNaN(due.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return due < today;
}

function getMandatoryDocStatus(document, workspaceData) {
  const status = String((workspaceData && workspaceData[document.id]?.status) || "").toLowerCase();
  if (["ready", "approved", "implemented", "complete", "completed"].includes(status)) return "READY";
  return "NOT READY";
}

function isCompletedStatus(row, workspaceData) {
  return ["complete", "completed", "implemented", "ready", "approved"].includes(
    String((workspaceData && workspaceData[row.id]?.status) || "").toLowerCase()
  );
}

function isStrictlyCompletedStatus(row, workspaceData) {
  return ["complete", "completed", "implemented", "approved"].includes(
    String((workspaceData && workspaceData[row.id]?.status) || row.status || "").toLowerCase()
  );
}

function isApprovedStatus(row, workspaceData) {

  return ["approved", "complete", "completed"].includes(
    String((workspaceData && workspaceData[row.id]?.status) || "").toLowerCase()
  );
}

function hasUploadedEvidence(row, workspaceData) {
  if (!workspaceData) return false;
  const itemData = workspaceData[row.id];
  if (!itemData) return false;
  return Boolean(
    itemData.evidenceFiles?.length ||
      Object.values(itemData.evidenceByRequirement || {}).some((files) => files.length)
  );
}

function hasEvidenceForItem(item, workspaceState = {}) {
  return Boolean(
    normalizeRelationshipList(workspaceState.evidenceFiles).length ||
      normalizeRelationshipList(workspaceState.linkedEvidenceIds).length ||
      Object.values(workspaceState.evidenceByRequirement || {}).some((files) => normalizeRelationshipList(files).length) ||
      item.evidenceCount > 0
  );
}

function compareRiskRows(a, b, sortBy) {
  const severityRank = {
    High: 1,
    Medium: 2,
    Low: 3,
  };

  if (sortBy === "severity") {
    return severityRank[a.severity] - severityRank[b.severity];
  }

  if (sortBy === "dueDate") {
    return new Date(a.dueDate) - new Date(b.dueDate);
  }

  return String(a[sortBy]).localeCompare(String(b[sortBy]), undefined, {
    numeric: true,
  });
}

function compareControlRows(a, b, sortBy) {
  if (sortBy === "dueDate") {
    return new Date(a.dueDate) - new Date(b.dueDate);
  }

  return String(a[sortBy]).localeCompare(String(b[sortBy]), undefined, {
    numeric: true,
  });
}

function compareTestRows(a, b, sortBy) {
  if (sortBy === "dueDate") {
    return new Date(a.dueDate) - new Date(b.dueDate);
  }

  return String(a[sortBy]).localeCompare(String(b[sortBy]), undefined, {
    numeric: true,
  });
}

const linkedStateKeyByFamily = {
  risks: "linkedRisks",
  controls: "linkedControls",
  tests: "linkedTests",
  policies: "linkedPolicies",
  populations: "linkedPopulations",
};

const linkedItemTypeByFamily = {
  risks: "Risk",
  controls: "Control",
  tests: "Test",
  policies: "Policy",
  populations: "Population",
};

function singularRelationshipLabel(family) {
  return {
    risks: "Risk",
    controls: "Control",
    tests: "Test",
    policies: "Policy",
    populations: "Population",
  }[family] || "Item";
}

function resolveLinkedItemsWithOverrides(baseLinkedItems, data, workspaceState) {
  return Object.entries(linkedStateKeyByFamily).reduce((resolved, [family, stateKey]) => {
    const hasOverride = Object.prototype.hasOwnProperty.call(workspaceState || {}, stateKey);
    if (!hasOverride) return resolved;

    return {
      ...resolved,
      [family]: resolveWorkspaceItemsByIds(workspaceState[stateKey], data?.[family], linkedItemTypeByFamily[family]),
    };
  }, { ...baseLinkedItems });
}

function resolveWorkspaceItemsByIds(ids, rows = [], type) {
  const rowsById = new Map(
    normalizeRelationshipList(rows).map((row) => [safeDisplayText(row.id || row.name), row])
  );

  return normalizeRelationshipList(ids)
    .map((value) => safeDisplayText(typeof value === "object" && value !== null ? value.id || value.name : value))
    .filter(Boolean)
    .map((id) => rowsById.get(id))
    .filter(Boolean)
    .map((row) => createWorkspaceItem(type, row));
}

function getSavedLinkedOverrides(workspaceState) {
  return Object.values(linkedStateKeyByFamily).reduce((overrides, stateKey) => {
    if (!Object.prototype.hasOwnProperty.call(workspaceState || {}, stateKey)) return overrides;
    return { ...overrides, [stateKey]: workspaceState[stateKey] };
  }, {});
}

function createWorkspaceItem(type, item) {
  const id = item.id || item.name;
  const title = item.title || item.name;
  const priority = item.priority || "";
  const category = item.category || categoryFromType(type);
  const evidence = item.evidence || item.evidenceStatus || "";

  return {
    type,
    id,
    title,
    description: item.description || item.title || "",
    status: item.status || "",
    priority,
    owner: item.owner || "",
    reviewer: item.reviewer || "",
    approver: item.approver || "",
    dueDate: item.dueDate || "",
    category,
    mappedRisks: item.mappedRisks || "",
    mappedTests: item.mappedTests || "",
    mappedControls: item.mappedControls || "",
    linkedRisks: item.linkedRisks || [],
    linkedTests: item.linkedTests || [],
    linkedControls: item.linkedControls || [],
    linkedPolicies: item.linkedPolicies || [],
    linkedPopulations: item.linkedPopulations || [],
    evidence,
    requiredEvidence: item.requiredEvidence || [],
    comments: item.comments ?? "",
    guidance: item.guidance || "",
    updatedAt: item.updatedAt || "",
    activityTimeline: item.activityTimeline || [],
    aiRecommendation: item.aiRecommendation || "",
  };
}

function categoryFromType(type) {
  return {
    Risk: "Risk Management",
    Control: "Control Operations",
    Test: "Testing",
    Policy: "Policy Management",
    Population: "Population Management",
  }[type];
}

function updateWorkspaceHistory(item, replace = false) {
  const url = new URL(window.location.href);

  if (item) {
    url.searchParams.set("itemType", item.type);
    url.searchParams.set("itemId", item.id);
  } else {
    url.searchParams.delete("itemType");
    url.searchParams.delete("itemId");
  }

  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  const historyMethod = replace ? "replaceState" : "pushState";
  window.history[historyMethod]({}, "", nextUrl);
}

function getWorkspaceItemFromLocation(locationValue, data) {
  const searchParams = new URLSearchParams(locationValue.search);
  const itemType = normalizeItemType(searchParams.get("itemType"));
  const itemId = searchParams.get("itemId") || searchParams.get("item");

  if (!itemType || !itemId) return null;

  const rowsByType = {
    Risk: data.risks,
    Control: data.controls,
    Test: data.tests,
    Policy: data.policies,
    Population: data.populations,
  };
  const row = rowsByType[itemType]?.find((item) => String(item.id) === String(itemId));

  return row ? createWorkspaceItem(itemType, row) : null;
}

function downloadExcelFile(fileName, rows) {
  const headers = Array.from(
    rows.reduce((keys, row) => {
      Object.keys(row).forEach((key) => keys.add(key));
      return keys;
    }, new Set())
  );
  const table = [
    headers.join("\t"),
    ...rows.map((row) =>
      headers
        .map((header) => String(row[header] ?? "").replace(/\t|\n/g, " "))
        .join("\t")
    ),
  ].join("\n");
  const blob = new Blob([table], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${fileName}.xls`;
  link.click();
  URL.revokeObjectURL(url);
}

function isCMMCFramework(framework) {
  return framework?.slug === "cmmc";
}

function getSelectedFramework(location, frameworkCatalog = []) {
  const searchParams = new URLSearchParams(location.search);
  const selectedSlug = searchParams.get("framework");

  return frameworkCatalog.find((item) => item.slug === selectedSlug) || null;
}

function getImplementationFrameworkOptions(frameworks = []) {
  return frameworks.filter((framework) => framework.slug === "cmmc" || frameworkHasLibrary(framework.id));
}
