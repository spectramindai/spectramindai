import { getFrameworkLibrary } from "../core/engines/framework-engine/frameworkRegistry";
import { loadOrganizationWorkspace } from "../data/organizationWorkspace";

export function buildLocalDashboardScore(frameworks, scopedFramework = null) {
  const selected = scopedFramework ? [scopedFramework] : frameworks;
  const summaries = selected.map(buildLocalFrameworkScore);
  const totals = summaries.reduce((result, item) => ({
    completed: result.completed + item.completed,
    requirements: result.requirements + item.requirements,
    controls: result.controls + item.totalControls,
    implementedControls: result.implementedControls + item.implementedControls,
    evidenceTotal: result.evidenceTotal + item.evidenceTotal,
    policiesTotal: result.policiesTotal + item.policiesTotal,
    policiesPublished: result.policiesPublished + item.policiesPublished,
  }), { completed: 0, requirements: 0, controls: 0, implementedControls: 0, evidenceTotal: 0, policiesTotal: 0, policiesPublished: 0 });

  return {
    progressPercent: totals.requirements ? Math.round(totals.completed / totals.requirements * 100) : 0,
    totalControls: totals.controls,
    implementedControls: totals.implementedControls,
    evidenceTotal: totals.evidenceTotal,
    policiesTotal: totals.policiesTotal,
    policiesPublished: totals.policiesPublished,
    openRisks: 0,
    highRisks: 0,
    openTasks: 0,
    recentActivity: [],
    frameworkProgress: summaries.map((item) => ({
      id: item.id,
      name: item.name,
      progressPercent: item.requirements ? Math.round(item.completed / item.requirements * 100) : 0,
      totalControls: item.totalControls,
      implementedControls: item.implementedControls,
    })),
  };
}

function buildLocalFrameworkScore(framework) {
  const library = getFrameworkLibrary(framework.id) || {};
  const workspace = loadOrganizationWorkspace(framework.id);
  const controls = collection(library.controls);
  const policies = collection(library.policies);
  const tests = collection(library.tests);
  const evidenceRequirements = controls.flatMap((control) =>
    (control.requiredEvidence || []).map((requirement, index) => ({ controlId: control.id, requirement, index }))
  );
  const implementedControls = controls.filter((item) => completedStatus(workspace[item.id]?.status)).length;
  const policiesPublished = policies.filter((item) => completedStatus(workspace[item.id]?.status)).length;
  const completedTests = tests.filter((item) => completedStatus(workspace[item.id]?.status)).length;
  const approvedEvidence = evidenceRequirements.filter((item) => {
    const saved = workspace[item.controlId];
    const requirementFiles = saved?.evidenceByRequirement?.[item.requirement];
    const hasFiles = (Array.isArray(requirementFiles) && requirementFiles.length > 0)
      || (item.index === 0 && Array.isArray(saved?.evidenceFiles) && saved.evidenceFiles.length > 0);
    return approvedStatus(saved?.status) && hasFiles;
  }).length;

  return {
    id: framework.id,
    name: framework.name,
    completed: implementedControls + policiesPublished + completedTests + approvedEvidence,
    requirements: controls.length + policies.length + tests.length + evidenceRequirements.length,
    totalControls: controls.length,
    implementedControls,
    evidenceTotal: approvedEvidence,
    policiesTotal: policies.length,
    policiesPublished,
  };
}

function collection(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  return [];
}

function completedStatus(status) {
  return ["complete", "completed", "implemented", "approved", "active", "done"].includes(String(status || "").toLowerCase());
}

function approvedStatus(status) {
  return ["approved", "complete", "completed"].includes(String(status || "").toLowerCase());
}
