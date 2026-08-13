import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { requireTenant } from "../../plugins/auth.js";
import { readFrameworkCollection } from "../workflows/library.js";

const managers = new Set(["OWNER", "ADMIN", "COMPLIANCE_MANAGER", "SECURITY_MANAGER", "HR_MANAGER"]);
const employeeInput = z.object({ name: z.string().trim().min(2).max(120), email: z.email().transform(v => v.toLowerCase()), jobRole: z.string().max(120).optional(), accessRole: z.enum(["ADMIN", "COMPLIANCE_MANAGER", "EMPLOYEE"]).default("EMPLOYEE"), employmentType: z.string().max(80).optional(), hasAccess: z.boolean().default(true), startDate: z.iso.datetime().nullable().optional(), endDate: z.iso.datetime().nullable().optional(), tags: z.array(z.string().max(50)).max(30).default([]) });
const defaultCourses = [
  ["soc2-security-awareness", "Security Awareness", "Core security practices for SOC 2 readiness.", ["SOC 2"]],
  ["soc2-password-security", "Password Security", "Password hygiene, MFA, and account protection.", ["SOC 2"]],
  ["soc2-acceptable-use", "Acceptable Use", "Acceptable use expectations for company systems and data.", ["SOC 2"]],
  ["soc2-incident-reporting", "Incident Reporting", "How to identify and report security incidents.", ["SOC 2"]],
  ["soc2-phishing-awareness", "Phishing Awareness", "Recognizing and reporting phishing attempts.", ["SOC 2"]],
  ["iso27001-information-security-awareness", "Information Security Awareness", "Security responsibilities aligned with ISO 27001.", ["ISO 27001"]],
] as const;

