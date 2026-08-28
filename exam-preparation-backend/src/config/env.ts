import dotenv from "dotenv";

dotenv.config();

const required = (name: string, fallback?: string) => {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
};

const numberWithFallback = (name: string, fallback: number) => {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: parseInt(process.env.PORT ?? "4000", 10),
  DATABASE_URL: required("DATABASE_URL"),
  JWT_SECRET: required("JWT_SECRET"),
  UPLOAD_DIR: required("UPLOAD_DIR", "./uploads"),
  UPLOAD_MAX_BYTES: numberWithFallback("UPLOAD_MAX_BYTES", 100 * 1024 * 1024),
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? "*",
  RATE_LIMIT_WINDOW_MS: numberWithFallback("RATE_LIMIT_WINDOW_MS", 60 * 1000),
  RATE_LIMIT_MAX: numberWithFallback("RATE_LIMIT_MAX", 60),
  GEMINI_API_KEY: process.env.GEMINI_API_KEY ?? "",
};
