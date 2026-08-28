import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import { userRepo } from "../users/user.repo";

export interface AuthUser {
  id: string;
  role: "STUDENT" | "ADMIN";
  email?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: "Authorization header missing" });
  }

  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ message: "Invalid authorization header" });
  }

  let decoded: any;
  try {
    decoded = jwt.verify(token, env.JWT_SECRET) as any;
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }

  const userId = decoded?.sub;
  if (!userId) {
    return res.status(401).json({ message: "Invalid token payload" });
  }

  try {
    const user = await userRepo.getById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    req.user = {
      id: user.id,
      role: user.role,
      email: user.email,
    };

    return next();
  } catch (error) {
    return next(error);
  }
}
