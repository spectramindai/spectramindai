import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  FileCheck2,
  ListChecks,
  ScrollText,
  ShieldCheck,
  Wrench,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "../auth/UserContext";
import { canManageWorkspace } from "../auth/session";
import ActivityFeed from "../components/dashboard/ActivityFeed";
import ComplianceChart from "../components/dashboard/ComplianceChart";
import AppShell from "../components/layout/AppShell";
import { useComplianceState } from "../compliance/ComplianceStateContext";
import { CMMC_FRAMEWORK_ID, resolveFrameworkId } from "../core/engines/framework-engine/frameworkRegistry";
import { buildLocalDashboardScore } from "../dashboard/DashboardScoreService";
import { useCMMCActivityHistory, useCMMCSPRSCalculation, useCMMCWorkflowState } from "../features/cmmc/hooks";
import {
  buildCMMCPolicyDocumentMetrics,
  buildCMMCPolicyDocumentRows,
  buildCMMCEvidenceAttachmentStats,
  formatCMMCActivityName,
} from "../features/cmmc/services";
import ActiveFrameworkRequired from "../framework/ActiveFrameworkRequired";
import { useFrameworkWorkspace } from "../framework/FrameworkWorkspaceContext";
import { buildCrossModuleTarget } from "../navigation/crossModuleNavigation";
import { isApiEnabled } from "../api/client";
import { loadDashboard } from "../api/dashboard";

const SETUP_BANNER_DISMISSED_KEY = "spectramind:workspace-setup-banner-dismissed";

export default function Dashboard() {
  const { user } = useUser();
  const { activeFramework, selectedFrameworks, isLoadingFrameworks, frameworkLoadError } = useFrameworkWorkspace();
  const setupIncomplete = !user?.organizationId || !user?.onboardingComplete;

  if (setupIncomplete) {
    return <DashboardSetupPrompt user={user} />;
  }

  if (isLoadingFrameworks) {
    return (
      <AppShell>
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-amber-200 border-t-amber-700" />
          <p className="mt-4 font-semibold text-slate-700">Loading your organization workspace…</p>
        </div>
      </AppShell>
    );
  }

  if (frameworkLoadError) {
    return (
      <AppShell>
        <div className="rounded-xl border border-rose-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-black text-slate-950">Workspace could not be loaded</h1>
          <p className="mt-3 text-slate-600">{frameworkLoadError}</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-5 rounded-lg bg-primary px-5 py-3 font-semibold text-white">
            Try again
          </button>
        </div>
      </AppShell>
    );
  }

  if (!selectedFrameworks.length) {
    return <ActiveFrameworkRequired />;
  }

  return <DashboardContent activeFramework={activeFramework || selectedFrameworks[0]} selectedFrameworks={selectedFrameworks} />;
}

function DashboardSetupPrompt({ user }) {
  const navigate = useNavigate();
  const setupPath = canManageWorkspace(user?.role) ? "/onboarding/organization" : "/join-organization";

  return (
    <AppShell>
      <div className="space-y-6">
        <WorkspaceSetupBanner user={user} setupPath={setupPath} />

        <div>
          <p className="text-sm font-black uppercase tracking-widest text-blue-700">
            Command Center
          </p>
          <h1 className="mt-2 text-4xl font-black text-slate-900">
            Dashboard
          </h1>
          <p className="mt-2 max-w-2xl text-slate-600">
            Your authenticated session is active. Finish workspace setup to start managing compliance work.
          </p>
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg border border-blue-600/20 bg-blue-50 text-blue-700">
            <Building2 size={28} />
          </span>
          <h2 className="mt-5 text-2xl font-black text-slate-950">Complete workspace setup</h2>
          <p className="mx-auto mt-2 max-w-xl text-slate-600">
            Create or join an organization before opening frameworks, implementation, evidence, assessments, and other compliance workspaces.
          </p>
          <button
            type="button"
            onClick={() => navigate(setupPath)}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-5 py-3 font-black text-white transition hover:bg-blue-800"
          >
            Complete setup
            <ArrowUpRight size={18} />
          </button>
        </section>
      </div>
    </AppShell>
  );
}

