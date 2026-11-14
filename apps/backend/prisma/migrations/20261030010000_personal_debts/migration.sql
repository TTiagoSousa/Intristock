-- CreateTable
CREATE TABLE "PersonalDebt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'owe',
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "counterparty" TEXT,
    "platformId" TEXT,
    "currencyId" TEXT NOT NULL,
    "principal" DECIMAL(65,30) NOT NULL,
    "openingBalance" DECIMAL(65,30) NOT NULL,
    "openingDate" DATE NOT NULL,
    "interestRate" DECIMAL(65,30),
    "rateType" TEXT,
    "installment" DECIMAL(65,30),
    "paymentDay" INTEGER,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "bankAccountId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalDebt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalDebtMovement" (
    "id" TEXT NOT NULL,
    "debtId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "principalPart" DECIMAL(65,30),
    "interestPart" DECIMAL(65,30),
    "feesPart" DECIMAL(65,30),
    "period" TEXT,
    "bankAccountId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalDebtMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PersonalDebt_userId_status_idx" ON "PersonalDebt"("userId", "status");

-- CreateIndex
CREATE INDEX "PersonalDebt_currencyId_idx" ON "PersonalDebt"("currencyId");

-- CreateIndex
CREATE INDEX "PersonalDebt_platformId_idx" ON "PersonalDebt"("platformId");

-- CreateIndex
CREATE INDEX "PersonalDebt_bankAccountId_idx" ON "PersonalDebt"("bankAccountId");

-- CreateIndex
CREATE INDEX "PersonalDebtMovement_debtId_date_idx" ON "PersonalDebtMovement"("debtId", "date");

-- CreateIndex
CREATE INDEX "PersonalDebtMovement_bankAccountId_idx" ON "PersonalDebtMovement"("bankAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "PersonalDebtMovement_debtId_period_key" ON "PersonalDebtMovement"("debtId", "period");

-- AddForeignKey
ALTER TABLE "PersonalDebt" ADD CONSTRAINT "PersonalDebt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalDebt" ADD CONSTRAINT "PersonalDebt_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "Platform"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalDebt" ADD CONSTRAINT "PersonalDebt_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalDebt" ADD CONSTRAINT "PersonalDebt_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalDebtMovement" ADD CONSTRAINT "PersonalDebtMovement_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "PersonalDebt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalDebtMovement" ADD CONSTRAINT "PersonalDebtMovement_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
