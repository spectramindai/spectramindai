import type { Prisma } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { requireTenant } from "../../plugins/auth.js";
import { validateCMMCImplementedEvidence } from "../../services/cmmcEvidenceValidationService.js";
import { syncControlImplementationFromWorkspaceState } from "../../services/cmmcSPRSService.js";

export async function workspaceRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireTenant);
  app.get("/workspace", async request => {
    const { frameworkId } = z.object({ frameworkId: z.string() }).parse(request.query);
    const rows = await prisma.workspaceItemState.findMany({ where: { organizationId: request.tenant.organizationId, frameworkId } });
    return Object.fromEntries(rows.map(row => [row.itemId, { ...(row.state as object), apiVersion: row.version, apiItemType: row.itemType }]));
  });
  app.put("/workspace/:itemId", async (request, reply) => {
    const { itemId } = z.object({ itemId: z.string().min(1).max(200) }).parse(request.params);
    const input = z.object({ frameworkId: z.string(), itemType: z.string().max(100).optional(), state: z.record(z.string(), z.any()), version: z.number().int().positive().optional() }).parse(request.body);
    const current = await prisma.workspaceItemState.findUnique({ where: { organizationId_frameworkId_itemId: { organizationId: request.tenant.organizationId, frameworkId: input.frameworkId, itemId } } });
    if (current && input.version && current.version !== input.version) return reply.code(409).send({ code: "VERSION_CONFLICT", message: "Workspace item was updated by another user", current });
    const evidenceValidation = await validateCMMCImplementedEvidence(prisma, {
      organizationId: request.tenant.organizationId,
      frameworkId: input.frameworkId,
      itemId,
      itemType: input.itemType,
      status: input.state.status,
    });
    if (evidenceValidation.validationFailed) {
      return reply.code(422).send(evidenceValidation);
    }

    return prisma.$transaction(async tx => {
      const row = await tx.workspaceItemState.upsert({ where: { organizationId_frameworkId_itemId: { organizationId: request.tenant.organizationId, frameworkId: input.frameworkId, itemId } }, create: { organizationId: request.tenant.organizationId, frameworkId: input.frameworkId, itemId, itemType: input.itemType, state: input.state as Prisma.InputJsonValue, createdBy: request.tenant.userId, updatedBy: request.tenant.userId }, update: { itemType: input.itemType, state: input.state as Prisma.InputJsonValue, updatedBy: request.tenant.userId, version: { increment: 1 } } });
      await syncControlImplementationFromWorkspaceState(tx, {
        organizationId: request.tenant.organizationId,
        userId: request.tenant.userId,
        frameworkId: input.frameworkId,
        itemId,
        itemType: input.itemType,
        state: input.state,
      });
      await tx.activityEvent.create({ data: { organizationId: request.tenant.organizationId, actorUserId: request.tenant.userId, action: "workspace_item.updated", entityType: input.itemType || "workspace_item", entityId: itemId, metadata: { frameworkId: input.frameworkId } } });
      return { ...row.state as object, apiVersion: row.version, apiItemType: row.itemType };
    });
  });
}
