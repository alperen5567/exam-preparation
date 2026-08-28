import { NextFunction, Request, Response } from "express";
import { UnauthorizedError } from "../utils/httpErrors";
import { verifyToken } from "../utils/jwt";
import type { AuthUser } from "../modules/auth/auth.middleware";

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers["authorization"];
  if (!header) throw new UnauthorizedError("Missing Authorization header");

  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) throw new UnauthorizedError("Invalid Authorization header");

  try {
    const payload = verifyToken(token);
    req.user = {
      id: payload.sub,
      role: payload.role,
      email: payload.email,
    } satisfies AuthUser;
    next();
  } catch {
    throw new UnauthorizedError("Invalid or expired token");
  }
}
