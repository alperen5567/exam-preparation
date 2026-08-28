import { NextFunction, Request, Response } from "express";
import { env } from "../config/env";

export function basicSecurityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  next();
}

export function corsMiddleware(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin ?? "";
  const configured = env.CORS_ORIGIN;
  const allowAny = configured === "*";
  const allowedOrigins = configured
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (allowAny) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  } else if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");

  if (req.method === "OPTIONS") {
    res.status(204).send();
    return;
  }

  next();
}

export function createIpRateLimitMiddleware() {
  const store = new Map<string, { count: number; resetAt: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || req.headers["x-forwarded-for"]?.toString() || "unknown";
    const now = Date.now();
    const current = store.get(key);

    if (!current || current.resetAt <= now) {
      store.set(key, { count: 1, resetAt: now + env.RATE_LIMIT_WINDOW_MS });
      next();
      return;
    }

    if (current.count >= env.RATE_LIMIT_MAX) {
      res.status(429).json({ error: { message: "Too many requests. Please try again shortly." } });
      return;
    }

    current.count += 1;
    next();
  };
}
