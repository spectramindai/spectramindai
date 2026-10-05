/**
 * useFrameworkData.js
 *
 * Adapter hook that wraps FrameworkEngine and returns data shaped exactly
 * like the legacy getFrameworkLibrary() output that Implementation.jsx
 * already consumes.
 *
 * The framework library JSON files are never modified — all data is read-only.
 * Organization-specific overrides (status, owner, etc.) are sourced from
 * the OrganizationWorkspace layer.
 */

import { useMemo } from "react";
import { FrameworkEngine } from "../engines/framework-engine/frameworkEngine";
import { resolveFrameworkId } from "../engines/framework-engine/frameworkRegistry";

/**
 * Returns implementation data shaped like the legacy getFrameworkLibrary()
 * output: { controls, risks, tests, policies, populations }.
 *
 * Each item carries all the linked-item arrays and mapped-count strings that
 * the Implementation.jsx components already read.
 *
 * @param {string | null | undefined} slug - e.g. "soc-2"
 * @returns {{ controls: object[], risks: object[], tests: object[], policies: object[], populations: object[] }}
 */
export function useFrameworkData(slug) {
  return useMemo(() => {
    if (!slug) return emptyLibrary();

    const frameworkId = resolveFrameworkId(slug);
    if (!frameworkId) return emptyLibrary();

    let engine;
    try {
      engine = new FrameworkEngine(frameworkId);
    } catch {
      return emptyLibrary();
    }

    const framework = engine.getFramework();
    const isSoc2 = engine.frameworkId === "soc2-type-ii";
    const rawControls = engine.getControls();
    const rawRisks = engine.getRisks();
    const rawTests = engine.getTests();
    const rawPolicies = engine.getPolicies();
    const aiGuidance = engine.getAIGuidance();
    const mappings = engine.getMappings();

    // Build lookup maps for fast cross-referencing
    const aiGuidanceByControl = {};
    for (const g of aiGuidance ?? []) {
      if (g.controlId) aiGuidanceByControl[g.controlId] = g;
    }

    // Build mapping lookup: controlId → { policyIds, riskIds, testIds, evidenceIds, taskIds }
    const mappingByControl = {};
    for (const m of mappings ?? []) {
      mappingByControl[m.controlId] = m;
    }

    // ── Controls ────────────────────────────────────────────────────────────
    const controls = rawControls.map((c) => {
      const m = mappingByControl[c.id] ?? {};
      const linkedTests = m.testIds ?? c.relatedTests ?? [];
      const linkedRisks = m.riskIds ?? c.relatedRisks ?? [];
      const linkedPolicies = m.policyIds ?? c.relatedPolicies ?? [];
      const guidance = aiGuidanceByControl[c.id];

      return {
        id: c.id,
        title: c.title,
        description: c.description ?? c.objective ?? "",
        status: "Library",
        owner: "",
        reviewer: "",
        approver: "",
        dueDate: "",
        category: c.category,
        trustServiceCriteria: c.trustServiceCriteria ?? c.trustId ?? (isSoc2 ? c.id : ""),
        annexDomain: c.annexDomain ?? c.domain ?? c.category ?? "",
        criteria: [c.id],
        priority: c.priority ?? "",
        evidenceType: c.requiredEvidence?.[0] ?? "",
        requiredEvidence: c.requiredEvidence ?? [],
        linkedTests,
        linkedRisks,
        linkedPolicies,
        linkedControls: [],
        linkedPopulations: [],
        mappedTests: formatLinkedCount(linkedTests, "test"),
        mappedRisks: formatLinkedCount(linkedRisks, "risk"),
        comments: "",
        guidance: c.guidance ?? "",
        aiRecommendation: guidance?.recommendation ?? c.aiGuidance ?? "",
        updatedAt: "",
        activityTimeline: [],
      };
    });

    // ── Risks ────────────────────────────────────────────────────────────────
    const risks = rawRisks.map((r) => {
      const linkedControls = r.relatedControls ?? [];
      const linkedTests = r.relatedTests ?? [];

      return {
        id: r.id,
        title: r.title,
        description: r.description ?? "",
        status: "Library",
        owner: "",
        reviewer: "",
        approver: "",
        dueDate: "",
        category: r.category,
        severity: r.severity ?? "",
        likelihood: r.likelihood ?? "",
        initialRiskScore: r.severity ?? "",
        residualRiskScore: "",
        comments: "",
        linkedControls,
        linkedTests,
        linkedPolicies: [],
        linkedRisks: [],
        linkedPopulations: [],
        controls: formatLinkedCount(linkedControls, "control"),
        mappedTests: formatLinkedCount(linkedTests, "test"),
        requiredEvidence: r.requiredEvidence ?? [],
        guidance: r.mitigation ?? "",
        aiRecommendation: "",
        updatedAt: "",
        activityTimeline: [],
      };
    });

    // ── Tests ────────────────────────────────────────────────────────────────
    const tests = rawTests.map((t) => {
      const linkedControls = t.relatedControls ?? [];
      const linkedRisks = t.relatedRisks ?? [];

      return {
        id: t.id,
        title: t.title,
        description: t.description ?? "",
        status: "Library",
        owner: "",
        reviewer: "",
        approver: "",
        dueDate: "",
        category: t.category,
        frequency: t.frequency ?? "",
        requiredEvidence: t.requiredEvidence ?? [],
        comments: "",
        linkedControls,
        linkedRisks,
        linkedPolicies: [],
        linkedTests: [],
        linkedPopulations: [],
        mappedControls: formatLinkedCount(linkedControls, "control"),
        mappedRisks: formatLinkedCount(linkedRisks, "risk"),
        guidance: t.procedure ?? "",
        aiRecommendation: "",
        updatedAt: "",
        activityTimeline: [],
      };
    });

const POLICY_TITLE_OVERRIDES = {
  "POL-001": "User Access Provisioning Procedure",
  "POL-002": "Privileged utility program policy",
  "POL-003": "Physical security policy/process document",
  "POL-004": "Minimum Necessary PHI Policy",
  "POL-005": "Threat Management Policy",
  "POL-006": "Processor Data Subject Request Procedure",
  "POL-007": "Code of Conduct",
  "POL-008": "Incident Response Policy",
  "POL-009": "Privacy Request Handling Policy",
  "POL-010": "Information security policy document",
  "POL-011": "Cryptography and encryption policy",
  "POL-012": "Information security event/incident management procedure",
  "POL-013": "Logging, Monitoring, and Alerting policy",
  "POL-014": "Data Classification, Handling, Retention and Disposal Policy",
};

    // ── Policies ─────────────────────────────────────────────────────────────
    const policies = rawPolicies.map((p) => {
      const linkedControls = p.relatedControls ?? [];
      const linkedTests = uniqueValues(
        (mappings ?? [])
          .filter((mapping) =>
            (mapping.policyIds ?? []).includes(p.id) || linkedControls.includes(mapping.controlId)
          )
          .flatMap((mapping) => mapping.testIds ?? [])
      );
      const overridenTitle = isSoc2 ? POLICY_TITLE_OVERRIDES[p.id] || p.title : p.title;

      return {
        id: p.id,
        title: overridenTitle,
        description: p.description ?? "",
        status: "Library",
        owner: "",
        reviewer: "",
        approver: "",
        dueDate: "",
        category: categoryFromPolicyTitle(overridenTitle),
        requiredEvidence: [`${overridenTitle} Document`, "Policy Approval", "Latest Review Record"],
        comments: "",
        linkedControls,
        linkedTests,
        linkedRisks: [],
        linkedPolicies: [],
        linkedPopulations: [],
        criteria: p.relatedControls ?? [],
        mappedControls: formatLinkedCount(linkedControls, "control"),
        mappedTests: formatLinkedCount(linkedTests, "test"),
        guidance: p.aiSummary ?? "",
        aiRecommendation: p.aiSummary ?? "",
        updatedAt: "",
        activityTimeline: [],
      };
    });

    // ── Populations ───────────────────────────────────────────────────────────
    const populationTitles = [
      "Employees", "Contractors", "Service Accounts", "Privileged Users",
      "Servers", "Endpoints", "Databases", "Applications",
      "Cloud Resources", "Network Devices", "Vendors", "Backups", "Security Logs",
    ];
    const populations = populationTitles.map((title, index) => ({
      id: `POP-${String(index + 1).padStart(3, "0")}`,
      title,
      status: "Library",
      owner: "",
      dueDate: "",
      category: categoryFromPopulation(title),
      mappedTests: "",
      comments: "",
      linkedTests: [],
      linkedControls: [],
      linkedRisks: [],
      linkedPolicies: [],
      linkedPopulations: [],
      requiredEvidence: [],
      guidance: "",
      aiRecommendation: "",
      updatedAt: "",
      activityTimeline: [],
    }));

    return { framework, controls, risks, tests, policies, populations };
  }, [slug]);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function emptyLibrary() {
  return { controls: [], risks: [], tests: [], policies: [], populations: [] };
}

function formatLinkedCount(ids, singular) {
  if (!ids?.length) return "";
  return `${ids.length} ${singular}${ids.length === 1 ? "" : "s"}`;
}

function uniqueValues(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function categoryFromPolicyTitle(title) {
  if (/access|password|mfa|onboarding|offboarding/i.test(title)) return "Access Control";
  if (/backup|disaster|continuity|incident|change|logging|monitoring/i.test(title)) return "Operations";
  if (/classification|encryption|data/i.test(title)) return "Data Protection";
  if (/vendor/i.test(title)) return "Vendor Management";
  if (/development|asset|remote|acceptable/i.test(title)) return "Security Operations";
  return "Governance";
}

function categoryFromPopulation(title) {
  if (/employee|contractor|service account|privileged/i.test(title)) return "Identity";
  if (/server|endpoint|database|application|cloud|network/i.test(title)) return "Infrastructure";
  if (/vendor/i.test(title)) return "Vendor";
  if (/backup|log/i.test(title)) return "Operations";
  return "General";
}
