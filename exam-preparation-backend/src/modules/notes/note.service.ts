import { BadRequestError, ForbiddenError, NotFoundError } from "../../utils/httpErrors";
import { courseService } from "../courses/course.service";
import { noteRepo } from "./note.repo";

export const noteService = {
  list(userId: string, courseId: string) {
    return noteRepo.listByCourseAuthor(courseId, userId);
  },
  async create(
    userId: string,
    payload: {
      courseId?: string;
      title?: string;
      content?: string;
      isPrivate?: boolean;
      noteTitle?: string;
    }
  ) {
    const courseId = (payload.courseId ?? "").trim();
    const title = (payload.title ?? payload.noteTitle ?? "").trim();
    const content = (payload.content ?? "").trim();
    const isPrivate = payload.isPrivate ?? true;

    if (!courseId) throw new BadRequestError("courseId required");
    if (!title) throw new BadRequestError("Title required");
    if (!content) throw new BadRequestError("Content required");

    await courseService.ensureAccess(courseId, userId);
    return noteRepo.create({ courseId, title, content, isPrivate, authorId: userId });
  },
  async update(userId: string, noteId: string, data: Partial<{ title: string; content: string; isPrivate: boolean }>) {
    const n = await noteRepo.getById(noteId);
    if (!n) throw new NotFoundError("Note not found");
    if (n.authorId !== userId) throw new ForbiddenError("Not your note");
    return noteRepo.update(noteId, data);
  },
  async remove(userId: string, noteId: string) {
    const n = await noteRepo.getById(noteId);
    if (!n) throw new NotFoundError("Note not found");
    if (n.authorId !== userId) throw new ForbiddenError("Not your note");
    return noteRepo.delete(noteId);
  },
};
