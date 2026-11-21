-- AlterTable
ALTER TABLE "TimeTrackingPerson" ADD COLUMN     "payRate" DECIMAL(65,30),
ADD COLUMN     "payWithholdingPct" DECIMAL(65,30);

-- CreateTable
CREATE TABLE "TimeTrackingPayout" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "memberId" TEXT,
    "userId" TEXT,
    "seconds" INTEGER NOT NULL,
    "hourlyRate" DECIMAL(65,30) NOT NULL,
    "grossAmount" DECIMAL(65,30) NOT NULL,
    "withholdingPct" DECIMAL(65,30),
    "netAmount" DECIMAL(65,30) NOT NULL,
    "currencyId" TEXT NOT NULL,
    "paidAt" DATE NOT NULL,
    "companyPaymentId" TEXT,
    "personalIncomeId" TEXT,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimeTrackingPayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeTrackingPayoutAllocation" (
    "id" TEXT NOT NULL,
    "payoutId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "seconds" INTEGER NOT NULL,

    CONSTRAINT "TimeTrackingPayoutAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TimeTrackingPayout_companyPaymentId_key" ON "TimeTrackingPayout"("companyPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "TimeTrackingPayout_personalIncomeId_key" ON "TimeTrackingPayout"("personalIncomeId");

-- CreateIndex
CREATE INDEX "TimeTrackingPayout_companyId_paidAt_idx" ON "TimeTrackingPayout"("companyId", "paidAt");

-- CreateIndex
CREATE INDEX "TimeTrackingPayout_personId_idx" ON "TimeTrackingPayout"("personId");

-- CreateIndex
CREATE INDEX "TimeTrackingPayout_userId_idx" ON "TimeTrackingPayout"("userId");

-- CreateIndex
CREATE INDEX "TimeTrackingPayoutAllocation_entryId_idx" ON "TimeTrackingPayoutAllocation"("entryId");

-- CreateIndex
CREATE UNIQUE INDEX "TimeTrackingPayoutAllocation_payoutId_entryId_key" ON "TimeTrackingPayoutAllocation"("payoutId", "entryId");

-- AddForeignKey
ALTER TABLE "TimeTrackingPayout" ADD CONSTRAINT "TimeTrackingPayout_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeTrackingPayout" ADD CONSTRAINT "TimeTrackingPayout_personId_fkey" FOREIGN KEY ("personId") REFERENCES "TimeTrackingPerson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeTrackingPayout" ADD CONSTRAINT "TimeTrackingPayout_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "CompanyMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeTrackingPayout" ADD CONSTRAINT "TimeTrackingPayout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeTrackingPayout" ADD CONSTRAINT "TimeTrackingPayout_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeTrackingPayout" ADD CONSTRAINT "TimeTrackingPayout_companyPaymentId_fkey" FOREIGN KEY ("companyPaymentId") REFERENCES "CompanyPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeTrackingPayout" ADD CONSTRAINT "TimeTrackingPayout_personalIncomeId_fkey" FOREIGN KEY ("personalIncomeId") REFERENCES "PersonalIncome"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeTrackingPayoutAllocation" ADD CONSTRAINT "TimeTrackingPayoutAllocation_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "TimeTrackingPayout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeTrackingPayoutAllocation" ADD CONSTRAINT "TimeTrackingPayoutAllocation_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "TimeTrackingEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
