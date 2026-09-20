import { describe, expect, it } from "vitest";
import { operationSchema } from "../src/modules/cmmc/operations.js";

const base = { module: "calendar", title: "Quarterly review", owner: "Security team", status: "Scheduled", dueDate: "2026-09-30", controlIds: [], relatedIds: [], evidenceIds: [], details: {}, archived: false };
describe("CMMC operational record validation", () => {
  it("rejects unsupported modules", () => expect(operationSchema.safeParse({ ...base, module: "obsolete" }).success).toBe(false));
  it("accepts scheduled work", () => expect(operationSchema.safeParse(base).success).toBe(true));
  it("requires a calendar due date", () => expect(operationSchema.safeParse({ ...base, dueDate: "" }).success).toBe(false));
  it("rejects invalid calendar dates", () => expect(operationSchema.safeParse({ ...base, dueDate: "2026-02-31" }).success).toBe(false));
  it("requires a completion result", () => expect(operationSchema.safeParse({ ...base, status: "Completed" }).success).toBe(false));
});
