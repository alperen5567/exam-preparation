import { Request, Response } from "express";
import { courseService } from "./course.service";
import { userRepo } from "../users/user.repo";

export const courseController = {
  async listAvailable(req: Request, res: Response) {
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const data = await courseService.listAvailable(user.id);
    res.json({ data });
  },
  async listJoined(req: Request, res: Response) {
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const data = await courseService.listJoined(user.id);
    res.json({ data });
  },
  async getDetails(req: Request, res: Response) {
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const course = await courseService.ensureAccess(req.params.courseId, user.id);
    res.json({ data: course });
  },
  async join(req: Request, res: Response) {
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const data = await courseService.joinCourse(req.params.courseId, user.id);
    res.json({ data });
  },
  async create(req: Request, res: Response) {
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const dbUser = await userRepo.getById(user.id);
    if (!dbUser) return res.status(401).json({ message: "User not found" });
    const { ownerId: _ignored, ...payload } = req.body ?? {};
    const data = await courseService.create(user.id, payload);
    res.status(201).json({ data });
  },
  async remove(req: Request, res: Response) {
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    await courseService.remove(user.id, req.params.courseId);
    res.status(204).send();
  },
};
