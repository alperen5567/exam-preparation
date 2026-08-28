/*
  Warnings:

  - You are about to drop the `Guest` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `GuestNote` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `GuestUpload` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "GuestNote" DROP CONSTRAINT "GuestNote_guestId_fkey";

-- DropForeignKey
ALTER TABLE "GuestUpload" DROP CONSTRAINT "GuestUpload_guestId_fkey";

-- DropTable
DROP TABLE "Guest";

-- DropTable
DROP TABLE "GuestNote";

-- DropTable
DROP TABLE "GuestUpload";
