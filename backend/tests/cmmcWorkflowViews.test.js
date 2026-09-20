import { describe, it, expect } from "vitest";
import { nextOccurrence, validateOperation, workflowLabels, operationModules } from "../../spectramind/src/features/cmmc/data/operations.js";

describe("Distinct CMMC workflows", () => {
  it("gives every operational module a purpose-specific action", () => {
    expect(Object.keys(workflowLabels).sort()).toEqual(Object.keys(operationModules).sort());
    expect(new Set(Object.values(workflowLabels).map(labels => labels[0])).size).toBe(3);
  });
  it("advances recurrence safely across short months", () => {
    expect(nextOccurrence("2026-01-31", "Monthly")).toBe("2026-02-28");
    expect(nextOccurrence("2024-02-29", "Yearly")).toBe("2025-02-28");
    expect(nextOccurrence("2026-12-31", "Quarterly")).toBe("2027-03-31");
  });
  it("requires document-specific approval metadata", () => {
    const record = { module: "documents", title: "Access policy", owner: "Security", status: "Approved", details: { approval: "Approved by owner" } };
    expect(validateOperation(record)).not.toBe("");
    expect(validateOperation({ ...record, details: { ...record.details, documentVersion: "2.0", effectiveDate: "2026-09-04", location: "Controlled repository" } })).toBe("");
  });
});
