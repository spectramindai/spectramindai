import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { CMMC_FRAMEWORK_ID, getCMMCSPRSMetrics } from "../../services/cmmcSPRSService.js";
import { requireTenant } from "../../plugins/auth.js";

export async function cmmcRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireTenant);

  app.get("/cmmc/sprs", async (request) => {
    const query = z.object({
      frameworkId: z.string().min(1).default(CMMC_FRAMEWORK_ID),
    }).parse(request.query);

    return getCMMCSPRSMetrics(request.tenant.organizationId, query.frameworkId);
  });
}
