-- CreateTable
CREATE TABLE "PlatformPlan" (
    "id" TEXT NOT NULL,
    "platformId" TEXT NOT NULL,
    "externalKey" TEXT,
    "step" TEXT,
    "name" TEXT,
    "accountSize" DECIMAL(14,2),
    "price" DECIMAL(12,2),
    "currency" TEXT,
    "activationFee" DECIMAL(12,2),
    "profitTargetPct" DECIMAL(6,2),
    "maxDailyLossPct" DECIMAL(6,2),
    "maxTotalDrawdownPct" DECIMAL(6,2),
    "drawdownModel" TEXT,
    "minTradeDays" INTEGER,
    "consistencyPct" DECIMAL(6,2),
    "profitSplitPct" DECIMAL(6,2),
    "status" TEXT,
    "stale" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlatformPlan_platformId_idx" ON "PlatformPlan"("platformId");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformPlan_platformId_externalKey_key" ON "PlatformPlan"("platformId", "externalKey");

-- AddForeignKey
ALTER TABLE "PlatformPlan" ADD CONSTRAINT "PlatformPlan_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "Platform"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Os planos saem dos details das plataformas: passam a ter tabela própria (o atualizar volta a trazê-los)
UPDATE "Platform" SET "details" = "details" - 'plans' WHERE "details" ? 'plans';
