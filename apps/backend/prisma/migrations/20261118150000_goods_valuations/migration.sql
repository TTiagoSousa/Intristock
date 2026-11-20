-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "details" JSONB,
ADD COLUMN     "valuationEveryDays" INTEGER,
ADD COLUMN     "valuationNextAt" TIMESTAMPTZ;

-- AlterTable
ALTER TABLE "PersonalPortfolioTransaction" ADD COLUMN     "acquisition" TEXT,
ADD COLUMN     "valuationReport" JSONB;

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT,
    "key" TEXT NOT NULL,
    "keyHint" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "monthlyLimit" INTEGER,
    "usedThisMonth" INTEGER NOT NULL DEFAULT 0,
    "remaining" INTEGER,
    "checkedAt" TIMESTAMPTZ,
    "exhaustedUntil" TIMESTAMPTZ,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMPTZ,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApiKey_kind_position_idx" ON "ApiKey"("kind", "position");

-- CreateIndex
CREATE INDEX "Asset_valuationNextAt_idx" ON "Asset"("valuationNextAt");
