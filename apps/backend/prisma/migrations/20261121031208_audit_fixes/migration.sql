-- DropIndex
DROP INDEX "BankAccount_iban_key";

-- DropIndex
DROP INDEX "CompanyPayment_companyId_idx";

-- AlterTable
ALTER TABLE "PersonalIncome" ADD COLUMN     "companyPaymentId" TEXT;

-- AlterTable
ALTER TABLE "TimeTrackingPayout" ADD COLUMN     "confirmation" TEXT,
ADD COLUMN     "respondedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "passwordChangedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "BankAccount_userId_iban_key" ON "BankAccount"("userId", "iban");

-- CreateIndex
CREATE UNIQUE INDEX "BankAccount_companyId_iban_key" ON "BankAccount"("companyId", "iban");

-- CreateIndex
CREATE INDEX "CompanyPayment_companyId_paymentDate_idx" ON "CompanyPayment"("companyId", "paymentDate");

-- CreateIndex
CREATE INDEX "Notification_kind_actionStatus_idx" ON "Notification"("kind", "actionStatus");

-- CreateIndex
CREATE UNIQUE INDEX "PersonalIncome_companyPaymentId_key" ON "PersonalIncome"("companyPaymentId");

-- CreateIndex
CREATE INDEX "TimeTrackingEntry_connectionId_start_idx" ON "TimeTrackingEntry"("connectionId", "start");

-- AddForeignKey
ALTER TABLE "PersonalIncome" ADD CONSTRAINT "PersonalIncome_companyPaymentId_fkey" FOREIGN KEY ("companyPaymentId") REFERENCES "CompanyPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
