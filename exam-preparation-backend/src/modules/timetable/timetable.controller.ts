import { Request, Response } from "express";
import { timetableService } from "./timetable.service";
import { UnauthorizedError } from "../../utils/httpErrors";

export const timetableController = {
  async list(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedError("Unauthorized");
    const data = await timetableService.listByUser(userId);
    res.json({ data });
  },
  async create(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedError("Unauthorized");
    const data = await timetableService.create(userId, req.body);
    res.status(201).json({ data });
  },
  async createBulk(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedError("Unauthorized");
    const entries = Array.isArray(req.body?.entries) ? req.body.entries : [];
    const data = await timetableService.createBulk(userId, entries);
    res.status(201).json({ data });
  },
  async remove(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedError("Unauthorized");
    await timetableService.remove(userId, req.params.id);
    res.status(204).send();
  },
};
