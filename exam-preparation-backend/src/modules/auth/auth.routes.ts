import { Router } from "express";
import { authController } from "./auth.controller";
import { authMiddleware } from "./auth.middleware";
import { asyncHandler } from "../../utils/asyncHandler";

const r = Router();

r.use((req, _res, next) => {
  const email =
    typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : undefined;
  console.info(
    `[AuthRoutes] ${req.method} ${req.originalUrl}${email ? ` email=${email}` : ""}`
  );
  next();
});

r.post("/register", asyncHandler(authController.register));
r.post("/login", asyncHandler(authController.login));
r.get("/me", authMiddleware, asyncHandler(authController.getMe));

export default r;
