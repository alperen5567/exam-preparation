import { Request, Response } from "express";
import { FileService } from "./file.service";
import { AuthUser } from "../auth/auth.middleware";

export class FileController {
  private service = new FileService();

  async upload(req: Request, res: Response) {
    const user = (req as any).user as AuthUser;
    const file = req.file;
    const { courseId: bodyCourseId, isPrivate } = req.body;
    const courseId = (bodyCourseId ?? req.query?.courseId) as string | undefined;

    if (!user || !file || !courseId) {
      return res.status(400).json({ message: "Invalid request" });
    }

    const result = await this.service.upload(file, courseId, user, isPrivate);

    res.status(201).json({ data: result });
  }

  async remove(req: Request, res: Response) {
    const user = (req as any).user as AuthUser;
    await this.service.remove(req.params.fileId, user);
    res.status(204).send();
  }

  async list(req: Request, res: Response) {
    const user = (req as any).user as AuthUser;
    const { courseId } = req.query as any;

    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!courseId) {
      const files = await this.service.listAccessible(user);
      res.json({ data: files });
      return;
    }

    const files = await this.service.list(courseId, user);
    res.json({ data: files });
  }

  async download(req: Request, res: Response) {
    const user = (req as any).user as AuthUser;
    const { file, absolutePath } = await this.service.getFileForUser(req.params.fileId, user);

    const safeName = file.fileName.replace(/"/g, "");
    res.setHeader("Content-Type", file.mimeType || "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="${safeName}"`);
    res.sendFile(absolutePath);
  }
}
