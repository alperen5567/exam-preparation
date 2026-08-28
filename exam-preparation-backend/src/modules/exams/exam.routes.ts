import { NextFunction, Request, Response, Router } from "express";
import { authMiddleware } from "../auth/auth.middleware";
import { examController } from "./exam.controller";
import { asyncHandler } from "../../utils/asyncHandler";

const router = Router();
const courseExamRouter = Router();
const examRouter = Router();

const logRouteHit =
  (scope: "courses" | "exams") =>
  (req: Request, _res: Response, next: NextFunction) => {
    console.log(`[ExamRoutes] ${scope}`, req.method, req.originalUrl);
    next();
  };

courseExamRouter.use(logRouteHit("courses"));
courseExamRouter.use(authMiddleware);
courseExamRouter.get("/:courseId/exams", asyncHandler(examController.list));
courseExamRouter.post("/:courseId/exams", asyncHandler(examController.create));

examRouter.use(logRouteHit("exams"));
examRouter.use(authMiddleware);
examRouter.get("/", asyncHandler(examController.listAll));
examRouter.patch("/:examId", asyncHandler(examController.update));
examRouter.delete("/:examId", asyncHandler(examController.remove));

router.use("/courses", courseExamRouter);
router.use("/exams", examRouter);

export default router;
