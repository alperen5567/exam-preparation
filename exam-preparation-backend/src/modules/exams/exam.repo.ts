import { prisma } from "../../db/client";

export const examRepo = {
  create(courseId: string, data: { title: string; date: Date; description?: string | null }) {
    console.log("[ExamRepo] create", { courseId, title: data.title, date: data.date });
    return prisma.exam.create({ data: { courseId, ...data } });
  },
  listByCourse(courseId: string) {
    console.log("[ExamRepo] listByCourse", { courseId });
    return prisma.exam.findMany({
      where: { courseId },
      orderBy: { date: "asc" },
    });
  },
  listByUser(userId: string) {
    console.log("[ExamRepo] listByUser", { userId });
    return prisma.exam.findMany({
      where: {
        course: {
          OR: [{ ownerId: userId }, { memberships: { some: { userId } } }],
        },
      },
      orderBy: { date: "asc" },
    });
  },
  getById(id: string) {
    console.log("[ExamRepo] getById", { id });
    return prisma.exam.findUnique({ where: { id } });
  },
  update(id: string, data: Partial<{ title: string; date: Date; description?: string | null }>) {
    console.log("[ExamRepo] update", { id, data });
    return prisma.exam.update({ where: { id }, data });
  },
  delete(id: string) {
    console.log("[ExamRepo] delete", { id });
    return prisma.exam.delete({ where: { id } });
  },
};