function WorkspaceSetupBanner({ user, setupPath }) {
  const navigate = useNavigate();
  const [dismissed, dismissBanner] = useSetupBannerDismissal(user);

  if (dismissed) return null;

  return (
    <div role="status" className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="font-black">Complete your workspace setup to unlock compliance automation.</p>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => navigate(setupPath)} className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-black text-white transition hover:bg-amber-700">
          Complete setup
        </button>
        <button type="button" onClick={dismissBanner} className="rounded-lg p-2 text-amber-800 transition hover:bg-amber-100" aria-label="Dismiss setup reminder">
          <X size={18} />
        </button>
      </div>
    </div>
  );
}

function useSetupBannerDismissal(user) {
  const storageKey = `${SETUP_BANNER_DISMISSED_KEY}:${user?.userId || user?.email || "anonymous"}`;
  const [dismissed, setDismissed] = useState(() => readSetupBannerDismissal(storageKey));

  const dismiss = () => {
    setDismissed(true);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, "true");
    }
  };

  return [dismissed, dismiss];
}

function readSetupBannerDismissal(storageKey) {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(storageKey) === "true";
}

function DashboardContent({ activeFramework, selectedFrameworks }) {
  const navigate = useNavigate();
  const { setActiveFramework } = useFrameworkWorkspace();
  const [dashboardScope, setDashboardScope] = useState("all");
  const [apiDashboard, setApiDashboard] = useState(null);
  const [apiError, setApiError] = useState("");
  const [loadingDashboard, setLoadingDashboard] = useState(isApiEnabled);
  const scopedFramework = dashboardScope === "all"
    ? null
    : selectedFrameworks.find(framework => framework.id === dashboardScope) || null;
  const navigationFramework = scopedFramework || activeFramework;
  const localDashboard = useMemo(
    () => buildLocalDashboardScore(selectedFrameworks, scopedFramework),
    [selectedFrameworks, scopedFramework]
  );
  const dashboardData = isApiEnabled ? apiDashboard : localDashboard;

  useEffect(() => {
    if (!isApiEnabled) return;
    let cancelled = false;
    const frameworkId = scopedFramework ? resolveFrameworkId(scopedFramework.id) || scopedFramework.id : "";
    loadDashboard(frameworkId)
      .then(result => { if (!cancelled) setApiDashboard(result); })
      .catch(error => { if (!cancelled) setApiError(error.message || "Could not load dashboard"); })
      .finally(() => { if (!cancelled) setLoadingDashboard(false); });
    return () => { cancelled = true; };
  }, [scopedFramework, selectedFrameworks]);
  const switchDashboardScope = framework => {
    if (isApiEnabled) setLoadingDashboard(true);
    setApiError("");
    setDashboardScope(framework?.id || "all");
    if (framework) setActiveFramework(framework.id);
  };
  const cmmcSPRS = useCMMCSPRSCalculation();
  const cmmcActivities = useCMMCActivityHistory();
  const { controlWorkflowFields, evidenceWorkflowFields } = useCMMCWorkflowState();
  const isCMMCWorkspace = !isApiEnabled && selectedFrameworks.length === 1 && resolveFrameworkId(navigationFramework.id) === CMMC_FRAMEWORK_ID;
  const {
    audit,
    controls,
    implementations,
    evidence,
    policies,
    risks,
    tests,
    tasks,
  } = useComplianceState();

  const implementationRows = [
    ...(implementations.controls || []),
    ...(implementations.tests || []),
    ...(implementations.policies || []),
    ...(implementations.risks || []),
    ...(implementations.populations || []),
  ];
  const completedImplementations = dashboardData?.implementedControls ?? implementationRows.filter(isComplete).length;
  const totalImplementations = dashboardData?.totalControls ?? implementationRows.length;
  const cmmcCompletionPercentage = clampPercent(cmmcSPRS.completionPercentage);
  const cmmcCompliancePercentage = clampPercent(cmmcSPRS.compliancePercentage ?? cmmcSPRS.completionPercentage);
  const frameworkProgress = isCMMCWorkspace
    ? cmmcCompletionPercentage
    : dashboardData?.progressPercent ?? 0;
  const auditReadiness = isCMMCWorkspace ? cmmcCompletionPercentage : dashboardData?.progressPercent ?? 0;
  const overallScore = isCMMCWorkspace ? cmmcCompliancePercentage : dashboardData?.progressPercent ?? 0;
  const applicableControls = dashboardData?.totalControls ?? controls.filter((control) => control.applicable).length;
  const cmmcEvidenceAttachmentStats = buildCMMCEvidenceAttachmentStats(controlWorkflowFields, cmmcSPRS.controls);
  const evidenceTotal = isCMMCWorkspace
    ? cmmcEvidenceAttachmentStats.totalAttachments
    : dashboardData?.evidenceTotal ?? evidence.filter((record) => !record.deletedAt).length;
  const missingEvidenceTotal = isCMMCWorkspace
    ? cmmcEvidenceAttachmentStats.missingControls
    : audit.pendingEvidence?.length || 0;
  const cmmcPolicyRows = useMemo(
    () =>
      buildCMMCPolicyDocumentRows({
        controlWorkflowFields,
        evidenceWorkflowFields,
      }),
    [controlWorkflowFields, evidenceWorkflowFields]
  );
  const cmmcPolicyMetrics = useMemo(
    () => buildCMMCPolicyDocumentMetrics(cmmcPolicyRows),
    [cmmcPolicyRows]
  );
  const policiesTotal = isCMMCWorkspace ? cmmcPolicyMetrics.totalPolicies : dashboardData?.policiesTotal ?? policies.length;
  const policiesPublished = isCMMCWorkspace
    ? cmmcPolicyMetrics.publishedPolicies
    : dashboardData?.policiesPublished ?? policies.filter((policy) => policy.status === "Active" || isComplete(policy)).length;
  const policiesRemaining = isCMMCWorkspace
    ? cmmcPolicyMetrics.remainingPolicies
    : Math.max(policiesTotal - policiesPublished, 0);
  const openRisks = isCMMCWorkspace ? risks.filter((risk) => risk.applicable && ["Open", "In Progress"].includes(risk.treatmentStatus || risk.status)).length : dashboardData?.openRisks ?? risks.filter((risk) => risk.applicable && ["Open", "In Progress"].includes(risk.treatmentStatus || risk.status)).length;
  const testsTotal = tests.length;
  const completedTests = tests.filter(isComplete).length;
  const openTasks = isCMMCWorkspace ? tasks.filter((task) => !isComplete(task)).length : dashboardData?.openTasks ?? tasks.filter((task) => !isComplete(task)).length;
  const dashboardActivities = dashboardData?.recentActivity || (isCMMCWorkspace ? cmmcActivities : (audit.timeline || []));
  const recentActivityCount = dashboardActivities.length;
  const recentActivityNote = recentActivityCount
    ? isCMMCWorkspace ? formatCMMCActivityName(dashboardActivities[0]) : "Latest compliance updates"
    : "No activity yet";
  const highRisks = isCMMCWorkspace ? risks.filter((risk) => ["High", "Critical"].includes(risk.riskLevel || risk.severity) && ["Open", "In Progress"].includes(risk.treatmentStatus || risk.status)).length : dashboardData?.highRisks ?? risks.filter((risk) => ["High", "Critical"].includes(risk.riskLevel || risk.severity) && ["Open", "In Progress"].includes(risk.treatmentStatus || risk.status)).length;

  const stats = [
    ...(isCMMCWorkspace
      ? buildCMMCDashboardStats(cmmcSPRS, cmmcCompliancePercentage, cmmcCompletionPercentage)
      : [
          {
            label: "Compliance Score",
            value: `${overallScore}%`,
            note: `${completedImplementations} of ${totalImplementations} implementation items complete`,
            icon: ShieldCheck,
            tone: "text-emerald-600",
            target: { itemType: "Audit", itemId: "compliance-score" },
          },
          {
            label: "Audit Readiness",
            value: `${auditReadiness}%`,
            note: `${audit.openFindings || 0} open audit findings`,
            icon: CheckCircle2,
            tone: "text-blue-700",
            target: { itemType: "Audit", itemId: "readiness" },
          },
          {
            label: "Framework Progress",
            value: `${frameworkProgress}%`,
            note: scopedFramework ? `${scopedFramework.name} only` : `${selectedFrameworks.length} selected frameworks combined`,
            icon: Building2,
            tone: "text-violet-600",
            target: { itemType: "Implementation", itemId: "framework-progress" },
          },
          {
            label: "Total Implementations",
            value: String(totalImplementations),
            note: `${completedImplementations} completed`,
            icon: Wrench,
            tone: "text-slate-700",
            target: { itemType: "Implementation", itemId: "" },
          },
          {
            label: "Completed Implementations",
            value: String(completedImplementations),
            note: `${Math.max(totalImplementations - completedImplementations, 0)} remaining`,
            icon: CheckCircle2,
            tone: "text-emerald-600",
            target: { itemType: "Implementation", itemId: "" },
          },
          {
            label: "Applicable Controls",
            value: String(applicableControls),
            note: `${controls.length} total controls`,
            icon: ShieldCheck,
            tone: "text-blue-700",
            target: { itemType: "Control", itemId: "" },
          },
        ]),
    {
      label: "Evidence Count",
      value: String(evidenceTotal),
      note: `${missingEvidenceTotal} missing evidence items`,
      icon: FileCheck2,
      tone: "text-blue-700",
      target: { itemType: "Evidence", itemId: "repository" },
    },
    {
      label: "Policies",
      value: String(isCMMCWorkspace ? policiesPublished : policiesTotal),
      note: isCMMCWorkspace
        ? `${policiesPublished} published, ${policiesRemaining} remaining`
        : `${policiesPublished} published`,
      icon: ScrollText,
      tone: "text-amber-700",
      target: { itemType: "Policy", itemId: "" },
    },
    {
      label: "Open Risks",
      value: String(isNaN(openRisks) ? 0 : openRisks),
      note: `${highRisks} high/critical`,
      icon: AlertTriangle,
      tone: "text-rose-600",
      target: { itemType: "Risk", itemId: "" },
    },
    {
      label: "Tests",
      value: String(testsTotal),
      note: `${completedTests} completed`,
      icon: ListChecks,
      tone: "text-indigo-700",
      target: { itemType: "Test", itemId: "" },
    },
    {
      label: "Tasks",
      value: String(openTasks),
      note: `${tasks.length} generated tasks`,
      icon: Building2,
      tone: "text-violet-600",
      target: { itemType: "Task", itemId: "" },
    },
    {
      label: "Recent Activity",
      value: String(recentActivityCount),
      note: recentActivityNote,
      icon: CheckCircle2,
      tone: "text-emerald-600",
      target: { itemType: "Audit", itemId: "activity" },
    },
  ];

  const readiness = dashboardData?.frameworkProgress?.map(item => ({
    label: item.name,
    status: `${item.progressPercent}% ready`,
    target: { itemId: item.id, itemType: "Implementation" },
  })) || (audit.checklist || []).slice(0, 3).map((item) => ({
    label: item.relatedItemId || item.name,
    status: item.status || item.category,
    target: {
      itemId: item.relatedItemId || item.id || item.name,
      itemType: item.category || "Audit",
    },
  }));
  const chartData = buildDashboardChartData({
    complianceScore: overallScore,
    auditReadiness,
    frameworkProgress,
    evidenceCoverage: isCMMCWorkspace ? cmmcEvidenceAttachmentStats.coveragePercentage : Math.round(audit.evidenceCoverage || 0),
    testsProgress: testsTotal ? Math.round((completedTests / testsTotal) * 100) : 0,
    policyProgress: isCMMCWorkspace
      ? cmmcPolicyMetrics.publishedPercentage
      : policiesTotal ? Math.round((policiesPublished / policiesTotal) * 100) : 0,
  });
  const chartDelta = chartData.length > 1 ? chartData.at(-1).score - chartData[0].score : 0;
  const visibleStats = stats.filter(stat => !["Audit Readiness", "Framework Progress", "Completed Implementations", "Tests"].includes(stat.label));
  const navigateToCard = (stat) => {
    const target = buildCrossModuleTarget({
      activeFramework: navigationFramework,
      itemId: stat.target.itemId,
      itemType: stat.target.itemType,
      moduleContext: `Dashboard:${stat.label}`,
      mode: "view",
    });
    navigate(target.path, { state: target.state });
  };
  const navigateToStartReview = () => {
    const target = buildCrossModuleTarget({
      activeFramework: navigationFramework,
      itemId: "start-review",
      itemType: isCMMCWorkspace ? "Gap Wizard" : "Audit",
      moduleContext: "Dashboard:Start Review",
      mode: "view",
    });
    navigate(target.path, { state: target.state });
  };
  const navigateToReadinessItem = (item) => {
    const target = buildCrossModuleTarget({
      activeFramework: navigationFramework,
      itemId: item.target.itemId,
      itemType: item.target.itemType,
      moduleContext: "Dashboard:Readiness Queue",
      mode: "view",
    });
    navigate(target.path, { state: target.state });
  };
  return (
    <AppShell>
      <div className="space-y-6">
        {apiError && <p role="alert" className="rounded-lg bg-rose-50 px-4 py-3 font-semibold text-rose-700">{apiError}</p>}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-widest text-blue-700">
              Command Center
            </p>
            <h1 className="mt-2 text-4xl font-black text-slate-900">
              Dashboard
            </h1>
            <p className="mt-2 max-w-2xl text-slate-600">
              View your organization as a whole or focus on one compliance framework.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={navigateToStartReview} className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-600/35 bg-[linear-gradient(135deg,rgba(255,246,216,.96),rgba(216,180,109,.74)_48%,rgba(168,117,52,.86))] px-5 py-3 font-bold text-slate-900 shadow-lg shadow-blue-600/20 transition hover:-translate-y-0.5">
              Start Review
              <ArrowUpRight size={18} />
            </button>
          </div>
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
          <div className="flex items-center gap-2 overflow-x-auto">
            <ScopeButton active={dashboardScope === "all"} onClick={() => switchDashboardScope(null)}>
              All frameworks
            </ScopeButton>
            {selectedFrameworks.map(framework => (
              <ScopeButton
                key={framework.id}
                active={dashboardScope === framework.id}
                onClick={() => switchDashboardScope(framework)}
              >
                {framework.shortName || framework.name}
              </ScopeButton>
            ))}
            {loadingDashboard && <span className="ml-auto shrink-0 px-3 text-xs font-bold text-slate-400">Updating…</span>}
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-sm">
          <div className="grid gap-6 p-6 lg:grid-cols-[1fr_320px]">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-blue-600/20 bg-blue-50 text-blue-700">
                  <ShieldCheck size={26} />
                </div>
                <div>
                  <p className="text-sm font-bold text-blue-700">
                    {scopedFramework ? `${scopedFramework.name} readiness` : "Combined readiness"}
                  </p>
                  <h2 className="text-5xl font-black tracking-tight text-slate-950">{auditReadiness}%</h2>
                </div>
              </div>

              <div className="mt-8 h-3 rounded-full bg-slate-100">
                <div
                  className="h-3 rounded-full bg-[linear-gradient(90deg,#8eaf99,#d8b46d,#9d6f38)] transition-all duration-700"
                  style={{ width: `${auditReadiness}%` }}
                />
              </div>

              <p className="mt-4 max-w-2xl text-slate-600">
                {auditReadiness >= 80
                  ? "You are well on track. Keep completing outstanding evidence and controls."
                  : "Keep going — complete outstanding controls and evidence to improve your audit readiness score."}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-5">
              <h3 className="font-black">{scopedFramework ? "Framework summary" : "Framework progress"}</h3>
              <div className="mt-4 space-y-3">
                {readiness.map((item) => (
                  <button
                    type="button"
                    key={item.label}
                    onClick={() => navigateToReadinessItem(item)}
                    className="flex items-center justify-between gap-4 text-sm"
                  >
                    <span className="text-slate-600">{item.label}</span>
                    <span className="rounded-full bg-blue-50 px-3 py-1 font-bold text-blue-800">
                      {item.status}
                    </span>
                  </button>
                ))}
                {!readiness.length && (
                  <div className="text-sm font-semibold text-slate-500">No open readiness items.</div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {visibleStats.map((stat) => {
            const Icon = stat.icon;

            return (
              <button
                type="button"
                key={stat.label}
                onClick={() => navigateToCard(stat)}
                className="rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-amber-200 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-500">
                      {stat.label}
                    </p>
                    <h2 className="mt-2 text-4xl font-black text-slate-900">
                      {stat.value}
                    </h2>
                  </div>
                  <div className={`rounded-lg border border-slate-200 bg-[#fffdf8]/70 p-3 ${stat.tone}`}>
                    <Icon size={22} />
                  </div>
                </div>
                <p className="mt-4 flex items-center gap-2 text-sm text-slate-600">
                  <CheckCircle2 size={16} className="text-emerald-500" />
                  {stat.note}
                </p>
              </button>
            );
          })}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <ComplianceChart data={chartData} delta={chartDelta} />
          <ActivityFeed activities={dashboardData?.recentActivity?.slice(0, 5).map(activity => ({ id: activity.id, name: activity.name || formatActivity(activity), timestamp: activity.createdAt || activity.timestamp }))} />
        </section>
      </div>
    </AppShell>
  );
}

function isComplete(item) {
  return ["complete", "completed", "implemented", "approved", "active", "mitigated", "accepted"].includes(
    String(item?.status || item?.applicabilityStatus || item?.treatmentStatus || "").toLowerCase()
  );
}

function buildCMMCDashboardStats(cmmcSPRS, compliancePercentage, completionPercentage) {
  const totalControls = Number(cmmcSPRS.totalControls) || 0;
  const completedControls = Number(cmmcSPRS.completedControls) || 0;
  const inProgressControls = Number(cmmcSPRS.inProgressControls) || 0;
  const notStartedControls = Number(cmmcSPRS.notStartedControls) || 0;

  return [
    {
      label: "Compliance Percentage",
      value: `${compliancePercentage}%`,
      note: `${completedControls} of ${totalControls} controls compliant`,
      icon: ShieldCheck,
      tone: "text-emerald-600",
      target: { itemType: "SPRS", itemId: "compliance-score" },
    },
    {
      label: "Completion Percentage",
      value: `${completionPercentage}%`,
      note: `${completedControls} of ${totalControls} controls completed`,
      icon: CheckCircle2,
      tone: "text-blue-700",
      target: { itemType: "Gap Wizard", itemId: "workflow-status" },
    },
    {
      label: "Total Controls",
      value: String(totalControls),
      note: `${completedControls} completed`,
      icon: Building2,
      tone: "text-violet-600",
      target: { itemType: "Control", itemId: "" },
    },
    {
      label: "Completed Controls",
      value: String(completedControls),
      note: `${Math.max(totalControls - completedControls, 0)} remaining`,
      icon: Wrench,
      tone: "text-slate-700",
      target: { itemType: "Gap Wizard", itemId: "completed-controls" },
    },
    {
      label: "In Progress Controls",
      value: String(inProgressControls),
      note: `${notStartedControls} not started`,
      icon: CheckCircle2,
      tone: "text-emerald-600",
      target: { itemType: "Gap Wizard", itemId: "in-progress-controls" },
    },
    {
      label: "Not Started Controls",
      value: String(notStartedControls),
      note: `${totalControls} total controls`,
      icon: ShieldCheck,
      tone: "text-blue-700",
      target: { itemType: "Gap Wizard", itemId: "not-started-controls" },
    },
  ];
}

function buildDashboardChartData(scores) {
  return [
    ["Compliance", scores.complianceScore],
    ["Audit", scores.auditReadiness],
    ["Framework", scores.frameworkProgress],
    ["Evidence", scores.evidenceCoverage],
    ["Tests", scores.testsProgress],
    ["Policies", scores.policyProgress],
  ].map(([label, score]) => ({ label, score: Math.max(0, Math.min(100, Number(score) || 0)) }));
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function ScopeButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-bold transition ${
        active
          ? "bg-slate-900 text-white shadow-sm"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
      }`}
    >
      {children}
    </button>
  );
}

function formatActivity(activity) {
  return String(activity.action || "Compliance activity")
    .split(".")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
