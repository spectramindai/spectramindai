import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default("0.0.0.0"),
  TRUST_PROXY: z.string().default("false").transform(value => value.toLowerCase() === "true"),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default("15m"),
  CORS_ORIGINS: z.string().default("http://localhost:5173"),
  FRAMEWORK_LIBRARY_PATH: z.string().default("../spectramind/src/core/framework-library"),
  LOCAL_FILE_ROOT: z.string().default("./data/files"),
  AZURE_STORAGE_ACCOUNT_NAME: z.string().min(3).max(24).optional(),
  AZURE_STORAGE_CONTAINER_NAME: z.string().min(3).default("cmmc-evidence"),
  CMMC_ONLY_MODE: z.string().default("true").transform(value => value.toLowerCase() === "true"),
  ALL_FRAMEWORK_ACCESS_EMAILS: z.string().default("vijay@spectramindsolutions.com"),
});

export const config = schema.parse(process.env);
export const corsOrigins = config.CORS_ORIGINS.split(",").map((origin) => origin.trim().replace(/\/$/, "")).filter(Boolean);
export const allFrameworkAccessEmails = new Set(
  config.ALL_FRAMEWORK_ACCESS_EMAILS.split(",").map((email) => email.trim().toLowerCase()).filter(Boolean),
);

export function hasAllFrameworkAccess(email?: string) {
  return allFrameworkAccessEmails.has(String(email || "").trim().toLowerCase());
}

export function isAllowedCorsOrigin(origin?: string) {
  if (!origin) return true;
  const normalizedOrigin = origin.replace(/\/$/, "");
  if (corsOrigins.includes(normalizedOrigin)) return true;
  if (config.NODE_ENV !== "production") {
    try {
      const url = new URL(normalizedOrigin);
      return url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
    } catch {
      return false;
    }
  }
  return false;
}
