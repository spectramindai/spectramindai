import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { requireTenant } from "../../plugins/auth.js";
import { readFrameworkCollection } from "./library.js";

const managers = new Set(["OWNER", "ADMIN", "COMPLIANCE_MANAGER", "SECURITY_MANAGER"]);
const taskStatus = z.enum(["OPEN", "IN_PROGRESS", "COMPLETED"]);
const riskInput = z.object({
  frameworkId: z.string(), name: z.string().trim().min(2).max(255), description: z.string().max(5000).optional(),
  domain: z.string().max(150).optional(), relatedControls: z.array(z.string().max(100)).max(100).default([]),
  ownerUserId: z.uuid().nullable().optional(), ownerName: z.string().max(120).nullable().optional(),
  likelihood: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"), impact: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
  level: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(), treatmentStatus: z.enum(["OPEN", "IN_PROGRESS", "MITIGATED", "ACCEPTED"]).default("OPEN"),
  reviewDate: z.iso.datetime().nullable().optional(),
});

export async function workflowRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireTenant);

  app.get("/tasks", async (request) => {
    const query = z.object({ frameworkId: z.string(), status: taskStatus.optional() }).parse(request.query);
    return prisma.task.findMany({ where: { organizationId: request.tenant.organizationId, frameworkId: query.frameworkId, status: query.status }, orderBy: [{ status: "asc" }, { createdAt: "asc" }] });
  });

  app.post("/tasks/sync", async (request) => {
    requireManager(request);
    const { frameworkId } = z.object({ frameworkId: z.string() }).parse(request.body);
    await assertActiveFramework(request.tenant.organizationId, frameworkId);
    const templates = await readFrameworkCollection(frameworkId, "tasks.json", "taskTemplates");
    await prisma.$transaction(templates.map((template: any) => prisma.task.upsert({
      where: { organizationId_frameworkId_sourceTemplateId: { organizationId: request.tenant.organizationId, frameworkId, sourceTemplateId: template.id } },
      create: { organizationId: request.tenant.organizationId, frameworkId, sourceTemplateId: template.id, title: template.title, description: template.trigger, category: categoryFromTitle(template.title), priority: template.priority, ownerName: template.recommendedOwner, createdBy: request.tenant.userId, updatedBy: request.tenant.userId },
      update: { title: template.title, description: template.trigger, priority: template.priority },
    })));
    return { synchronized: templates.length };
  });

  app.patch("/tasks/:taskId", async (request, reply) => {
    requireManager(request);
    const { taskId } = z.object({ taskId: z.uuid() }).parse(request.params);
    const input = z.object({ status: taskStatus.optional(), ownerUserId: z.uuid().nullable().optional(), ownerName: z.string().max(120).nullable().optional(), dueDate: z.iso.datetime().nullable().optional(), version: z.number().int().positive() }).parse(request.body);
    const task = await ownedTask(taskId, request.tenant.organizationId);
    if (task.version !== input.version) return reply.code(409).send({ code: "VERSION_CONFLICT", message: "Task was updated by another user", current: task });
    const completed = input.status === "COMPLETED";
    return prisma.$transaction(async (tx) => {
      const updated = await tx.task.update({ where: { id: taskId }, data: { status: input.status, ownerUserId: input.ownerUserId, ownerName: input.ownerName, dueDate: input.dueDate ? new Date(input.dueDate) : input.dueDate, completedAt: completed ? new Date() : input.status ? null : undefined, completedBy: completed ? request.tenant.userId : input.status ? null : undefined, updatedBy: request.tenant.userId, version: { increment: 1 } } });
      await tx.activityEvent.create({ data: { organizationId: request.tenant.organizationId, actorUserId: request.tenant.userId, action: completed ? "task.completed" : "task.updated", entityType: "task", entityId: taskId, metadata: { status: input.status } } });
      return updated;
    });
  });

  app.get("/risks", async (request) => {
    const query = z.object({ frameworkId: z.string(), treatmentStatus: z.enum(["OPEN", "IN_PROGRESS", "MITIGATED", "ACCEPTED"]).optional() }).parse(request.query);
    return prisma.risk.findMany({ where: { organizationId: request.tenant.organizationId, frameworkId: query.frameworkId, treatmentStatus: query.treatmentStatus }, orderBy: [{ level: "desc" }, { createdAt: "asc" }] });
  });

  app.post("/risks/sync", async (request) => {
    requireManager(request);
    const { frameworkId } = z.object({ frameworkId: z.string() }).parse(request.body);
    await assertActiveFramework(request.tenant.organizationId, frameworkId);
    const definitions = await readFrameworkCollection(frameworkId, "risks.json", "risks");
    await prisma.$transaction(definitions.map((risk: any) => prisma.risk.upsert({
      where: { organizationId_frameworkId_sourceRiskId: { organizationId: request.tenant.organizationId, frameworkId, sourceRiskId: risk.id } },
      create: { organizationId: request.tenant.organizationId, frameworkId, sourceRiskId: risk.id, name: risk.title ?? risk.name ?? risk.id, description: risk.description, domain: risk.category ?? risk.domain, relatedControls: risk.relatedControls ?? [], likelihood: normalizeLikelihood(risk.likelihood), impact: severityImpact(risk.severity), level: normalizeLevel(risk.severity), custom: false, createdBy: request.tenant.userId, updatedBy: request.tenant.userId },
      update: { name: risk.title ?? risk.name ?? risk.id, description: risk.description, domain: risk.category ?? risk.domain, relatedControls: risk.relatedControls ?? [] },
    })));
    return { synchronized: definitions.length };
  });

  app.post("/risks", async (request, reply) => {
    requireManager(request);
    const input = riskInput.parse(request.body);
    await assertActiveFramework(request.tenant.organizationId, input.frameworkId);
    const created = await prisma.risk.create({ data: { ...input, reviewDate: input.reviewDate ? new Date(input.reviewDate) : null, level: input.level ?? calculateLevel(input.likelihood, input.impact), organizationId: request.tenant.organizationId, createdBy: request.tenant.userId, updatedBy: request.tenant.userId } });
    return reply.code(201).send(created);
  });

  app.patch("/risks/:riskId", async (request, reply) => {
    requireManager(request);
    const { riskId } = z.object({ riskId: z.uuid() }).parse(request.params);
    const input = riskInput.omit({ frameworkId: true }).partial().extend({ version: z.number().int().positive() }).parse(request.body);
    const risk = await ownedRisk(riskId, request.tenant.organizationId);
    if (risk.version !== input.version) return reply.code(409).send({ code: "VERSION_CONFLICT", message: "Risk was updated by another user", current: risk });
    const { version: _version, reviewDate, ...updates } = input;
    return prisma.$transaction(async (tx) => {
      const updated = await tx.risk.update({ where: { id: riskId }, data: { ...updates, reviewDate: reviewDate ? new Date(reviewDate) : reviewDate, updatedBy: request.tenant.userId, version: { increment: 1 } } });
      await tx.activityEvent.create({ data: { organizationId: request.tenant.organizationId, actorUserId: request.tenant.userId, action: updated.treatmentStatus === "MITIGATED" ? "risk.mitigated" : "risk.updated", entityType: "risk", entityId: riskId, metadata: { treatmentStatus: updated.treatmentStatus } } });
      return updated;
    });
  });
}

