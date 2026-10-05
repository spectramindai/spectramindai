import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({
  organizationFramework: { findFirst: vi.fn() }, control: { findMany: vi.fn() }, evidenceRecord: { count: vi.fn() },
  workspaceItemState: { findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
  activityEvent: { create: vi.fn() }, $transaction: vi.fn(),
}));
vi.mock("../src/lib/prisma.js", () => ({ prisma: db }));
vi.mock("../src/plugins/auth.js", () => ({ requireTenant: async (request: any) => { request.tenant = { organizationId: "org-a", userId: "user-a", role: request.headers["test-role"] || "ADMIN" }; } }));
import { cmmcOperationRoutes } from "../src/modules/cmmc/operations.js";
const id = "11111111-1111-4111-8111-111111111111";
const record = { module: "calendar", title: "Review", owner: "IT", status: "Scheduled", dueDate: "2026-09-30", controlIds: [], relatedIds: [], evidenceIds: [], details: {}, archived: false };
async function app() { const server = Fastify(); await server.register(cmmcOperationRoutes); return server; }
beforeEach(() => { vi.resetAllMocks(); db.organizationFramework.findFirst.mockResolvedValue({ active: true }); db.workspaceItemState.findFirst.mockResolvedValue(null); db.$transaction.mockImplementation(fn => fn(db)); });
describe("CMMC operations API isolation and saves", () => {
  it("reads only this organization's records", async () => {
    db.workspaceItemState.findMany.mockResolvedValue([]);
    const server = await app(); await server.inject({ method: "GET", url: "/cmmc/operations" });
    expect(db.workspaceItemState.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ organizationId: "org-a", frameworkId: "cmmc-level-2" }) })); await server.close();
  });
  it("excludes unsupported stored modules from the shared endpoint", async () => {
    db.workspaceItemState.findMany.mockResolvedValue([
      { itemId: `cmmc-operation:${id}`, state: record, version: 1 },
      { itemId: "cmmc-operation:obsolete", state: { ...record, module: "obsolete" }, version: 1 },
    ]);
    const server = await app();
    const response = await server.inject({ method: "GET", url: "/cmmc/operations" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([expect.objectContaining({ id, module: "calendar" })]);
    await server.close();
  });
  it("rejects employee writes", async () => {
    const server = await app(); const response = await server.inject({ method: "PUT", url: `/cmmc/operations/${id}`, headers: { "test-role": "EMPLOYEE" }, payload: { record, version: 0 } });
    expect(response.statusCode).toBe(403); expect(db.$transaction).not.toHaveBeenCalled(); await server.close();
  });
  it("requires a selected CMMC framework", async () => {
    db.organizationFramework.findFirst.mockResolvedValue(null);
    const server = await app(); const response = await server.inject({ method: "PUT", url: `/cmmc/operations/${id}`, payload: { record, version: 0 } }); expect(response.statusCode).toBe(403); await server.close();
  });
  it("saves a new record and its history", async () => {
    const server = await app(); const response = await server.inject({ method: "PUT", url: `/cmmc/operations/${id}`, payload: { record, version: 0 } });
    expect(response.statusCode).toBe(200); expect(response.json().version).toBe(1); expect(response.json().history[0].actor).toBe("user-a"); expect(db.activityEvent.create).toHaveBeenCalled(); await server.close();
  });
  it("rejects a stale revision without writing", async () => {
    db.workspaceItemState.findFirst.mockResolvedValue({ version: 2, state: record });
    const server = await app(); const response = await server.inject({ method: "PUT", url: `/cmmc/operations/${id}`, payload: { record, version: 1 } });
    expect(response.statusCode).toBe(409); expect(db.workspaceItemState.updateMany).not.toHaveBeenCalled(); await server.close();
  });
  it("rejects evidence outside the tenant", async () => {
    db.evidenceRecord.count.mockResolvedValue(0);
    const server = await app(); const response = await server.inject({ method: "PUT", url: `/cmmc/operations/${id}`, payload: { record: { ...record, evidenceIds: ["foreign-evidence"] }, version: 0 } });
    expect(response.statusCode).toBe(400); expect(db.evidenceRecord.count).toHaveBeenCalledWith({ where: { organizationId: "org-a", frameworkId: "cmmc-level-2", id: { in: ["foreign-evidence"] } } }); await server.close();
  });
});
