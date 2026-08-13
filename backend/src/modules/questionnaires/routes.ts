import type { Prisma } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { config } from "../../config.js";
import { prisma } from "../../lib/prisma.js";
import { requireTenant } from "../../plugins/auth.js";

const folderByFramework: Record<string, string> = {
  "soc2-type-ii": "soc2", "iso27001-2022": "iso27001", "cmmc-level-2": "cmmc",
};

export async function questionnaireRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireTenant);

  app.get("/questionnaires/:frameworkId", async (request, reply) => {
    const { frameworkId } = z.object({ frameworkId: z.string() }).parse(request.params);
    await assertActiveFramework(request.tenant.organizationId, frameworkId);
    const folder = folderByFramework[frameworkId];
    if (!folder) return reply.code(404).send({ code: "QUESTIONNAIRE_NOT_FOUND", message: "Questionnaire not found" });
    const definition = JSON.parse(await readFile(resolve(process.cwd(), config.FRAMEWORK_LIBRARY_PATH, folder, "questionnaire.json"), "utf8"));
    const run = await prisma.questionnaireRun.findFirst({
      where: { organizationId: request.tenant.organizationId, frameworkId },
      include: { answers: true }, orderBy: { createdAt: "desc" },
    });
    return { definition, run };
  });

  app.post("/questionnaire-runs", async (request, reply) => {
    const { frameworkId } = z.object({ frameworkId: z.string() }).parse(request.body);
    await assertActiveFramework(request.tenant.organizationId, frameworkId);
    const existing = await prisma.questionnaireRun.findFirst({ where: { organizationId: request.tenant.organizationId, frameworkId, status: "DRAFT" } });
    if (existing) return existing;
    const run = await prisma.questionnaireRun.create({ data: { organizationId: request.tenant.organizationId, frameworkId } });
    return reply.code(201).send(run);
  });

  app.put("/questionnaire-runs/:runId/answers/:questionId", async (request) => {
    const { runId, questionId } = z.object({ runId: z.uuid(), questionId: z.string().min(1) }).parse(request.params);
    const { value } = z.object({ value: z.any() }).parse(request.body);
    if (value === undefined) throw Object.assign(new Error("Questionnaire answer value is required"), { statusCode: 400 });
    const run = await ownedRun(runId, request.tenant.organizationId);
    if (run.status !== "DRAFT") throw Object.assign(new Error("Submitted questionnaires cannot be edited"), { statusCode: 409 });
    return prisma.questionnaireAnswer.upsert({
      where: { runId_questionId: { runId, questionId } },
      create: { runId, questionId, value: value as Prisma.InputJsonValue, answeredBy: request.tenant.userId },
      update: { value: value as Prisma.InputJsonValue, answeredBy: request.tenant.userId },
    });
  });

  app.post("/questionnaire-runs/:runId/submit", async (request) => {
    const { runId } = z.object({ runId: z.uuid() }).parse(request.params);
    await ownedRun(runId, request.tenant.organizationId);
    return prisma.$transaction(async (tx) => {
      const run = await tx.questionnaireRun.update({ where: { id: runId }, data: { status: "SUBMITTED", submittedAt: new Date(), submittedBy: request.tenant.userId, version: { increment: 1 } }, include: { answers: true } });
      await tx.activityEvent.create({ data: { organizationId: request.tenant.organizationId, actorUserId: request.tenant.userId, action: "questionnaire.submitted", entityType: "questionnaire_run", entityId: runId } });
      return run;
    });
  });
}

async function assertActiveFramework(organizationId: string, frameworkId: string) {
  const active = await prisma.organizationFramework.findUnique({ where: { organizationId_frameworkId: { organizationId, frameworkId } } });
  if (!active?.active) throw Object.assign(new Error("Framework is not active for this organization"), { statusCode: 403 });
}

async function ownedRun(id: string, organizationId: string) {
  const run = await prisma.questionnaireRun.findFirst({ where: { id, organizationId } });
  if (!run) throw Object.assign(new Error("Questionnaire run not found"), { statusCode: 404 });
  return run;
}
