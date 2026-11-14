-- AlterTable
ALTER TABLE "PersonalDebtMovement" ADD COLUMN     "rateHour" TIMESTAMPTZ;

-- AlterTable
ALTER TABLE "PersonalExpense" ADD COLUMN     "rateHour" TIMESTAMPTZ;

-- AlterTable
ALTER TABLE "PersonalIncome" ADD COLUMN     "rateHour" TIMESTAMPTZ;

-- AlterTable
ALTER TABLE "PersonalPortfolioTransaction" ADD COLUMN     "rateHour" TIMESTAMPTZ;

-- CreateTable
CREATE TABLE "CurrencyHourRate" (
    "hour" TIMESTAMPTZ NOT NULL,
    "currencyId" TEXT NOT NULL,
    "rate" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CurrencyHourRate_pkey" PRIMARY KEY ("hour","currencyId")
);

-- CreateIndex
CREATE INDEX "CurrencyHourRate_currencyId_idx" ON "CurrencyHourRate"("currencyId");

-- AddForeignKey
ALTER TABLE "CurrencyHourRate" ADD CONSTRAINT "CurrencyHourRate_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