export async function peopleRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireTenant);
  app.get("/employees", async request => {
    const organizationId = request.tenant.organizationId;
    const [employees, invitations] = await Promise.all([
      prisma.employee.findMany({ where: { organizationId }, orderBy: { name: "asc" } }),
      prisma.organizationInvitation.findMany({ where: { organizationId, status: "PENDING" } }),
    ]);
    const pendingByEmail = new Map(invitations.map(invitation => [invitation.email.toLowerCase(), invitation]));
    return employees.map(employee => ({ ...employee, pendingInvitation: pendingByEmail.get(employee.email.toLowerCase()) ?? null }));
  });
  app.post("/employees", async (request, reply) => { requireManager(request); const input = employeeInput.parse(request.body); const record = await prisma.$transaction(async tx => { const employee = await tx.employee.create({ data: { ...input, startDate: input.startDate ? new Date(input.startDate) : null, endDate: input.endDate ? new Date(input.endDate) : null, organizationId: request.tenant.organizationId, createdBy: request.tenant.userId, updatedBy: request.tenant.userId } }); await tx.activityEvent.create({ data: { organizationId: request.tenant.organizationId, actorUserId: request.tenant.userId, action: "employee.created", entityType: "employee", entityId: employee.id } }); return employee; }); return reply.code(201).send(record); });
  app.patch("/employees/:id", async (request, reply) => { requireManager(request); const { id } = z.object({ id: z.uuid() }).parse(request.params); const input = employeeInput.partial().extend({ version: z.number().int().positive() }).parse(request.body); const current = await ownedEmployee(id, request.tenant.organizationId); if (current.version !== input.version) return reply.code(409).send({ code: "VERSION_CONFLICT", current }); const { version: _, startDate, endDate, ...updates } = input; return prisma.employee.update({ where: { id }, data: { ...updates, startDate: startDate ? new Date(startDate) : startDate, endDate: endDate ? new Date(endDate) : endDate, updatedBy: request.tenant.userId, version: { increment: 1 } } }); });
  app.delete("/employees/:id/access", async (request, reply) => {
    requireManager(request);
    const { id } = z.object({ id: z.uuid() }).parse(request.params);
    const employee = await ownedEmployee(id, request.tenant.organizationId);

    if (employee.membershipId) {
      const membership = await prisma.organizationMembership.findUnique({ where: { id: employee.membershipId } });
      if (membership?.userId === request.tenant.userId) {
        return reply.code(409).send({ code: "CANNOT_REMOVE_SELF", message: "You cannot remove your own workspace access" });
      }
    }

    const updated = await prisma.$transaction(async tx => {
      if (employee.membershipId) {
        await tx.organizationMembership.delete({ where: { id: employee.membershipId } });
      }
      await tx.organizationInvitation.updateMany({
        where: { organizationId: request.tenant.organizationId, email: employee.email.toLowerCase(), status: "PENDING" },
        data: { status: "REVOKED", revokedAt: new Date() },
      });
      const record = await tx.employee.update({
        where: { id },
        data: {
          membershipId: null,
          hasAccess: false,
          updatedBy: request.tenant.userId,
          version: { increment: 1 },
        },
      });
      await tx.activityEvent.create({
        data: {
          organizationId: request.tenant.organizationId,
          actorUserId: request.tenant.userId,
          action: "employee.access.revoked",
          entityType: "employee",
          entityId: id,
          metadata: { email: employee.email, evidenceRetained: true },
        },
      });
      return record;
    });

    return updated;
  });
  app.delete("/employees/:id", async (request, reply) => {
    requireManager(request);
    const { id } = z.object({ id: z.uuid() }).parse(request.params);
    const employee = await ownedEmployee(id, request.tenant.organizationId);
    if (employee.membershipId) {
      const membership = await prisma.organizationMembership.findUnique({ where: { id: employee.membershipId } });
      if (membership?.userId === request.tenant.userId) {
        return reply.code(409).send({ code: "CANNOT_REMOVE_SELF", message: "You cannot remove your own employee profile" });
      }
    }
    await prisma.$transaction(async tx => {
      // Removing a joined employee must revoke workspace access too. Evidence is
      // intentionally retained because it is attributed to the user UUID, not
      // cascaded through the employee profile.
      if (employee.membershipId) {
        await tx.organizationMembership.delete({ where: { id: employee.membershipId } });
      }
      await tx.employee.delete({ where: { id } });
      await tx.organizationInvitation.updateMany({
        where: { organizationId: request.tenant.organizationId, email: employee.email.toLowerCase(), status: "PENDING" },
        data: { status: "REVOKED", revokedAt: new Date() },
      });
      await tx.activityEvent.create({
        data: {
          organizationId: request.tenant.organizationId,
          actorUserId: request.tenant.userId,
          action: "employee.removed",
          entityType: "employee",
          entityId: id,
          metadata: { email: employee.email, evidenceRetained: true },
        },
      });
    });
    return reply.code(204).send();
  });
  app.post("/employees/:id/background-check", async request => { requireManager(request); const { id } = z.object({ id: z.uuid() }).parse(request.params); await ownedEmployee(id, request.tenant.organizationId); return prisma.$transaction(async tx => { const employee = await tx.employee.update({ where: { id }, data: { backgroundCheckCompletedAt: new Date(), updatedBy: request.tenant.userId, version: { increment: 1 } } }); await tx.activityEvent.create({ data: { organizationId: request.tenant.organizationId, actorUserId: request.tenant.userId, action: "employee.background_check.completed", entityType: "employee", entityId: id } }); return employee; }); });

  app.post("/policies/sync", async request => { requireManager(request); const { frameworkId } = z.object({ frameworkId: z.string() }).parse(request.body); await assertActive(request.tenant.organizationId, frameworkId); const definitions = await readFrameworkCollection(frameworkId, "policies.json", "policies"); await prisma.$transaction(definitions.map((policy: any) => prisma.policy.upsert({ where: { organizationId_frameworkId_sourcePolicyId: { organizationId: request.tenant.organizationId, frameworkId, sourcePolicyId: policy.id } }, create: { organizationId: request.tenant.organizationId, frameworkId, sourcePolicyId: policy.id, name: policy.title ?? policy.name, description: policy.description ?? policy.aiSummary, ownerName: policy.ownerRole, custom: false, createdBy: request.tenant.userId, updatedBy: request.tenant.userId }, update: { name: policy.title ?? policy.name, description: policy.description ?? policy.aiSummary, ownerName: policy.ownerRole } }))); return { synchronized: definitions.length }; });
  app.get("/policies", async request => { const query = z.object({ frameworkId: z.string() }).parse(request.query); return prisma.policy.findMany({ where: { organizationId: request.tenant.organizationId, frameworkId: query.frameworkId }, include: { assignments: true }, orderBy: { name: "asc" } }); });
  app.post("/policies", async (request, reply) => {
    requireManager(request);
    const input = policyWriteSchema.extend({ frameworkId: z.string(), name: z.string().min(2).max(255), versionLabel: z.string().max(30).default("1.0") }).parse(request.body);
    await assertActive(request.tenant.organizationId, input.frameworkId);
    const { document, customFieldValues, versionHistory, ...fields } = input;
    const policy = await prisma.policy.create({ data: {
      ...fields,
      document: document as Prisma.InputJsonValue | undefined,
      customFieldValues: customFieldValues as Prisma.InputJsonValue | undefined,
      versionHistory: versionHistory as Prisma.InputJsonValue | undefined,
      effectiveDate: input.effectiveDate ? new Date(input.effectiveDate) : null,
      reviewDate: input.reviewDate ? new Date(input.reviewDate) : null,
      organizationId: request.tenant.organizationId,
      createdBy: request.tenant.userId,
      updatedBy: request.tenant.userId,
    } });
    return reply.code(201).send(policy);
  });
  app.patch("/policies/:id", async (request, reply) => {
    requireManager(request);
    const { id } = z.object({ id: z.uuid() }).parse(request.params);
    const input = policyWriteSchema.extend({ name: z.string().min(2).max(255).optional(), versionLabel: z.string().max(30).optional(), status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(), version: z.number().int().positive() }).parse(request.body);
    const current = await prisma.policy.findFirst({ where: { id, organizationId: request.tenant.organizationId } });
    if (!current) throw notFound("Policy");
    if (current.version !== input.version) return reply.code(409).send({ code: "VERSION_CONFLICT", current });
    const { version: _, effectiveDate, reviewDate, document, customFieldValues, versionHistory, ...updates } = input;
    return prisma.policy.update({ where: { id }, data: {
      ...updates,
      document: document as Prisma.InputJsonValue | undefined,
      customFieldValues: customFieldValues as Prisma.InputJsonValue | undefined,
      versionHistory: versionHistory as Prisma.InputJsonValue | undefined,
      effectiveDate: effectiveDate ? new Date(effectiveDate) : effectiveDate,
      reviewDate: reviewDate ? new Date(reviewDate) : reviewDate,
      updatedBy: request.tenant.userId,
      version: { increment: 1 },
    } });
  });
  app.put("/policies/:id/assignments", async request => { requireManager(request); const { id } = z.object({ id: z.uuid() }).parse(request.params); const { employeeIds } = z.object({ employeeIds: z.array(z.uuid()).max(1000) }).parse(request.body); const policy = await prisma.policy.findFirst({ where: { id, organizationId: request.tenant.organizationId } }); if (!policy) throw notFound("Policy"); const count = await prisma.employee.count({ where: { id: { in: employeeIds }, organizationId: request.tenant.organizationId } }); if (count !== employeeIds.length) throw Object.assign(new Error("Invalid employee assignment"), { statusCode: 400 }); await prisma.$transaction([prisma.policyAssignment.deleteMany({ where: { policyId: id, employeeId: { notIn: employeeIds } } }), ...employeeIds.map(employeeId => prisma.policyAssignment.upsert({ where: { policyId_employeeId: { policyId: id, employeeId } }, create: { policyId: id, employeeId, assignedBy: request.tenant.userId }, update: {} }))]); return { assigned: employeeIds.length }; });
  app.post("/policy-assignments/:id/acknowledge", async request => { const { id } = z.object({ id: z.uuid() }).parse(request.params); const assignment = await prisma.policyAssignment.findFirst({ where: { id, policy: { organizationId: request.tenant.organizationId } } }); if (!assignment) throw notFound("Policy assignment"); return prisma.$transaction(async tx => { const updated = await tx.policyAssignment.update({ where: { id }, data: { acknowledgedAt: new Date(), acknowledgedBy: request.tenant.userId } }); await tx.activityEvent.create({ data: { organizationId: request.tenant.organizationId, actorUserId: request.tenant.userId, action: "policy.acknowledged", entityType: "policy", entityId: assignment.policyId, metadata: { employeeId: assignment.employeeId } } }); return updated; }); });
  app.delete("/policy-assignments/:id/acknowledgement", async request => { requireManager(request); const { id } = z.object({ id: z.uuid() }).parse(request.params); const assignment = await prisma.policyAssignment.findFirst({ where: { id, policy: { organizationId: request.tenant.organizationId } } }); if (!assignment) throw notFound("Policy assignment"); return prisma.policyAssignment.update({ where: { id }, data: { acknowledgedAt: null, acknowledgedBy: null } }); });

  app.post("/training/sync", async request => { requireManager(request); const activeNames = await activeFrameworkNames(request.tenant.organizationId); const applicableCourses = defaultCourses.filter(([, , , related]) => related.some(name => activeNames.some(active => sameFramework(active, name)))); await prisma.$transaction(applicableCourses.map(([externalId, name, description, relatedFrameworks]) => prisma.trainingCourse.upsert({ where: { organizationId_externalId: { organizationId: request.tenant.organizationId, externalId } }, create: { organizationId: request.tenant.organizationId, externalId, name, description, relatedFrameworks: [...relatedFrameworks], custom: false, createdBy: request.tenant.userId, updatedBy: request.tenant.userId }, update: { name, description, relatedFrameworks: [...relatedFrameworks] } }))); return { synchronized: applicableCourses.length }; });
  app.get("/training", async request => { const activeNames = await activeFrameworkNames(request.tenant.organizationId); const courses = await prisma.trainingCourse.findMany({ where: { organizationId: request.tenant.organizationId }, include: { assignments: true }, orderBy: { name: "asc" } }); return courses.filter(course => course.relatedFrameworks.some(name => activeNames.some(active => sameFramework(active, name)))); });
  app.post("/training", async (request, reply) => { requireManager(request); const input = z.object({ name: z.string().min(2).max(255), description: z.string().max(5000).optional(), relatedFrameworks: z.array(z.string().max(100)).min(1).max(20), dueDate: z.iso.datetime().nullable().optional() }).parse(request.body); await assertSelectedFrameworkNames(request.tenant.organizationId, input.relatedFrameworks); const course = await prisma.trainingCourse.create({ data: { ...input, dueDate: input.dueDate ? new Date(input.dueDate) : null, organizationId: request.tenant.organizationId, createdBy: request.tenant.userId, updatedBy: request.tenant.userId } }); return reply.code(201).send(course); });
  app.patch("/training/:id", async request => { requireManager(request); const { id } = z.object({ id: z.uuid() }).parse(request.params); const input = z.object({ name: z.string().min(2).max(255).optional(), description: z.string().max(5000).optional(), relatedFrameworks: z.array(z.string().max(100)).min(1).max(20).optional(), dueDate: z.iso.datetime().nullable().optional() }).parse(request.body); const course = await prisma.trainingCourse.findFirst({ where: { id, organizationId: request.tenant.organizationId } }); if (!course) throw notFound("Training course"); if (input.relatedFrameworks) await assertSelectedFrameworkNames(request.tenant.organizationId, input.relatedFrameworks); return prisma.trainingCourse.update({ where: { id }, data: { ...input, dueDate: input.dueDate ? new Date(input.dueDate) : input.dueDate, updatedBy: request.tenant.userId } }); });
  app.delete("/training/:id", async (request, reply) => { requireManager(request); const { id } = z.object({ id: z.uuid() }).parse(request.params); const course = await prisma.trainingCourse.findFirst({ where: { id, organizationId: request.tenant.organizationId, custom: true } }); if (!course) throw Object.assign(new Error("Only custom training courses can be deleted"), { statusCode: 409 }); await prisma.trainingCourse.delete({ where: { id } }); return reply.code(204).send(); });
  app.put("/training/:id/assignments", async request => { requireManager(request); const { id } = z.object({ id: z.uuid() }).parse(request.params); const { employeeIds } = z.object({ employeeIds: z.array(z.uuid()).max(1000) }).parse(request.body); const course = await prisma.trainingCourse.findFirst({ where: { id, organizationId: request.tenant.organizationId } }); if (!course) throw notFound("Training course"); const count = await prisma.employee.count({ where: { id: { in: employeeIds }, organizationId: request.tenant.organizationId } }); if (count !== employeeIds.length) throw Object.assign(new Error("Invalid employee assignment"), { statusCode: 400 }); await prisma.$transaction([prisma.trainingAssignment.deleteMany({ where: { courseId: id, employeeId: { notIn: employeeIds } } }), ...employeeIds.map(employeeId => prisma.trainingAssignment.upsert({ where: { courseId_employeeId: { courseId: id, employeeId } }, create: { courseId: id, employeeId, assignedBy: request.tenant.userId }, update: {} }))]); return { assigned: employeeIds.length }; });
  app.post("/training-assignments/:id/complete", async request => { const { id } = z.object({ id: z.uuid() }).parse(request.params); const assignment = await trainingAssignmentForUser(id, request); return prisma.$transaction(async tx => { const updated = await tx.trainingAssignment.update({ where: { id }, data: { status: "COMPLETED", completedAt: new Date(), completedBy: request.tenant.userId } }); await tx.activityEvent.create({ data: { organizationId: request.tenant.organizationId, actorUserId: request.tenant.userId, action: "training.completed", entityType: "training_course", entityId: assignment.courseId, metadata: { employeeId: assignment.employeeId } } }); return updated; }); });
  app.delete("/training-assignments/:id/completion", async request => { const { id } = z.object({ id: z.uuid() }).parse(request.params); await trainingAssignmentForUser(id, request); return prisma.trainingAssignment.update({ where: { id }, data: { status: "ASSIGNED", completedAt: null, completedBy: null } }); });
}

