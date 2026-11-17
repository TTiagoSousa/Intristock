-- AlterTable
ALTER TABLE "PersonalPortfolio" ADD COLUMN     "connectionId" TEXT;

-- AlterTable
ALTER TABLE "PersonalPortfolioTransaction" ADD COLUMN     "externalAt" TIMESTAMPTZ,
ADD COLUMN     "externalType" TEXT;

-- CreateTable
CREATE TABLE "BrokerConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platformId" TEXT NOT NULL,
    "externalAccountId" TEXT NOT NULL,
    "currencyCode" TEXT,
    "apiKey" TEXT NOT NULL,
    "apiSecret" TEXT NOT NULL,
    "fromDate" DATE,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastError" TEXT,
    "syncedAt" TIMESTAMP(3),
    "cashSyncedUntil" TIMESTAMPTZ,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrokerConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BrokerConnection_platformId_idx" ON "BrokerConnection"("platformId");

-- CreateIndex
CREATE UNIQUE INDEX "BrokerConnection_userId_platformId_externalAccountId_key" ON "BrokerConnection"("userId", "platformId", "externalAccountId");

-- CreateIndex
CREATE INDEX "PersonalPortfolio_connectionId_idx" ON "PersonalPortfolio"("connectionId");

-- AddForeignKey
ALTER TABLE "PersonalPortfolio" ADD CONSTRAINT "PersonalPortfolio_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "BrokerConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerConnection" ADD CONSTRAINT "BrokerConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerConnection" ADD CONSTRAINT "BrokerConnection_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "Platform"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
