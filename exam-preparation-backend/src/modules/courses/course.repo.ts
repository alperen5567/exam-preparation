import { prisma } from "../../db/client";

export const courseRepo = {
  listAllWithMembership(userId: string) {
    return prisma.course.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        memberships: {
          where: { userId },
          select: { id: true, userId: true },
        },
      },
    });
  },
  listJoined(userId: string) {
    return prisma.course.findMany({
      where: {
        OR: [
          { ownerId: userId },
          { memberships: { some: { userId } } },
        ],
      },
      orderBy: { createdAt: "desc" },
    });
  },
  create(ownerId: string, data: { title: string; code?: string; semester?: string }) {
    return prisma.course.create({ data: { ownerId, ...data } });
  },
  async createWithMembership(ownerId: string, data: { title: string; code?: string; semester?: string }) {
    return prisma.$transaction(async (tx) => {
      const course = await tx.course.create({ data: { ownerId, ...data } });
      await tx.courseMembership.create({ data: { userId: ownerId, courseId: course.id } });
      return course;
    });
  },
  getById(id: string) {
    return prisma.course.findUnique({ where: { id } });
  },
  getAccessibleById(courseId: string, userId: string) {
    return prisma.course.findFirst({
      where: {
        id: courseId,
        OR: [
          { ownerId: userId },
          { memberships: { some: { userId } } },
        ],
      },
    });
  },
  getMembership(userId: string, courseId: string) {
    return prisma.courseMembership.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
  },
  createMembership(userId: string, courseId: string) {
    return prisma.courseMembership.create({ data: { userId, courseId } });
  },
  async delete(id: string) {
    const deleteNotes = prisma.note.deleteMany({ where: { courseId: id } });
    const deleteFiles = prisma.file.deleteMany({ where: { courseId: id } });
    const deleteMemberships = prisma.courseMembership.deleteMany({ where: { courseId: id } });
    const deleteExams = prisma.exam.deleteMany({ where: { courseId: id } });
    const deleteCourse = prisma.course.delete({ where: { id } });

    return prisma.$transaction([deleteNotes, deleteFiles, deleteMemberships, deleteExams, deleteCourse]);
  },
};
