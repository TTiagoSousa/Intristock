-- AlterTable
ALTER TABLE "User" ADD COLUMN     "blockedReason" TEXT,
ADD COLUMN     "blockedUntil" TIMESTAMP(3);
