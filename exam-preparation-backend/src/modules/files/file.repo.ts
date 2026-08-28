import { prisma } from "../../db/client";
export class FileRepo {
  async create(data: any) {
    return prisma.file.create({ data });
  }

  async listByCourse(courseId: string, userId: string, canViewAll: boolean) {
    return prisma.file.findMany({
      where: {
        courseId,
        ...(canViewAll
          ? {}
          : {
              OR: [{ isPrivate: false }, { uploaderId: userId }],
            }),
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async listAccessibleForUser(userId: string) {
    return prisma.file.findMany({
      where: {
        course: {
          OR: [{ ownerId: userId }, { memberships: { some: { userId } } }],
        },
        OR: [{ isPrivate: false }, { uploaderId: userId }],
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async delete(id: string) {
    return prisma.file.delete({ where: { id } });
  }

  async getById(id: string) {
    return prisma.file.findUnique({
      where: { id },
      include: { course: { select: { ownerId: true } } },
    });
  }
}
