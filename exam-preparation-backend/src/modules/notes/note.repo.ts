import { prisma } from "../../db/client";

export const noteRepo = {
  listByCourseAuthor(courseId: string, authorId: string) {
    return prisma.note.findMany({ where: { courseId, authorId }, orderBy: { createdAt: "desc" } });
  },
  create(data: { courseId: string; authorId: string; title: string; content: string; isPrivate?: boolean }) {
    return prisma.note.create({ data });
  },
  getById(id: string) {
    return prisma.note.findUnique({ where: { id } });
  },
  update(id: string, data: Partial<{ title: string; content: string; isPrivate: boolean }>) {
    return prisma.note.update({ where: { id }, data });
  },
  delete(id: string) {
    return prisma.note.delete({ where: { id } });
  },
};