import jwt from "jsonwebtoken";
import { env } from "../config/env";

type JwtPayload = {
  sub: string;
  role: "STUDENT" | "ADMIN";
  email: string;
};

export function signToken(user: { id: string; role: "STUDENT" | "ADMIN"; email: string }) {
  return jwt.sign({ sub: user.id, role: user.role, email: user.email }, env.JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}
