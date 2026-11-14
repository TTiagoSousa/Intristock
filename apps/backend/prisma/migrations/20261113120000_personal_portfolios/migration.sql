-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "currencyId" TEXT;

-- CreateTable
CREATE TABLE "PersonalPortfolio" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "platformId" TEXT,
    "externalId" TEXT,
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalPortfolio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalPortfolioTransaction" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "price" DECIMAL(65,30),
    "amount" DECIMAL(65,30) NOT NULL,
    "currencyId" TEXT NOT NULL,
    "bankAccountId" TEXT,
    "notes" TEXT,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalPortfolioTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PersonalPortfolio_platformId_idx" ON "PersonalPortfolio"("platformId");

-- CreateIndex
CREATE UNIQUE INDEX "PersonalPortfolio_userId_name_key" ON "PersonalPortfolio"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "PersonalPortfolio_userId_platformId_externalId_key" ON "PersonalPortfolio"("userId", "platformId", "externalId");

-- CreateIndex
CREATE INDEX "PersonalPortfolioTransaction_portfolioId_date_idx" ON "PersonalPortfolioTransaction"("portfolioId", "date");

-- CreateIndex
CREATE INDEX "PersonalPortfolioTransaction_assetId_idx" ON "PersonalPortfolioTransaction"("assetId");

-- CreateIndex
CREATE INDEX "PersonalPortfolioTransaction_currencyId_idx" ON "PersonalPortfolioTransaction"("currencyId");

-- CreateIndex
CREATE INDEX "PersonalPortfolioTransaction_bankAccountId_idx" ON "PersonalPortfolioTransaction"("bankAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "PersonalPortfolioTransaction_portfolioId_externalId_key" ON "PersonalPortfolioTransaction"("portfolioId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_currencyId_key" ON "Asset"("currencyId");

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalPortfolio" ADD CONSTRAINT "PersonalPortfolio_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalPortfolio" ADD CONSTRAINT "PersonalPortfolio_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "Platform"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalPortfolioTransaction" ADD CONSTRAINT "PersonalPortfolioTransaction_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "PersonalPortfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalPortfolioTransaction" ADD CONSTRAINT "PersonalPortfolioTransaction_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalPortfolioTransaction" ADD CONSTRAINT "PersonalPortfolioTransaction_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalPortfolioTransaction" ADD CONSTRAINT "PersonalPortfolioTransaction_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