const policyWriteSchema = z.object({
  description: z.string().max(5000).optional(),
  ownerName: z.string().max(120).optional(),
  effectiveDate: z.iso.datetime().nullable().optional(),
  reviewDate: z.iso.datetime().nullable().optional(),
  document: z.record(z.string(), z.any()).nullable().optional(),
  customFieldValues: z.record(z.string(), z.any()).nullable().optional(),
  versionHistory: z.array(z.record(z.string(), z.any())).max(500).optional(),
  requireReacknowledgement: z.boolean().optional(),
});

function requireManager(request: FastifyRequest) { if (!managers.has(request.tenant.role)) throw Object.assign(new Error("Your role cannot manage people workflows"), { statusCode: 403 }); }
function notFound(entity: string) { return Object.assign(new Error(`${entity} not found`), { statusCode: 404 }); }
async function ownedEmployee(id: string, organizationId: string) { const record = await prisma.employee.findFirst({ where: { id, organizationId } }); if (!record) throw notFound("Employee"); return record; }
async function assertActive(organizationId: string, frameworkId: string) { const record = await prisma.organizationFramework.findUnique({ where: { organizationId_frameworkId: { organizationId, frameworkId } } }); if (!record?.active) throw Object.assign(new Error("Framework is not active"), { statusCode: 403 }); }
async function activeFrameworkNames(organizationId: string) { const records = await prisma.organizationFramework.findMany({ where: { organizationId, active: true }, include: { framework: { select: { name: true } } } }); return records.map(record => record.framework.name); }
async function assertSelectedFrameworkNames(organizationId: string, names: string[]) { const active = await activeFrameworkNames(organizationId); if (names.some(name => !active.some(selected => sameFramework(selected, name)))) throw Object.assign(new Error("Training can only be linked to selected organization frameworks"), { statusCode: 403 }); }
function sameFramework(left: string, right: string) { return normalizeFrameworkName(left) === normalizeFrameworkName(right); }
function normalizeFrameworkName(value: string) { return value.toLowerCase().replace(/type\s*ii/g, "").replace(/[^a-z0-9]/g, ""); }
async function trainingAssignmentForUser(id: string, request: FastifyRequest) {
  const assignment = await prisma.trainingAssignment.findFirst({
    where: { id, course: { organizationId: request.tenant.organizationId } },
    include: { employee: { include: { membership: true } } },
  });
  if (!assignment) throw notFound("Training assignment");
  if (!managers.has(request.tenant.role) && assignment.employee.membership?.userId !== request.tenant.userId) {
    throw Object.assign(new Error("You can only update your own assigned training"), { statusCode: 403 });
  }
  return assignment;
}
