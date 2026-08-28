import { Router } from "express";
import { authMiddleware } from "../auth/auth.middleware";
import { timetableController } from "./timetable.controller";
import { asyncHandler } from "../../utils/asyncHandler";

const router = Router();

router.use(authMiddleware);

router.get("/", asyncHandler(timetableController.list));
router.post("/", asyncHandler(timetableController.create));
router.post("/bulk", asyncHandler(timetableController.createBulk));
router.delete("/:id", asyncHandler(timetableController.remove));

export default router;
