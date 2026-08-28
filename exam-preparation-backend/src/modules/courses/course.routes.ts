import { Router } from "express";
import { courseController } from "./course.controller";
import { authMiddleware } from "../auth/auth.middleware";
import { asyncHandler } from "../../utils/asyncHandler";

const r = Router();

r.use(authMiddleware);

r.get("/joined", asyncHandler(courseController.listJoined));
r.get("/", asyncHandler(courseController.listAvailable));
r.post("/:courseId/join", asyncHandler(courseController.join));
r.get("/:courseId", asyncHandler(courseController.getDetails));
r.post("/", asyncHandler(courseController.create));
r.delete("/:courseId", asyncHandler(courseController.remove));

export default r;
