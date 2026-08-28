import { Request, Response } from "express";
import { examService } from "./exam.service";
import { UnauthorizedError } from "../../utils/httpErrors";

export const examController = {
  async listAll(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedError("Unauthorized");
    const data = await examService.listByUser(userId);
    res.json({ data });
  },
  async list(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedError("Unauthorized");
    console.log("[ExamController] list", { userId, courseId: req.params.courseId });
    const data = await examService.listByCourse(userId, req.params.courseId);
    res.json({ data });
  },
  async create(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedError("Unauthorized");
    console.log("[ExamController] create", { userId, courseId: req.params.courseId });
    const data = await examService.create(userId, req.params.courseId, req.body);
    res.status(201).json({ data });
  },
  async update(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedError("Unauthorized");
    console.log("[ExamController] update", { userId, examId: req.params.examId });
    const data = await examService.update(userId, req.params.examId, req.body);
    res.json({ data });
  },
  async remove(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedError("Unauthorized");
    console.log("[ExamController] remove", { userId, examId: req.params.examId });
    await examService.remove(userId, req.params.examId);
    res.status(204).send();
  },
};
