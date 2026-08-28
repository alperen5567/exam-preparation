import { Router } from "express";
import { authMiddleware } from "../auth/auth.middleware";
import { noteController } from "./note.controller";
import { asyncHandler } from "../../utils/asyncHandler";

const r = Router();

r.use(authMiddleware);

r.get("/", asyncHandler(noteController.list)); // ?courseId=
r.post("/", asyncHandler(noteController.create));
r.put("/:noteId", asyncHandler(noteController.update));
r.delete("/:noteId", asyncHandler(noteController.remove));

export default r;
