-- Align Exam model with schema.prisma
ALTER TABLE "Exam" RENAME COLUMN "examDate" TO "date";
ALTER TABLE "Exam" DROP COLUMN "updatedAt";
