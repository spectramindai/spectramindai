import "@fastify/jwt";
import type { MembershipRole } from "@prisma/client";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string; email: string };
    user: { sub: string; email: string };
  }
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate(request: FastifyRequest): Promise<void>;
  }
  interface FastifyRequest {
    tenant: {
      organizationId: string;
      userId: string;
      role: MembershipRole;
    };
  }
}
