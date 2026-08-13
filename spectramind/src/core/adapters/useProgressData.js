/**
 * useProgressData.js
 *
 * Adapter hook that reads organization workspace state from localStorage,
 * converts it to a ProgressInput, feeds it to ProgressEngineService, and
 * returns a ComplianceSummary ready for Dashboard.jsx to display.
 *
 * The framework library is never modified — only the org workspace
 * (src/data/organizationWorkspace.js) is read.
 */

import { useMemo } from "react";
import { ProgressEngineService } from "../../progress-engine/services/ProgressEngineService";
import { loadOrganizationWorkspace } from "../../data/organizationWorkspace";
import { useFrameworkData } from "./useFrameworkData";

const EVIDENCE_COMPLETED_STATUSES = new Set([
  "approved", "complete", "completed",
]);

/**
 * Reads workspace data + framework structure and returns a full
 * ComplianceSummary from ProgressEngineService.
 *
 * @param {string} [frameworkSlug] - e.g. "soc-2"
 * @returns {{
 *   summary: import("../../progress-engine/utils/progressTypes").ComplianceSummary,
 *   isReady: boolean
 * }}
 */
export function useProgressData(frameworkSlug) {
  const frameworkData = useFrameworkData(frameworkSlug);

  return useMemo(() => {
    const engine = new ProgressEngineService();
    const workspaceData = loadOrganizationWorkspace(frameworkSlug);

    const { controls, risks, tests, policies } = frameworkData;

    // ── Controls ─────────────────────────────────────────────────────────────
    const progressControls = controls.map((c) => ({
      id: c.id,
      status: normalizeStatus(workspaceData[c.id]?.status),
    }));

    // ── Evidence ──────────────────────────────────────────────────────────────
    // Evidence is tracked per-control in the organization workspace as
    // evidenceFiles[] or evidenceByRequirement{} entries.
    const progressEvidence = controls.flatMap((c) => {
      const saved = workspaceData[c.id];
      const requirements = c.requiredEvidence ?? [];
      if (!requirements.length) return [];

      return requirements.map((req, idx) => {
        // Check if this specific requirement has been fulfilled
        const byReq = saved?.evidenceByRequirement?.[req];
        const hasFiles = byReq?.length > 0 || (idx === 0 && saved?.evidenceFiles?.length > 0);
        const fileStatus = saved?.status;

        let status = "missing";
        if (hasFiles && EVIDENCE_COMPLETED_STATUSES.has(fileStatus?.toLowerCase())) {
          status = "approved";
        } else if (hasFiles) {
          status = "uploaded";
        }

        return {
          id: `${c.id}:${idx}`,
          status,
          relatedControlIds: [c.id],
          dueDate: saved?.dueDate,
        };
      });
    });

    // ── Policies ──────────────────────────────────────────────────────────────
    const progressPolicies = policies.map((p) => ({
      id: p.id,
      status: normalizeStatus(workspaceData[p.id]?.status),
      relatedControlIds: p.linkedControls ?? [],
    }));

    // ── Risks ─────────────────────────────────────────────────────────────────
    const progressRisks = risks.map((r) => ({
      id: r.id,
      status: normalizeStatus(workspaceData[r.id]?.status),
      severity: (r.severity ?? "").toLowerCase(),
      relatedControlIds: r.linkedControls ?? [],
    }));

    // ── Tests ─────────────────────────────────────────────────────────────────
    const progressTests = tests.map((t) => ({
      id: t.id,
      status: normalizeStatus(workspaceData[t.id]?.status),
      relatedControlIds: t.linkedControls ?? [],
    }));

    // ── Tasks (derive from controls with due dates set) ────────────────────
    const progressTasks = [
      ...controls,
      ...tests,
      ...policies,
    ]
      .filter((item) => workspaceData[item.id]?.dueDate)
      .map((item) => ({
        id: item.id,
        status: normalizeStatus(workspaceData[item.id]?.status),
        dueDate: workspaceData[item.id]?.dueDate,
        relatedControlIds: item.linkedControls ?? [],
      }));

    const progressInput = {
      controls: progressControls,
      evidence: progressEvidence,
      policies: progressPolicies,
      risks: progressRisks,
      tests: progressTests,
      tasks: progressTasks,
    };

    const summary = engine.generateComplianceSummary(progressInput);

    return { summary, isReady: controls.length > 0 };
  }, [frameworkData, frameworkSlug]);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Maps the free-form status strings stored in the organization workspace
 * to the canonical ProgressStatus values the engine understands.
 */
function normalizeStatus(status) {
  const s = String(status ?? "").toLowerCase().trim();
  if (["complete", "completed", "implemented", "ready"].includes(s)) return "implemented";
  if (s === "implemented") return "implemented";
  if (s === "approved") return "approved";
  if (s === "applicable" || s === "pending assessment") return "not_started";
  if (s === "missing evidence") return "missing";
  if (s === "in_progress" || s === "in progress") return "in_progress";
  if (s === "not_applicable" || s === "not applicable") return "not_applicable";
  if (s === "rejected") return "rejected";
  if (s === "uploaded") return "uploaded";
  return "not_started";
}
