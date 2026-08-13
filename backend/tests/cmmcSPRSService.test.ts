import { describe, expect, it, vi } from "vitest";
import {
  validateCMMCImplementedEvidence,
} from "../src/services/cmmcEvidenceValidationService.js";
import {
  CMMC_FRAMEWORK_ID,
  SPRS_CONTROL_WEIGHTS,
  calculateCMMCSPRSMetricsFromControls,
} from "../src/services/cmmcSPRSService.js";

function allScoredControls(status = "Not Started") {
  return Object.keys(SPRS_CONTROL_WEIGHTS).map((requirementId) => ({
    externalId: `CMMC.L2-${requirementId}`,
    title: requirementId,
    category: `${requirementId.split(".").slice(0, 2).join(".")} - Test Domain`,
    workspaceState: { status },
  }));
}

describe("CMMC SPRS scoring service", () => {
  it("matches the DoD SPRS score floor when no requirements are implemented", () => {
    const metrics = calculateCMMCSPRSMetricsFromControls(allScoredControls(), "cmmc-level-2", new Date("2026-07-18T00:00:00.000Z"));

    expect(metrics.currentSPRSScore).toBe(-203);
    expect(metrics.pointsAtRisk).toBe(313);
    expect(metrics.pointsSecured).toBe(0);
    expect(metrics.normalizedProgress).toBe(0);
    expect(metrics.criticalGapCount).toBe(44);
  });

  it("awards the maximum score when all requirements are implemented", () => {
    const metrics = calculateCMMCSPRSMetricsFromControls(allScoredControls("Completed"));

    expect(metrics.currentSPRSScore).toBe(110);
    expect(metrics.pointsAtRisk).toBe(0);
    expect(metrics.pointsSecured).toBe(313);
    expect(metrics.readinessPercentage).toBe(100);
    expect(metrics.normalizedProgress).toBe(100);
  });

  it("treats Not Applicable as ready for numeric scoring", () => {
    const metrics = calculateCMMCSPRSMetricsFromControls([
      { externalId: "AC.L2-3.1.1", category: "AC - Access Control", workspaceState: { status: "Not Applicable" } },
    ]);

    expect(metrics.currentSPRSScore).toBe(110);
    expect(metrics.pointsAtRisk).toBe(0);
    expect(metrics.notApplicableControls).toBe(1);
  });

  it("does not grant partial credit without explicit partial-credit data", () => {
    const metrics = calculateCMMCSPRSMetricsFromControls([
      { externalId: "IA.L2-3.5.3", category: "IA - Identification and Authentication", workspaceState: { status: "In Progress" } },
      { externalId: "SC.L2-3.13.11", category: "SC - System and Communications Protection", workspaceState: { status: "Partially Implemented" } },
    ]);

    expect(metrics.pointsAtRisk).toBe(10);
    expect(metrics.controls.every((control) => control.partialCreditEligible)).toBe(true);
    expect(metrics.assumptions.join(" ")).toContain("partial-credit");
  });
});

describe("CMMC evidence validation", () => {
  it("does not require evidence for non-implemented status changes", async () => {
    const client = fakeValidationClient({ uploadedEvidence: [] });

    const result = await validateCMMCImplementedEvidence(client, {
      organizationId: "org-1",
      frameworkId: CMMC_FRAMEWORK_ID,
      itemId: "AC.L2-3.1.1",
      itemType: "control",
      status: "In Progress",
    });

    expect(result.validationFailed).toBe(false);
    expect(client.evidenceRecord.findMany).not.toHaveBeenCalled();
  });

  it("returns missing evidence names when a CMMC control is marked implemented without linked uploads", async () => {
    const client = fakeValidationClient({ uploadedEvidence: [] });

    const result = await validateCMMCImplementedEvidence(client, {
      organizationId: "org-1",
      frameworkId: CMMC_FRAMEWORK_ID,
      itemId: "AC.L2-3.1.1",
      itemType: "control",
      status: "Implemented",
    });

    expect(result.validationFailed).toBe(true);
    expect(result.message).toBe("Upload all required evidence before marking this control as Implemented.");
    expect(result.missingEvidence.join(" ")).toContain("Current user list");
  });

  it("allows implemented status when uploaded evidence is linked to the control", async () => {
    const client = fakeValidationClient({
      uploadedEvidence: [
        {
          id: "evidence-1",
          title: "AC.L2-3.1.1 evidence package.pdf",
          description: null,
          tags: ["cmmc", "AC.L2-3.1.1"],
          versions: [{ fileName: "AC.L2-3.1.1 evidence package.pdf", uploadedAt: new Date("2026-07-18T00:00:00.000Z") }],
        },
      ],
    });

    const result = await validateCMMCImplementedEvidence(client, {
      organizationId: "org-1",
      frameworkId: CMMC_FRAMEWORK_ID,
      itemId: "AC.L2-3.1.1",
      itemType: "control",
      status: "Completed",
    });

    expect(result.validationFailed).toBe(false);
    expect(result.missingEvidence).toEqual([]);
  });
});

function fakeValidationClient({ uploadedEvidence }: { uploadedEvidence: Array<Record<string, unknown>> }) {
  return {
    control: {
      findUnique: vi.fn(async () => ({
        id: "control-db-id",
        frameworkId: CMMC_FRAMEWORK_ID,
        externalId: "AC.L2-3.1.1",
        metadata: {
          evidenceToRequest: "Current user list",
        },
      })),
    },
    evidenceRecord: {
      findMany: vi.fn(async () => uploadedEvidence),
    },
  } as any;
}
