import path from "path";
import { env } from "../../config/env";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../utils/httpErrors";
import { AuthUser } from "../auth/auth.middleware";
import { courseService } from "../courses/course.service";
import { FileRepo } from "./file.repo";

export class FileService {
  private repo = new FileRepo();

  async upload(file: Express.Multer.File, courseId: string, user: AuthUser, isPrivateInput: unknown) {
    const isPrivate = this.parseBoolean(isPrivateInput, true);
    const normalizedCourseId = courseId?.trim();
    if (!normalizedCourseId) {
      throw new BadRequestError("courseId required");
    }
    await courseService.ensureAccess(normalizedCourseId, user.id);
    const storagePath = this.normalizeStoragePath(file.path);
    return this.repo.create({
      fileName: file.originalname,
      mimeType: file.mimetype,
      fileSizeBytes: file.size,
      storagePath,
      courseId: normalizedCourseId,
      uploaderId: user.id,
      isPrivate,
    });
  }

  async list(courseId: string, user: AuthUser) {
    const course = await courseService.ensureAccess(courseId, user.id);
    const canViewAll = user.role === "ADMIN" || course.ownerId === user.id;
    return this.repo.listByCourse(courseId, user.id, canViewAll);
  }

  async listAccessible(user: AuthUser) {
    return this.repo.listAccessibleForUser(user.id);
  }

  async remove(fileId: string, user: AuthUser) {
    const file = await this.repo.getById(fileId);
    if (!file) throw new NotFoundError("File not found");

    const course = await courseService.ensureAccess(file.courseId, user.id);
    const canDelete = user.role === "ADMIN" || course.ownerId === user.id || file.uploaderId === user.id;
    if (!canDelete) throw new ForbiddenError("Not allowed to delete this file");
    return this.repo.delete(fileId);
  }

  async getFileForUser(fileId: string, user: AuthUser) {
    const file = await this.repo.getById(fileId);
    if (!file) throw new NotFoundError("File not found");

    const course = await courseService.ensureAccess(file.courseId, user.id);
    const canViewAll = user.role === "ADMIN" || course.ownerId === user.id;

    if (!canViewAll && file.isPrivate && file.uploaderId !== user.id) {
      throw new ForbiddenError("Not allowed to access this file");
    }

    const absolutePath = this.resolveStoragePath(file.storagePath);
    if (!absolutePath) throw new NotFoundError("File not found");

    return { file, absolutePath };
  }

  private resolveStoragePath(filePath: string) {
    const uploadDir = path.resolve(env.UPLOAD_DIR);
    const absolute = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
    const relative = path.relative(uploadDir, absolute);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      const fallback = path.resolve(uploadDir, path.basename(filePath));
      const fallbackRelative = path.relative(uploadDir, fallback);
      if (fallbackRelative.startsWith("..") || path.isAbsolute(fallbackRelative)) {
        return undefined;
      }
      return fallback;
    }
    return absolute;
  }

  private normalizeStoragePath(filePath: string) {
    const uploadDir = path.resolve(env.UPLOAD_DIR);
    const absolute = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
    const relative = path.relative(uploadDir, absolute);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      return path.basename(filePath);
    }
    return relative;
  }

  private parseBoolean(value: unknown, defaultValue: boolean) {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (normalized === "true") return true;
      if (normalized === "false") return false;
    }
    return defaultValue;
  }
}
