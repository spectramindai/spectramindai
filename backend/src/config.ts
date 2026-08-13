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
});

export const config = schema.parse(process.env);
export const corsOrigins = config.CORS_ORIGINS.split(",").map((origin) => origin.trim().replace(/\/$/, "")).filter(Boolean);
