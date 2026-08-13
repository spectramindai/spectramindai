import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { requireTenant } from "../../plugins/auth.js";
import { validateCMMCImplementedEvidence } from "../../services/cmmcEvidenceValidationService.js";

const activateSchema = z.object({ frameworkId: z.string().min(1) });
const checkoutSchema = z.object({ frameworkIds: z.array(z.string().min(1)).min(1).max(20).transform(values => [...new Set(values)]) });
const updateSchema = z.object({
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "IMPLEMENTED", "NOT_APPLICABLE"]),
  notes: z.string().max(5000).nullable().optional(),
  ownerUserId: z.uuid().nullable().optional(),
  targetDate: z.iso.datetime().nullable().optional(),
  version: z.number().int().positive().optional(),
});

export async function frameworkRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireTenant);

  app.get("/frameworks", async () => prisma.framework.findMany({ orderBy: { name: "asc" } }));

  app.get("/organization-frameworks", async (request) => {
    return prisma.organizationFramework.findMany({
      where: { organizationId: request.tenant.organizationId },
      include: { framework: true },
      orderBy: { createdAt: "asc" },
    });
  });

  app.post("/organization-frameworks", async (request, reply) => {
    requireWorkspaceManager(request);
    const { frameworkId } = activateSchema.parse(request.body);
    const framework = await prisma.framework.findUnique({ where: { id: frameworkId } });
    if (!framework) return reply.code(404).send({ code: "FRAMEWORK_NOT_FOUND", message: "Framework not found" });

    const record = await prisma.$transaction(async (tx) => {
      const activated = await tx.organizationFramework.upsert({
        where: { organizationId_frameworkId: { organizationId: request.tenant.organizationId, frameworkId } },
        create: { organizationId: request.tenant.organizationId, frameworkId },
        update: { active: true },
        include: { framework: true },
      });
      await tx.activityEvent.create({
        data: { organizationId: request.tenant.organizationId, actorUserId: request.tenant.userId, action: "framework.activated", entityType: "framework", entityId: frameworkId },
      });
      return activated;
    });
    return reply.code(201).send(record);
  });

  app.post("/organization-frameworks/checkout", async (request, reply) => {
    requireWorkspaceManager(request);
    const { frameworkIds } = checkoutSchema.parse(request.body);
    const frameworkCount = await prisma.framework.count({ where: { id: { in: frameworkIds } } });
    if (frameworkCount !== frameworkIds.length) return reply.code(404).send({ code: "FRAMEWORK_NOT_FOUND", message: "One or more frameworks were not found" });

    const records = await prisma.$transaction(async tx => {
      const activated = [];
      for (const frameworkId of frameworkIds) {
        activated.push(await tx.organizationFramework.upsert({
          where: { organizationId_frameworkId: { organizationId: request.tenant.organizationId, frameworkId } },
          create: { organizationId: request.tenant.organizationId, frameworkId },
          update: { active: true },
          include: { framework: true },
        }));
        await tx.activityEvent.create({
          data: { organizationId: request.tenant.organizationId, actorUserId: request.tenant.userId, action: "framework.checkout.activated", entityType: "framework", entityId: frameworkId },
        });
      }
      return activated;
    });
    return reply.code(201).send(records);
  });

  app.get("/controls", async (request) => {
    const query = z.object({ frameworkId: z.string(), status: z.enum(["NOT_STARTED", "IN_PROGRESS", "IMPLEMENTED", "NOT_APPLICABLE"]).optional() }).parse(request.query);
    const active = await prisma.organizationFramework.findUnique({ where: { organizationId_frameworkId: { organizationId: request.tenant.organizationId, frameworkId: query.frameworkId } } });
    if (!active?.active) throw Object.assign(new Error("Framework is not active for this organization"), { statusCode: 403 });

    return prisma.control.findMany({
      where: { frameworkId: query.frameworkId, implementations: query.status ? { some: { organizationId: request.tenant.organizationId, status: query.status } } : undefined },
      include: { implementations: { where: { organizationId: request.tenant.organizationId } } },
      orderBy: { externalId: "asc" },
    });
  });

  app.patch("/controls/:controlId/implementation", async (request, reply) => {
    const { controlId } = z.object({ controlId: z.uuid() }).parse(request.params);
    const input = updateSchema.parse(request.body);
    const control = await prisma.control.findUnique({ where: { id: controlId } });
    if (!control) return reply.code(404).send({ code: "CONTROL_NOT_FOUND", message: "Control not found" });

    const active = await prisma.organizationFramework.findUnique({ where: { organizationId_frameworkId: { organizationId: request.tenant.organizationId, frameworkId: control.frameworkId } } });
    if (!active?.active) return reply.code(403).send({ code: "FRAMEWORK_NOT_ACTIVE", message: "Framework is not active" });

    const current = await prisma.controlImplementation.findUnique({ where: { organizationId_controlId: { organizationId: request.tenant.organizationId, controlId } } });
    if (current && input.version && current.version !== input.version) return reply.code(409).send({ code: "VERSION_CONFLICT", message: "Control was updated by another user", current });
    const evidenceValidation = await validateCMMCImplementedEvidence(prisma, {
      organizationId: request.tenant.organizationId,
      frameworkId: control.frameworkId,
      controlDbId: control.id,
      status: input.status,
    });
    if (evidenceValidation.validationFailed) {
      return reply.code(422).send(evidenceValidation);
    }

    return prisma.$transaction(async (tx) => {
      const implementation = await tx.controlImplementation.upsert({
        where: { organizationId_controlId: { organizationId: request.tenant.organizationId, controlId } },
        create: { organizationId: request.tenant.organizationId, controlId, status: input.status, notes: input.notes, ownerUserId: input.ownerUserId, targetDate: input.targetDate ? new Date(input.targetDate) : null, createdBy: request.tenant.userId, updatedBy: request.tenant.userId },
        update: { status: input.status, notes: input.notes, ownerUserId: input.ownerUserId, targetDate: input.targetDate ? new Date(input.targetDate) : input.targetDate, updatedBy: request.tenant.userId, version: { increment: 1 } },
      });
      await tx.activityEvent.create({ data: { organizationId: request.tenant.organizationId, actorUserId: request.tenant.userId, action: "control.implementation.updated", entityType: "control", entityId: controlId, metadata: { status: input.status } } });
      return implementation;
    });
  });

  app.get("/dashboard", async (request) => {
    const query = z.object({ frameworkId: z.string().optional() }).parse(request.query);
    const activated = await prisma.organizationFramework.findMany({ where: { organizationId: request.tenant.organizationId, active: true, frameworkId: query.frameworkId }, include: { framework: { select: { name: true, slug: true } } }, orderBy: { createdAt: "asc" } });
    const frameworkIds = activated.map((item) => item.frameworkId);
    const [totalControls, implementations, recentActivity, evidenceTotal, approvedEvidenceControls, policiesTotal, policiesPublished, openRisks, highRisks, openTasks, auditFindings, employeesTotal, trainingAssigned, trainingCompleted] = await Promise.all([
      prisma.control.count({ where: { frameworkId: { in: frameworkIds } } }),
      prisma.controlImplementation.groupBy({ by: ["status"], where: { organizationId: request.tenant.organizationId, control: { frameworkId: { in: frameworkIds } } }, _count: true }),
      prisma.activityEvent.findMany({
        where: {
          organizationId: request.tenant.organizationId,
          OR: query.frameworkId
            ? [
                { entityId: query.frameworkId },
                { metadata: { path: ["frameworkId"], equals: query.frameworkId } },
              ]
            : undefined,
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.evidenceRecord.count({ where: { organizationId: request.tenant.organizationId, frameworkId: { in: frameworkIds }, deletedAt: null } }),
      prisma.evidenceMapping.findMany({
        where: { evidence: { organizationId: request.tenant.organizationId, frameworkId: { in: frameworkIds }, status: "APPROVED", deletedAt: null } },
        distinct: ["controlId"],
        select: { controlId: true },
      }),
      prisma.policy.count({ where: { organizationId: request.tenant.organizationId, frameworkId: { in: frameworkIds } } }),
      prisma.policy.count({ where: { organizationId: request.tenant.organizationId, frameworkId: { in: frameworkIds }, status: "ACTIVE" } }),
      prisma.risk.count({ where: { organizationId: request.tenant.organizationId, frameworkId: { in: frameworkIds }, treatmentStatus: { in: ["OPEN", "IN_PROGRESS"] } } }),
      prisma.risk.count({ where: { organizationId: request.tenant.organizationId, frameworkId: { in: frameworkIds }, level: { in: ["HIGH", "CRITICAL"] }, treatmentStatus: { in: ["OPEN", "IN_PROGRESS"] } } }),
      prisma.task.count({ where: { organizationId: request.tenant.organizationId, frameworkId: { in: frameworkIds }, status: { not: "COMPLETED" } } }),
      prisma.auditFinding.count({ where: { audit: { organizationId: request.tenant.organizationId, frameworkId: { in: frameworkIds } }, status: "OPEN" } }),
      prisma.employee.count({ where: { organizationId: request.tenant.organizationId } }),
      prisma.trainingAssignment.count({ where: { course: { organizationId: request.tenant.organizationId } } }),
      prisma.trainingAssignment.count({ where: { course: { organizationId: request.tenant.organizationId }, status: "COMPLETED" } }),
    ]);
    const implemented = implementations.find((row) => row.status === "IMPLEMENTED")?._count ?? 0;
    const frameworkProgress = await Promise.all(activated.map(async item => {
      const [controls, implementedControls, approvedControlEvidence, totalPolicies, publishedPolicies] = await Promise.all([
        prisma.control.count({ where: { frameworkId: item.frameworkId } }),
        prisma.controlImplementation.count({ where: { organizationId: request.tenant.organizationId, status: "IMPLEMENTED", control: { frameworkId: item.frameworkId } } }),
        prisma.evidenceMapping.findMany({
          where: { evidence: { organizationId: request.tenant.organizationId, frameworkId: item.frameworkId, status: "APPROVED", deletedAt: null } },
          distinct: ["controlId"],
          select: { controlId: true },
        }),
        prisma.policy.count({ where: { organizationId: request.tenant.organizationId, frameworkId: item.frameworkId } }),
        prisma.policy.count({ where: { organizationId: request.tenant.organizationId, frameworkId: item.frameworkId, status: "ACTIVE" } }),
      ]);
      const scoreTotal = controls * 2 + totalPolicies;
      const scoreCompleted = implementedControls + approvedControlEvidence.length + publishedPolicies;
      return { id: item.frameworkId, name: item.framework.name, slug: item.framework.slug, totalControls: controls, implementedControls, approvedEvidenceControls: approvedControlEvidence.length, totalPolicies, publishedPolicies, progressPercent: scoreTotal ? Math.round(scoreCompleted / scoreTotal * 100) : 0 };
    }));
    const scoreTotal = totalControls * 2 + policiesTotal;
    const scoreCompleted = implemented + approvedEvidenceControls.length + policiesPublished;
    return { totalControls, implementedControls: implemented, approvedEvidenceControls: approvedEvidenceControls.length, progressPercent: scoreTotal ? Math.round(scoreCompleted / scoreTotal * 100) : 0, frameworkProgress, byStatus: implementations, recentActivity, evidenceTotal, policiesTotal, policiesPublished, openRisks, highRisks, openTasks, auditFindings, employeesTotal, trainingAssigned, trainingCompleted, trainingCompletionPercent: trainingAssigned ? Math.round(trainingCompleted / trainingAssigned * 100) : 0 };
  });
}

function requireWorkspaceManager(request: FastifyRequest) {
  if (!["OWNER", "ADMIN", "COMPLIANCE_MANAGER", "SECURITY_MANAGER", "HR_MANAGER"].includes(request.tenant.role)) {
    throw Object.assign(new Error("Only an Admin or Manager can select frameworks"), { statusCode: 403 });
  }
}
