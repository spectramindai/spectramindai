import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { requireTenant } from "../../plugins/auth.js";

const managers = new Set(["OWNER", "ADMIN", "COMPLIANCE_MANAGER", "SECURITY_MANAGER"]);
const defaults = {
  published: false,
  headline: "Security and compliance are built into how we operate.",
  description: "Review our compliance posture, security program, and approved customer-facing resources.",
  securityEmail: null,
  website: null,
  showReadiness: true,
  showFrameworks: true,
  showPolicies: true,
  allowAccessRequests: true,
};
const profileInput = z.object({
  published: z.boolean(),
  headline: z.string().trim().min(5).max(240),
  description: z.string().trim().min(10).max(2000),
  securityEmail: z.union([z.email(), z.literal("")]).nullable().optional(),
  website: z.union([z.url(), z.literal("")]).nullable().optional(),
  showReadiness: z.boolean(),
  showFrameworks: z.boolean(),
  showPolicies: z.boolean(),
  allowAccessRequests: z.boolean(),
  version: z.number().int().positive().optional(),
});

export async function trustRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireTenant);

  app.get("/trust-center/profile", async request => {
    const profile = await prisma.trustCenterProfile.findUnique({ where: { organizationId: request.tenant.organizationId } });
    return profile || { ...defaults, organizationId: request.tenant.organizationId, version: 0 };
  });

  app.put("/trust-center/profile", async (request, reply) => {
    requireManager(request);
    const input = profileInput.parse(request.body);
    const current = await prisma.trustCenterProfile.findUnique({ where: { organizationId: request.tenant.organizationId } });
    if (current && input.version && current.version !== input.version) return reply.code(409).send({ code: "VERSION_CONFLICT", message: "Trust Center settings were updated by another user", current });
    const { version: _version, securityEmail, website, ...values } = input;
    return prisma.$transaction(async tx => {
      const profile = await tx.trustCenterProfile.upsert({
        where: { organizationId: request.tenant.organizationId },
        create: { ...values, securityEmail: securityEmail || null, website: website || null, organizationId: request.tenant.organizationId, updatedBy: request.tenant.userId },
        update: { ...values, securityEmail: securityEmail || null, website: website || null, updatedBy: request.tenant.userId, version: { increment: 1 } },
      });
      await tx.activityEvent.create({ data: { organizationId: request.tenant.organizationId, actorUserId: request.tenant.userId, action: profile.published ? "trust_center.published" : "trust_center.updated", entityType: "trust_center", entityId: profile.id } });
      return profile;
    });
  });

  app.get("/trust-center/requests", async request => prisma.trustAccessRequest.findMany({
    where: { organizationId: request.tenant.organizationId, ...(managers.has(request.tenant.role) ? {} : { requestedBy: request.tenant.userId }) },
    orderBy: { createdAt: "desc" },
  }));

  app.post("/trust-center/requests", async (request, reply) => {
    const profile = await prisma.trustCenterProfile.findUnique({ where: { organizationId: request.tenant.organizationId } });
    if (profile && !profile.allowAccessRequests) return reply.code(403).send({ code: "ACCESS_REQUESTS_DISABLED", message: "Trust Center access requests are disabled" });
    const input = z.object({ name: z.string().trim().min(2).max(120), email: z.email().transform(value => value.trim().toLowerCase()), company: z.string().trim().min(2).max(160), resource: z.string().trim().min(2).max(160), reason: z.string().trim().max(2000).optional() }).parse(request.body);
    const record = await prisma.$transaction(async tx => {
      const created = await tx.trustAccessRequest.create({ data: { ...input, organizationId: request.tenant.organizationId, requestedBy: request.tenant.userId } });
      await tx.activityEvent.create({ data: { organizationId: request.tenant.organizationId, actorUserId: request.tenant.userId, action: "trust_access.requested", entityType: "trust_access_request", entityId: created.id, metadata: { resource: created.resource } } });
      return created;
    });
    return reply.code(201).send(record);
  });

  app.patch("/trust-center/requests/:id", async (request, reply) => {
    requireManager(request);
    const { id } = z.object({ id: z.uuid() }).parse(request.params);
    const { status } = z.object({ status: z.enum(["APPROVED", "DENIED"]) }).parse(request.body);
    const current = await prisma.trustAccessRequest.findFirst({ where: { id, organizationId: request.tenant.organizationId } });
    if (!current) return reply.code(404).send({ code: "REQUEST_NOT_FOUND", message: "Trust Center access request not found" });
    return prisma.$transaction(async tx => {
      const updated = await tx.trustAccessRequest.update({ where: { id }, data: { status, reviewedBy: request.tenant.userId, reviewedAt: new Date() } });
      await tx.activityEvent.create({ data: { organizationId: request.tenant.organizationId, actorUserId: request.tenant.userId, action: `trust_access.${status.toLowerCase()}`, entityType: "trust_access_request", entityId: id } });
      return updated;
    });
  });
}

function requireManager(request: FastifyRequest) {
  if (!managers.has(request.tenant.role)) throw Object.assign(new Error("Only an Admin or Manager can manage the Trust Center"), { statusCode: 403 });
}
