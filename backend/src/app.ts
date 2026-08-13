import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify from "fastify";
import { ZodError } from "zod";
import { config, corsOrigins } from "./config.js";
import { prisma } from "./lib/prisma.js";
import { authRoutes } from "./modules/auth/routes.js";
import { frameworkRoutes } from "./modules/frameworks/routes.js";
import { questionnaireRoutes } from "./modules/questionnaires/routes.js";
import { evidenceRoutes } from "./modules/evidence/routes.js";
import { workflowRoutes } from "./modules/workflows/routes.js";
import { peopleRoutes } from "./modules/people/routes.js";
import { assuranceRoutes } from "./modules/assurance/routes.js";
import { cmmcRoutes } from "./modules/cmmc/routes.js";
import { workspaceRoutes } from "./modules/workspace/routes.js";
import { organizationRoutes } from "./modules/organizations/routes.js";
import { trustRoutes } from "./modules/trust/routes.js";
import { registerAuth } from "./plugins/auth.js";

export async function buildApp() {
  const app = Fastify({ logger: { level: config.NODE_ENV === "test" ? "silent" : "info" }, requestIdHeader: "x-request-id", trustProxy: config.TRUST_PROXY });
  app.addContentTypeParser("application/octet-stream", { parseAs: "buffer", bodyLimit: 100 * 1024 * 1024 }, (_request, body, done) => done(null, body));

  await app.register(helmet);
  await app.register(cors, {
    origin: corsOrigins,
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });
  await app.register(jwt, { secret: config.JWT_SECRET, sign: { expiresIn: config.JWT_EXPIRES_IN as any } });
  await app.register(swagger, { openapi: { info: { title: "SpectraMind API", version: "0.1.0" }, servers: [{ url: "/api/v1" }] } });
  await app.register(swaggerUi, { routePrefix: "/api/docs" });
  await registerAuth(app);

  app.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));
  app.get("/ready", async (_request, reply) => {
    try { await prisma.$queryRaw`SELECT 1`; return { status: "ready" }; }
    catch { return reply.code(503).send({ status: "not_ready" }); }
  });

  await app.register(authRoutes, { prefix: "/api/v1/auth" });
  await app.register(organizationRoutes, { prefix: "/api/v1" });
  await app.register(frameworkRoutes, { prefix: "/api/v1" });
  await app.register(questionnaireRoutes, { prefix: "/api/v1" });
  await app.register(evidenceRoutes, { prefix: "/api/v1" });
  await app.register(workflowRoutes, { prefix: "/api/v1" });
  await app.register(peopleRoutes, { prefix: "/api/v1" });
  await app.register(assuranceRoutes, { prefix: "/api/v1" });
  await app.register(cmmcRoutes, { prefix: "/api/v1" });
  await app.register(workspaceRoutes, { prefix: "/api/v1" });
  await app.register(trustRoutes, { prefix: "/api/v1" });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({ code: "VALIDATION_ERROR", message: "Request validation failed", details: error.issues, requestId: request.id });
    }
    const normalizedError = error instanceof Error ? error : new Error("Unknown error");
    const statusCode = "statusCode" in normalizedError && typeof normalizedError.statusCode === "number" ? normalizedError.statusCode : 500;
    if (statusCode >= 500) request.log.error(error);
    const suppliedCode = "code" in normalizedError && typeof normalizedError.code === "string" ? normalizedError.code : null;
    return reply.code(statusCode).send({ code: suppliedCode ?? (statusCode >= 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR"), message: statusCode >= 500 ? "An unexpected error occurred" : normalizedError.message, requestId: request.id });
  });

  app.addHook("onClose", async () => prisma.$disconnect());
  return app;
}
