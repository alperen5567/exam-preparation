import { Request, Response } from "express";
import { noteService } from "./note.service";

export const noteController = {
  async list(req: Request, res: Response) {
    const { courseId } = req.query as { courseId: string };
    const data = await noteService.list(req.user!.id, courseId);
    res.json({ data });
  },
  async create(req: Request, res: Response) {
    const data = await noteService.create(req.user!.id, req.body);
    res.status(201).json({ data });
  },
  async update(req: Request, res: Response) {
    const data = await noteService.update(req.user!.id, req.params.noteId, req.body);
    res.json({ data });
  },
  async remove(req: Request, res: Response) {
    await noteService.remove(req.user!.id, req.params.noteId);
    res.status(204).send();
  },
};