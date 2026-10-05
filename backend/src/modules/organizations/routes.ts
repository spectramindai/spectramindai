import type { FastifyInstance, FastifyRequest } from "fastify";
import type { MembershipRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { requireTenant } from "../../plugins/auth.js";

const managementRoles = new Set<MembershipRole>(["OWNER", "ADMIN", "COMPLIANCE_MANAGER"]);
const roleSchema = z.enum(["ADMIN", "COMPLIANCE_MANAGER", "EMPLOYEE"]);
const emailSchema = z.email().transform(value => value.trim().toLowerCase());

export async function organizationRoutes(app: FastifyInstance) {
  app.post("/organizations", { preHandler: [app.authenticate] }, async (request, reply) => {
    const input = z.object({ name: z.string().trim().min(2).max(120), contactEmail: emailSchema }).parse(request.body);
    const user = await prisma.user.findUnique({ where: { id: request.user.sub }, include: { memberships: true } });
    if (!user) return reply.code(404).send({ code: "USER_NOT_FOUND", message: "User not found" });
    if (user.memberships.length) return reply.code(409).send({ code: "ORGANIZATION_ALREADY_ASSIGNED", message: "This account already belongs to an organization" });
    if (!managementRoles.has(user.requestedRole)) return reply.code(403).send({ code: "ROLE_CANNOT_CREATE_ORGANIZATION", message: "Only an Admin or Manager can create an organization" });
    const slug = await uniqueSlug(slugify(input.name));
    const result = await prisma.$transaction(async tx => {
      const organization = await tx.organization.create({ data: { name: input.name, contactEmail: input.contactEmail, slug } });
      const role: MembershipRole = user.requestedRole === "COMPLIANCE_MANAGER" ? "COMPLIANCE_MANAGER" : "OWNER";
      const membership = await tx.organizationMembership.create({ data: { organizationId: organization.id, userId: user.id, role } });
      await tx.activityEvent.create({ data: { organizationId: organization.id, actorUserId: user.id, action: "organization.created", entityType: "organization", entityId: organization.id } });
      return { organization, membership };
    });
    return reply.code(201).send(organizationView(result.organization, result.membership.role));
  });

  app.get("/invitations/me", { preHandler: [app.authenticate] }, async request => {
    const user = await prisma.user.findUnique({ where: { id: request.user.sub }, select: { email: true } });
    if (!user) return [];
    return prisma.organizationInvitation.findMany({ where: { email: user.email.toLowerCase(), status: "PENDING" }, include: { organization: { select: { name: true } } }, orderBy: { createdAt: "desc" } });
  });

  app.post("/invitations/:token/accept", { preHandler: [app.authenticate] }, async (request, reply) => {
    const { token } = z.object({ token: z.uuid() }).parse(request.params);
    const user = await prisma.user.findUnique({ where: { id: request.user.sub }, include: { memberships: true } });
    const invitation = await prisma.organizationInvitation.findUnique({ where: { token }, include: { organization: true } });
    if (!user || !invitation || invitation.status !== "PENDING") return reply.code(404).send({ code: "INVITATION_NOT_FOUND", message: "Invitation is invalid or no longer pending" });
    if (user.email.toLowerCase() !== invitation.email.toLowerCase()) return reply.code(403).send({ code: "INVITATION_EMAIL_MISMATCH", message: "This invitation belongs to another email address" });
    if (user.memberships.length) return reply.code(409).send({ code: "ORGANIZATION_ALREADY_ASSIGNED", message: "This account already belongs to an organization" });
    const membership = await prisma.$transaction(async tx => {
      const created = await tx.organizationMembership.create({ data: { organizationId: invitation.organizationId, userId: user.id, role: invitation.role } });
      await tx.organizationInvitation.update({ where: { id: invitation.id }, data: { status: "ACCEPTED", acceptedById: user.id, acceptedAt: new Date() } });
      await tx.employee.updateMany({ where: { organizationId: invitation.organizationId, email: invitation.email }, data: { membershipId: created.id, accessRole: invitation.role, hasAccess: true, updatedBy: user.id } });
      await tx.activityEvent.create({ data: { organizationId: invitation.organizationId, actorUserId: user.id, action: "invitation.accepted", entityType: "membership", entityId: created.id, metadata: { email: invitation.email } } });
      return created;
    });
    return organizationView(invitation.organization, membership.role);
  });

  app.register(async tenantApp => {
    tenantApp.addHook("preHandler", requireTenant);

    tenantApp.get("/organizations/current", async request => prisma.organization.findUnique({ where: { id: request.tenant.organizationId } }));
    tenantApp.patch("/organizations/current", async request => {
      requireManager(request);
      const input = z.object({
        name: z.string().trim().min(2).max(120).optional(),
        contactEmail: emailSchema.optional(),
        logoDataUrl: z.string().max(2_500_000).refine(value => !value || /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(value), "Logo must be a base64 image data URL").optional(),
      }).parse(request.body);
      return prisma.organization.update({ where: { id: request.tenant.organizationId }, data: input });
    });

    tenantApp.get("/invitations", async request => { requireManager(request); return prisma.organizationInvitation.findMany({ where: { organizationId: request.tenant.organizationId }, orderBy: { createdAt: "desc" } }); });
    tenantApp.post("/invitations", async (request, reply) => {
      requireManager(request);
      const input = z.object({ email: emailSchema, role: roleSchema.default("EMPLOYEE") }).parse(request.body);
      const existingMember = await prisma.user.findUnique({ where: { email: input.email }, include: { memberships: true } });
      if (existingMember?.memberships.some(item => item.organizationId === request.tenant.organizationId)) return reply.code(409).send({ code: "ALREADY_MEMBER", message: "This email already belongs to the organization" });
      if (existingMember?.memberships.length) return reply.code(409).send({ code: "ACCOUNT_IN_ANOTHER_ORGANIZATION", message: "This account already belongs to another organization" });
      const invitation = await prisma.organizationInvitation.upsert({
        where: { organizationId_email: { organizationId: request.tenant.organizationId, email: input.email } },
        create: { organizationId: request.tenant.organizationId, email: input.email, role: input.role, invitedBy: request.tenant.userId },
        update: { role: input.role, status: "PENDING", invitedBy: request.tenant.userId, token: crypto.randomUUID(), acceptedById: null, acceptedAt: null, revokedAt: null },
      });
      await prisma.employee.updateMany({ where: { organizationId: request.tenant.organizationId, email: input.email }, data: { accessRole: input.role, updatedBy: request.tenant.userId } });
      return reply.code(201).send(invitation);
    });
    tenantApp.delete("/invitations/:id", async (request, reply) => {
      requireManager(request);
      const { id } = z.object({ id: z.uuid() }).parse(request.params);
      const invitation = await prisma.organizationInvitation.findFirst({ where: { id, organizationId: request.tenant.organizationId, status: "PENDING" } });
      if (!invitation) return reply.code(404).send({ code: "INVITATION_NOT_FOUND", message: "Pending invitation not found" });
      await prisma.$transaction(async tx => {
        await tx.organizationInvitation.update({ where: { id }, data: { status: "REVOKED", revokedAt: new Date() } });
        // Keep the employee record and its assignments so the manager can invite
        // the same person again later. Only workspace access is revoked.
        await tx.employee.updateMany({
          where: {
            organizationId: request.tenant.organizationId,
            email: invitation.email.toLowerCase(),
            membershipId: null,
          },
          data: {
            hasAccess: false,
            updatedBy: request.tenant.userId,
            version: { increment: 1 },
          },
        });
        await tx.activityEvent.create({
          data: {
            organizationId: request.tenant.organizationId,
            actorUserId: request.tenant.userId,
            action: "invitation.revoked",
            entityType: "invitation",
            entityId: id,
            metadata: { email: invitation.email },
          },
        });
      });
      return reply.code(204).send();
    });

    tenantApp.patch("/memberships/:id/role", async (request, reply) => {
      requireManager(request);
      const { id } = z.object({ id: z.uuid() }).parse(request.params);
      const { role } = z.object({ role: roleSchema }).parse(request.body);
      const membership = await prisma.organizationMembership.findFirst({ where: { id, organizationId: request.tenant.organizationId }, include: { user: true } });
      if (!membership) return reply.code(404).send({ code: "MEMBERSHIP_NOT_FOUND", message: "Organization member not found" });
      if (membership.userId === request.tenant.userId) return reply.code(409).send({ code: "CANNOT_CHANGE_OWN_ROLE", message: "You cannot change your own role" });
      const updated = await prisma.$transaction(async tx => {
        const record = await tx.organizationMembership.update({ where: { id }, data: { role } });
        await tx.employee.updateMany({ where: { membershipId: id }, data: { accessRole: role, jobRole: labelRole(role), updatedBy: request.tenant.userId } });
        await tx.organizationInvitation.updateMany({ where: { organizationId: request.tenant.organizationId, email: membership.user.email.toLowerCase() }, data: { role } });
        await tx.activityEvent.create({ data: { organizationId: request.tenant.organizationId, actorUserId: request.tenant.userId, action: "membership.role.updated", entityType: "membership", entityId: id, metadata: { role } } });
        return record;
      });
      return updated;
    });

    tenantApp.delete("/memberships/:id", async (request, reply) => {
      requireManager(request);
      const { id } = z.object({ id: z.uuid() }).parse(request.params);
      const membership = await prisma.organizationMembership.findFirst({ where: { id, organizationId: request.tenant.organizationId } });
      if (!membership) return reply.code(404).send({ code: "MEMBERSHIP_NOT_FOUND", message: "Organization member not found" });
      if (membership.userId === request.tenant.userId) return reply.code(409).send({ code: "CANNOT_REMOVE_SELF", message: "You cannot remove your own membership" });
      await prisma.organizationMembership.delete({ where: { id } });
      return reply.code(204).send();
    });
  });
}

function requireManager(request: FastifyRequest) {
  if (!managementRoles.has(request.tenant.role)) throw Object.assign(new Error("Only an Admin or Manager can perform this action"), { statusCode: 403 });
}
function labelRole(role: MembershipRole) { return role === "EMPLOYEE" ? "User" : role === "COMPLIANCE_MANAGER" ? "Manager" : "Admin"; }
function organizationView(organization: { id: string; name: string; slug: string }, role: MembershipRole) { return { id: organization.id, name: organization.name, slug: organization.slug, role }; }
function slugify(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "organization"; }
async function uniqueSlug(base: string) { let slug = base; let suffix = 1; while (await prisma.organization.findUnique({ where: { slug }, select: { id: true } })) slug = `${base}-${++suffix}`; return slug; }
