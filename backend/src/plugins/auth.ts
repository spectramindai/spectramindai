import type { FastifyInstance, FastifyRequest } from "fastify";
import { prisma } from "../lib/prisma.js";

export async function registerAuth(app: FastifyInstance) {
  app.decorateRequest("tenant");

  app.decorate("authenticate", async function authenticate(request: FastifyRequest) {
    await request.jwtVerify();
  });
}

export async function requireTenant(request: FastifyRequest) {
  await request.jwtVerify();
  const requestedOrganizationId = request.headers["x-organization-id"];

  if (typeof requestedOrganizationId !== "string") {
    throw Object.assign(new Error("x-organization-id header is required"), { statusCode: 400 });
  }

  const membership = await prisma.organizationMembership.findUnique({
    where: {
      organizationId_userId: {
        organizationId: requestedOrganizationId,
        userId: request.user.sub,
      },
    },
  });

  if (!membership) {
    throw Object.assign(new Error("Your access to this organization has been removed"), {
      statusCode: 403,
      code: "TENANT_ACCESS_REVOKED",
    });
  }

  request.tenant = {
    organizationId: membership.organizationId,
    userId: membership.userId,
    role: membership.role,
  };
}
