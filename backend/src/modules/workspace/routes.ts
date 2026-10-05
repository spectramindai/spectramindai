import type { Prisma } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { requireTenant, requireWorkspaceManager } from '../../plugins/auth.js';
import { validateCMMCImplementedEvidence } from '../../services/cmmcEvidenceValidationService.js';
import { CMMC_FRAMEWORK_ID, syncControlImplementationFromWorkspaceState } from '../../services/cmmcSPRSService.js';
import { lockOrganization, mergeWorkspacePatch, readWorkspace } from '../../services/workspaceState.js';

export async function workspaceRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireTenant);
  app.get('/workspace', async request => {
    const { frameworkId } = z.object({ frameworkId: z.string() }).parse(request.query);
    return prisma.$transaction(tx => readWorkspace(tx, request.tenant.organizationId, frameworkId), { isolationLevel: 'RepeatableRead', timeout: 15000 });
  });
  app.put('/workspace/:itemId', async (request, reply) => {
    requireWorkspaceManager(request);
    const { itemId } = z.object({ itemId: z.string().min(1).max(200) }).parse(request.params);
    if (itemId.startsWith('cmmc-operation:')) return reply.code(403).send({ message: 'Use the CMMC operations endpoint for operational records.' });
    const input = z.object({ frameworkId: z.string(), itemType: z.string().max(100).optional(), state: z.record(z.string(), z.unknown()), version: z.number().int().nonnegative().optional() }).parse(request.body);
    if (input.version === undefined) return reply.code(428).send({ code: 'VERSION_REQUIRED', message: 'Reload this workspace before saving.' });
    return prisma.$transaction(async tx => {
      const organizationId = request.tenant.organizationId;
      await lockOrganization(tx, organizationId);
      const active = await tx.organizationFramework.findUnique({ where: { organizationId_frameworkId: { organizationId, frameworkId: input.frameworkId } } });
      if (!active?.active) throw Object.assign(new Error('Framework is not active'), { statusCode: 403 });
      const key = { organizationId, frameworkId: input.frameworkId, itemId };
      const current = await tx.workspaceItemState.findUnique({ where: { organizationId_frameworkId_itemId: key } });
      if ((current?.version ?? 0) !== input.version) throw Object.assign(new Error('This record changed in another session. Reload and review before saving.'), { statusCode: 409, code: 'VERSION_CONFLICT' });
      const state = mergeWorkspacePatch(current?.state, input.state);
      if (Object.hasOwn(input.state, 'status')) state.evidenceIncomplete = false;
      const isControl = input.frameworkId === CMMC_FRAMEWORK_ID && /^[A-Z]{2}\.L2-\d+\.\d+\.\d+$/.test(itemId);
      const itemType = isControl ? 'control' : current?.itemType || input.itemType;
      // Validate declaration changes only. Editing an owner must not rewrite a declaration.
      if (Object.hasOwn(input.state, 'status')) {
        const validation = await validateCMMCImplementedEvidence(tx, { organizationId, frameworkId: input.frameworkId, itemId, itemType, status: state.status });
        if (validation.validationFailed) return reply.code(422).send(validation);
      }
      const row = await tx.workspaceItemState.upsert({ where: { organizationId_frameworkId_itemId: key },
        create: { ...key, itemType, state: state as Prisma.InputJsonValue, createdBy: request.tenant.userId, updatedBy: request.tenant.userId },
        update: { itemType, state: state as Prisma.InputJsonValue, updatedBy: request.tenant.userId, version: { increment: 1 } },
      });
      if (Object.hasOwn(input.state, 'status')) await syncControlImplementationFromWorkspaceState(tx, { organizationId, userId: request.tenant.userId, frameworkId: input.frameworkId, itemId, itemType, state });
      await tx.activityEvent.create({ data: { organizationId, actorUserId: request.tenant.userId, action: 'workspace_item.updated', entityType: itemType || 'workspace_item', entityId: itemId, metadata: { frameworkId: input.frameworkId } } });
      if (isControl) return (await readWorkspace(tx, organizationId, input.frameworkId))[itemId];
      return { ...state, apiVersion: row.version, apiItemType: row.itemType };
    }, { timeout: 15000 });
  });
}
