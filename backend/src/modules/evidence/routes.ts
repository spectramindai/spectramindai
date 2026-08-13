import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { config } from "../../config.js";
import { createHash } from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import { requireTenant } from "../../plugins/auth.js";

const createSchema = z.object({
  frameworkId: z.string(), title: z.string().min(1).max(255), description: z.string().max(5000).optional(),
  fileName: z.string().min(1).max(255), contentType: z.string().min(1).max(150), fileSize: z.number().int().positive().max(100 * 1024 * 1024),
  checksum: z.string().max(200).optional(), controlIds: z.array(z.string().min(1).max(100)).max(100).default([]), tags: z.array(z.string().max(50)).max(20).default([]),
  testId: z.string().max(150).optional(), implementationId: z.string().max(150).optional(),
});

export async function evidenceRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireTenant);

  app.get("/evidence", async (request) => {
    const query = z.object({ frameworkId: z.string().optional(), status: z.enum(["PENDING_UPLOAD", "PROCESSING", "PENDING_REVIEW", "APPROVED", "REJECTED", "EXPIRED"]).optional() }).parse(request.query);
    return prisma.evidenceRecord.findMany({
      where: { organizationId: request.tenant.organizationId, frameworkId: query.frameworkId, status: query.status, deletedAt: null },
      include: { versions: { orderBy: { version: "desc" } }, mappings: { include: { control: true } }, comments: { orderBy: { createdAt: "asc" } } },
      orderBy: { updatedAt: "desc" }, take: 100,
    });
  });

  app.post("/evidence/upload-intents", async (request, reply) => {
    const input = createSchema.parse(request.body);
    const active = await prisma.organizationFramework.findUnique({ where: { organizationId_frameworkId: { organizationId: request.tenant.organizationId, frameworkId: input.frameworkId } } });
    if (!active?.active) return reply.code(403).send({ code: "FRAMEWORK_NOT_ACTIVE", message: "Framework is not active" });
    const uuidControlIds = input.controlIds.filter((id) => /^[0-9a-f-]{36}$/i.test(id));
    const controls = await prisma.control.findMany({ where: { frameworkId: input.frameworkId, OR: [{ externalId: { in: input.controlIds } }, ...(uuidControlIds.length ? [{ id: { in: uuidControlIds } }] : [])] }, select: { id: true, externalId: true } });
    if (controls.length !== new Set(input.controlIds).size) return reply.code(400).send({ code: "INVALID_CONTROL_MAPPING", message: "One or more controls are invalid" });

    const result = await prisma.$transaction(async (tx) => {
      const evidence = await tx.evidenceRecord.create({ data: { organizationId: request.tenant.organizationId, frameworkId: input.frameworkId, title: input.title, description: input.description, testId: input.testId, implementationId: input.implementationId, tags: input.tags, createdBy: request.tenant.userId, updatedBy: request.tenant.userId } });
      const versionId = crypto.randomUUID();
      const objectKey = `organizations/${request.tenant.organizationId}/evidence/${evidence.id}/versions/${versionId}`;
      const version = await tx.evidenceVersion.create({ data: { id: versionId, evidenceId: evidence.id, version: 1, fileName: input.fileName, contentType: input.contentType, fileSize: input.fileSize, checksum: input.checksum, objectKey, uploadedBy: request.tenant.userId } });
      if (controls.length) await tx.evidenceMapping.createMany({ data: controls.map((control) => ({ evidenceId: evidence.id, controlId: control.id })) });
      await tx.evidenceRecord.update({ where: { id: evidence.id }, data: { currentVersionId: version.id } });
      await tx.activityEvent.create({ data: { organizationId: request.tenant.organizationId, actorUserId: request.tenant.userId, action: "evidence.upload.requested", entityType: "evidence", entityId: evidence.id, metadata: { fileName: input.fileName } } });
      return { evidence, version };
    });
    // Local adapter URL. The future S3 adapter will return a short-lived presigned URL.
    return reply.code(201).send({ ...result, upload: { method: "PUT", url: `/api/v1/evidence/${result.evidence.id}/versions/${result.version.id}/content`, expiresInSeconds: 900 } });
  });

  app.post("/evidence/:evidenceId/versions/:versionId/complete", async (request) => {
    const { evidenceId, versionId } = z.object({ evidenceId: z.uuid(), versionId: z.uuid() }).parse(request.params);
    const evidence = await prisma.evidenceRecord.findFirst({ where: { id: evidenceId, organizationId: request.tenant.organizationId, deletedAt: null } });
    if (!evidence) throw Object.assign(new Error("Evidence not found"), { statusCode: 404 });
    const version = await ownedVersion(evidenceId, versionId, request.tenant.organizationId);
    const uploadedFile = await stat(localObjectPath(version.objectKey)).catch(() => null);
    if (!uploadedFile || uploadedFile.size !== version.fileSize) throw Object.assign(new Error("Evidence file upload is incomplete"), { statusCode: 409 });
    if (version.checksum) {
      const content = await readFile(localObjectPath(version.objectKey));
      const actualChecksum = createHash("sha256").update(content).digest("hex");
      if (actualChecksum !== version.checksum) throw Object.assign(new Error("Evidence checksum verification failed"), { statusCode: 409 });
    }
    return prisma.$transaction(async (tx) => {
      await tx.evidenceVersion.update({ where: { id: versionId }, data: { uploadedAt: new Date() } });
      const updated = await tx.evidenceRecord.update({ where: { id: evidenceId }, data: { status: "PENDING_REVIEW", updatedBy: request.tenant.userId } });
      await tx.activityEvent.create({ data: { organizationId: request.tenant.organizationId, actorUserId: request.tenant.userId, action: "evidence.upload.completed", entityType: "evidence", entityId: evidenceId, metadata: { versionId } } });
      return updated;
    });
  });

  app.put("/evidence/:evidenceId/versions/:versionId/content", {
    config: { rawBody: true },
    bodyLimit: 100 * 1024 * 1024,
  }, async (request, reply) => {
    const { evidenceId, versionId } = z.object({ evidenceId: z.uuid(), versionId: z.uuid() }).parse(request.params);
    const version = await ownedVersion(evidenceId, versionId, request.tenant.organizationId);
    if (!Buffer.isBuffer(request.body)) return reply.code(415).send({ code: "BINARY_BODY_REQUIRED", message: "Upload must use application/octet-stream" });
    if (request.body.length !== version.fileSize) return reply.code(400).send({ code: "FILE_SIZE_MISMATCH", message: "Uploaded file size does not match the upload intent" });
    const path = localObjectPath(version.objectKey);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, request.body, { flag: "wx" }).catch((error) => {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    });
    return reply.code(204).send();
  });

  app.get("/evidence/:evidenceId/download", async (request, reply) => {
    const { evidenceId } = z.object({ evidenceId: z.uuid() }).parse(request.params);
    const evidence = await prisma.evidenceRecord.findFirst({ where: { id: evidenceId, organizationId: request.tenant.organizationId, deletedAt: null } });
    if (!evidence?.currentVersionId) return reply.code(404).send({ code: "EVIDENCE_NOT_FOUND", message: "Evidence file not found" });
    const version = await ownedVersion(evidenceId, evidence.currentVersionId, request.tenant.organizationId);
    const content = await readFile(localObjectPath(version.objectKey)).catch(() => null);
    if (!content) return reply.code(404).send({ code: "FILE_NOT_FOUND", message: "Evidence file is not available" });
    reply.header("content-disposition", `attachment; filename*=UTF-8''${encodeURIComponent(version.fileName)}`);
    return reply.type(version.contentType).send(content);
  });

  app.post("/evidence/:evidenceId/review", async request => { const { evidenceId } = z.object({ evidenceId: z.uuid() }).parse(request.params); const input = z.object({ decision: z.enum(["APPROVED", "REJECTED"]), reason: z.string().max(5000).default("") }).parse(request.body); await ownedEvidence(evidenceId, request.tenant.organizationId); return prisma.$transaction(async tx => { const record = await tx.evidenceRecord.update({ where: { id: evidenceId }, data: { status: input.decision, reviewerId: request.tenant.userId, reviewReason: input.reason, reviewedAt: new Date(), updatedBy: request.tenant.userId } }); await tx.activityEvent.create({ data: { organizationId: request.tenant.organizationId, actorUserId: request.tenant.userId, action: `evidence.${input.decision.toLowerCase()}`, entityType: "evidence", entityId: evidenceId } }); return record; }); });
  app.post("/evidence/:evidenceId/comments", async (request, reply) => { const { evidenceId } = z.object({ evidenceId: z.uuid() }).parse(request.params); const { text } = z.object({ text: z.string().trim().min(1).max(5000) }).parse(request.body); await ownedEvidence(evidenceId, request.tenant.organizationId); const comment = await prisma.evidenceComment.create({ data: { evidenceId, text, userId: request.tenant.userId, userName: request.user.email } }); return reply.code(201).send(comment); });
  app.post("/evidence/:evidenceId/versions/upload-intent", async request => { const { evidenceId } = z.object({ evidenceId: z.uuid() }).parse(request.params); const input = z.object({ fileName: z.string().min(1).max(255), contentType: z.string().max(150), fileSize: z.number().int().positive().max(100 * 1024 * 1024) }).parse(request.body); await ownedEvidence(evidenceId, request.tenant.organizationId); const count = await prisma.evidenceVersion.count({ where: { evidenceId } }); const versionId = crypto.randomUUID(); const objectKey = `organizations/${request.tenant.organizationId}/evidence/${evidenceId}/versions/${versionId}`; const version = await prisma.evidenceVersion.create({ data: { id: versionId, evidenceId, version: count + 1, fileName: input.fileName, contentType: input.contentType, fileSize: input.fileSize, objectKey, uploadedBy: request.tenant.userId } }); await prisma.evidenceRecord.update({ where: { id: evidenceId }, data: { currentVersionId: versionId, status: "PENDING_UPLOAD", updatedBy: request.tenant.userId } }); return { version, upload: { method: "PUT", url: `/api/v1/evidence/${evidenceId}/versions/${versionId}/content` } }; });
  app.post("/evidence/:evidenceId/versions/:versionId/restore", async request => { const { evidenceId, versionId } = z.object({ evidenceId: z.uuid(), versionId: z.uuid() }).parse(request.params); await ownedVersion(evidenceId, versionId, request.tenant.organizationId); return prisma.evidenceRecord.update({ where: { id: evidenceId }, data: { currentVersionId: versionId, status: "PENDING_REVIEW", updatedBy: request.tenant.userId } }); });
  app.delete("/evidence/:evidenceId", async (request, reply) => { requireEvidenceDeletionAccess(request.tenant.role); const { evidenceId } = z.object({ evidenceId: z.uuid() }).parse(request.params); await ownedEvidence(evidenceId, request.tenant.organizationId); await prisma.evidenceRecord.update({ where: { id: evidenceId }, data: { deletedAt: new Date(), updatedBy: request.tenant.userId } }); return reply.code(204).send(); });
}

function requireEvidenceDeletionAccess(role: string) {
  if (!["OWNER", "ADMIN", "COMPLIANCE_MANAGER", "SECURITY_MANAGER", "HR_MANAGER"].includes(role)) {
    throw Object.assign(new Error("Only an Admin or Manager can delete evidence"), { statusCode: 403 });
  }
}

async function ownedEvidence(id: string, organizationId: string) { const record = await prisma.evidenceRecord.findFirst({ where: { id, organizationId, deletedAt: null } }); if (!record) throw Object.assign(new Error("Evidence not found"), { statusCode: 404 }); return record; }

async function ownedVersion(evidenceId: string, versionId: string, organizationId: string) {
  const version = await prisma.evidenceVersion.findFirst({ where: { id: versionId, evidenceId, evidence: { organizationId, deletedAt: null } } });
  if (!version) throw Object.assign(new Error("Evidence version not found"), { statusCode: 404 });
  return version;
}

function localObjectPath(objectKey: string) {
  return resolve(process.cwd(), config.LOCAL_FILE_ROOT, objectKey);
}
