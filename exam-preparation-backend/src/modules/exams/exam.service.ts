import { BadRequestError, NotFoundError } from "../../utils/httpErrors";
import { courseService } from "../courses/course.service";
import { examRepo } from "./exam.repo";

type ExamPayload = {
  title?: string;
  date?: string | Date;
  description?: string | null;
};

export const examService = {
  async listByUser(userId: string) {
    console.log("[ExamService] listByUser", { userId });
    return examRepo.listByUser(userId);
  },
  async listByCourse(userId: string, courseId: string) {
    console.log("[ExamService] listByCourse", { userId, courseId });
    await courseService.ensureAccess(courseId, userId);
    return examRepo.listByCourse(courseId);
  },
  async create(userId: string, courseId: string, payload: ExamPayload) {
    console.log("[ExamService] create", { userId, courseId });
    if (!payload.title) throw new BadRequestError("Title required");
    const date = this.parseDate(payload.date);
    if (!date) throw new BadRequestError("Valid date required");
    const description = this.normalizeDescription(payload.description);

    await courseService.ensureAccess(courseId, userId);
    return examRepo.create(courseId, { title: payload.title, date, description });
  },
  async update(userId: string, examId: string, payload: ExamPayload) {
    console.log("[ExamService] update", { userId, examId });
    const exam = await examRepo.getById(examId);
    if (!exam) throw new NotFoundError("Exam not found");

    await courseService.ensureAccess(exam.courseId, userId);

    const data: { title?: string; date?: Date; description?: string | null } = {};
    if (payload.title) data.title = payload.title;
    if (payload.date !== undefined) {
      const parsed = this.parseDate(payload.date);
      if (!parsed) throw new BadRequestError("Valid date required");
      data.date = parsed;
    }
    const description = this.normalizeDescription(payload.description);
    if (description !== undefined) {
      data.description = description;
    }

    return examRepo.update(examId, data);
  },
  async remove(userId: string, examId: string) {
    console.log("[ExamService] remove", { userId, examId });
    const exam = await examRepo.getById(examId);
    if (!exam) throw new NotFoundError("Exam not found");

    await courseService.ensureAccess(exam.courseId, userId);
    return examRepo.delete(examId);
  },
  parseDate(input?: string | Date) {
    if (!input) return undefined;
    if (input instanceof Date) return isNaN(input.getTime()) ? undefined : input;
    const date = new Date(input);
    return isNaN(date.getTime()) ? undefined : date;
  },
  normalizeDescription(input?: string | null) {
    if (input === null) return null;
    if (typeof input === "string") {
      const trimmed = input.trim();
      return trimmed ? trimmed : null;
    }
    return undefined;
  },
};
