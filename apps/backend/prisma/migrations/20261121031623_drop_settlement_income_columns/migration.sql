-- DropForeignKey
ALTER TABLE "TimeTrackingSettlement" DROP CONSTRAINT "TimeTrackingSettlement_memberId_fkey";

-- DropForeignKey
ALTER TABLE "TimeTrackingSettlement" DROP CONSTRAINT "TimeTrackingSettlement_personalIncomeId_fkey";

-- DropForeignKey
ALTER TABLE "TimeTrackingSettlement" DROP CONSTRAINT "TimeTrackingSettlement_userId_fkey";

-- DropIndex
DROP INDEX "TimeTrackingSettlement_memberId_idx";

-- DropIndex
DROP INDEX "TimeTrackingSettlement_personalIncomeId_key";

-- DropIndex
DROP INDEX "TimeTrackingSettlement_userId_idx";

-- AlterTable
ALTER TABLE "TimeTrackingSettlement" DROP COLUMN "memberId",
DROP COLUMN "personalIncomeId",
DROP COLUMN "userId";
