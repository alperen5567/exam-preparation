import { prisma } from "../../db/client";

export const userRepo = {
  getByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },
  getById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  },
  create(data: { fullName: string; email: string; passwordHash: string; role: "STUDENT" | "ADMIN" }) {
    return prisma.user.create({ data });
  },
};
