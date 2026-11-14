-- AlterTable
ALTER TABLE "PersonalExpense" ADD COLUMN     "period" TEXT,
ADD COLUMN     "subscriptionId" TEXT;

-- CreateTable
CREATE TABLE "PersonalSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'other',
    "name" TEXT NOT NULL,
    "merchant" TEXT,
    "amount" DECIMAL(65,30) NOT NULL,
    "currencyId" TEXT NOT NULL,
    "recurring" BOOLEAN NOT NULL DEFAULT true,
    "intervalMonths" INTEGER NOT NULL DEFAULT 1,
    "billingDay" INTEGER,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "status" TEXT NOT NULL DEFAULT 'active',
    "categoryId" TEXT,
    "bankAccountId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PersonalSubscription_userId_idx" ON "PersonalSubscription"("userId");

-- CreateIndex
CREATE INDEX "PersonalSubscription_currencyId_idx" ON "PersonalSubscription"("currencyId");

-- CreateIndex
CREATE INDEX "PersonalSubscription_categoryId_idx" ON "PersonalSubscription"("categoryId");

-- CreateIndex
CREATE INDEX "PersonalSubscription_bankAccountId_idx" ON "PersonalSubscription"("bankAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "PersonalExpense_subscriptionId_period_key" ON "PersonalExpense"("subscriptionId", "period");

-- AddForeignKey
ALTER TABLE "PersonalExpense" ADD CONSTRAINT "PersonalExpense_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "PersonalSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalSubscription" ADD CONSTRAINT "PersonalSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalSubscription" ADD CONSTRAINT "PersonalSubscription_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalSubscription" ADD CONSTRAINT "PersonalSubscription_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "PersonalExpenseCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalSubscription" ADD CONSTRAINT "PersonalSubscription_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