function requireManager(request: FastifyRequest) {
  if (!managers.has(request.tenant.role)) throw Object.assign(new Error("Your role cannot manage this workflow"), { statusCode: 403 });
}
async function assertActiveFramework(organizationId: string, frameworkId: string) {
  const record = await prisma.organizationFramework.findUnique({ where: { organizationId_frameworkId: { organizationId, frameworkId } } });
  if (!record?.active) throw Object.assign(new Error("Framework is not active for this organization"), { statusCode: 403 });
}
async function ownedTask(id: string, organizationId: string) { const record = await prisma.task.findFirst({ where: { id, organizationId } }); if (!record) throw Object.assign(new Error("Task not found"), { statusCode: 404 }); return record; }
async function ownedRisk(id: string, organizationId: string) { const record = await prisma.risk.findFirst({ where: { id, organizationId } }); if (!record) throw Object.assign(new Error("Risk not found"), { statusCode: 404 }); return record; }
function categoryFromTitle(title = "") { if (/evidence|upload/i.test(title)) return "Evidence"; if (/risk/i.test(title)) return "Risk"; if (/audit|review/i.test(title)) return "Audit"; return "Implementation"; }
function normalizeLikelihood(value: string) { return value?.toUpperCase() === "HIGH" ? "HIGH" : value?.toUpperCase() === "LOW" ? "LOW" : "MEDIUM"; }
function normalizeLevel(value: string) { const normalized = value?.toUpperCase(); return ["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(normalized) ? normalized as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" : "MEDIUM"; }
function severityImpact(value: string) { return ["Critical", "High"].includes(value) ? "HIGH" : value === "Low" ? "LOW" : "MEDIUM"; }
function calculateLevel(likelihood: string, impact: string) { const score = (likelihood === "HIGH" ? 3 : likelihood === "MEDIUM" ? 2 : 1) * (impact === "HIGH" ? 3 : impact === "MEDIUM" ? 2 : 1); return score >= 9 ? "CRITICAL" : score >= 6 ? "HIGH" : score >= 3 ? "MEDIUM" : "LOW"; }
