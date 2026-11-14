-- AlterTable
ALTER TABLE "Platform" DROP COLUMN "details";

-- CreateTable
CREATE TABLE "PropFirmDetail" (
    "platformId" TEXT NOT NULL,
    "assetType" TEXT,
    "established" TEXT,
    "countryName" TEXT,
    "score" DECIMAL(4,1),
    "safetyGrade" TEXT,
    "trustpilotRating" DECIMAL(3,1),
    "trustpilotReviews" INTEGER,
    "trustpilotSuspended" BOOLEAN NOT NULL DEFAULT false,
    "directFunding" BOOLEAN,
    "profitSplit" TEXT,
    "payoutFrequency" TEXT,
    "dailyDrawdown" TEXT,
    "tradingPlatforms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "payoutMethods" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "firstPayoutDays" INTEGER,
    "payoutProcessing" TEXT,
    "payoutOnDemand" BOOLEAN,
    "minWithdrawal" DECIMAL(12,2),
    "newsTrading" BOOLEAN,
    "weekendHolding" BOOLEAN,
    "overnightHolding" BOOLEAN,
    "eaAllowed" BOOLEAN,
    "copyTrading" BOOLEAN,
    "hedging" BOOLEAN,
    "martingale" BOOLEAN,
    "scalping" BOOLEAN,
    "stopLossRequired" BOOLEAN,
    "resetAllowed" BOOLEAN,
    "consistencyChallenge" TEXT,
    "consistencyFunded" TEXT,
    "allowedInstruments" TEXT,
    "prohibitedStrategies" TEXT,
    "rulesSourceUrl" TEXT,
    "rulesVerifiedAt" TIMESTAMP(3),
    "detailsSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropFirmDetail_pkey" PRIMARY KEY ("platformId")
);

-- AddForeignKey
ALTER TABLE "PropFirmDetail" ADD CONSTRAINT "PropFirmDetail_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "Platform"("id") ON DELETE CASCADE ON UPDATE CASCADE;
