import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

vi.mock("../../spectramind/src/core/engines/framework-engine/frameworkRegistry", () => ({
  CMMC_FRAMEWORK_ID: "cmmc-level-2", getFrameworkLibrary: () => null,
}));
import { buildCMMCPolicyDocumentRows, buildCMMCPolicyDocumentMetrics } from "../../spectramind/src/features/cmmc/services/cmmcPolicyWorkflowService.js";
import { cmmcDomains } from "../../spectramind/src/features/cmmc/data/cmmcDomains.js";
import { createTextPDF } from "../../spectramind/src/features/cmmc/services/cmmcSSPExportService.js";
const collection = name => JSON.parse(readFileSync(new URL(`../../spectramind/src/core/framework-library/cmmc/${name}.json`, import.meta.url), "utf8"))[name];
const library = { controls: collection("controls"), evidence: collection("evidence"), mappings: collection("mappings") };

describe("Connected CMMC catalogue and policy views", () => {
  it("provides 110 unique controls across all 14 domain definitions", () => {
    expect(library.controls).toHaveLength(110);
    expect(cmmcDomains).toHaveLength(14);
    expect(new Set(library.controls.map(control => control.controlId || control.id)).size).toBe(110);
    expect(cmmcDomains.reduce((sum, domain) => sum + domain.totalControls, 0)).toBe(110);
  });
  it("builds one policy view per control and carries shared owner and workflow fields", () => {
    const rows = buildCMMCPolicyDocumentRows({ frameworkLibrary: library, controlWorkflowFields: { "AC.L2-3.1.1": { status: "In Progress", owner: "Security" } } });
    expect(rows).toHaveLength(110);
    const row = rows.find(row => row.controlId === "AC.L2-3.1.1");
    expect(row.ownerCollector).toBe("Security");
    expect(row.policyStatus).toBe("In Progress");
    expect(buildCMMCPolicyDocumentMetrics(rows).inProgressPolicies).toBe(1);
  });
  it("creates a PDF payload using the shared SSP/POA&M export primitive", async () => {
    const blob = createTextPDF([]);
    expect(blob.type).toBe("application/pdf");
    expect(await blob.text()).toContain("%PDF-");
  });
});
