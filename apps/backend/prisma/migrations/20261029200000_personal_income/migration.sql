-- CreateTable
CREATE TABLE "PersonalIncomeSource" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "companyId" TEXT,
    "grossAmount" DECIMAL(65,30),
    "netAmount" DECIMAL(65,30),
    "currencyId" TEXT,
    "payDay" INTEGER,
    "paymentsPerYear" INTEGER,
    "startDate" DATE,
    "endDate" DATE,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalIncomeSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalIncome" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "sourceId" TEXT,
    "memberPayId" TEXT,
    "period" TEXT,
    "description" TEXT,
    "grossAmount" DECIMAL(65,30),
    "amount" DECIMAL(65,30) NOT NULL,
    "withholdingPct" DECIMAL(65,30),
    "currencyId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'received',
    "bankAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalIncome_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PersonalIncomeSource_userId_idx" ON "PersonalIncomeSource"("userId");

-- CreateIndex
CREATE INDEX "PersonalIncomeSource_companyId_idx" ON "PersonalIncomeSource"("companyId");

-- CreateIndex
CREATE INDEX "PersonalIncomeSource_currencyId_idx" ON "PersonalIncomeSource"("currencyId");

-- CreateIndex
CREATE INDEX "PersonalIncome_userId_date_idx" ON "PersonalIncome"("userId", "date");

-- CreateIndex
CREATE INDEX "PersonalIncome_currencyId_idx" ON "PersonalIncome"("currencyId");

-- CreateIndex
CREATE INDEX "PersonalIncome_bankAccountId_idx" ON "PersonalIncome"("bankAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "PersonalIncome_memberPayId_period_key" ON "PersonalIncome"("memberPayId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "PersonalIncome_sourceId_period_key" ON "PersonalIncome"("sourceId", "period");

-- AddForeignKey
ALTER TABLE "PersonalIncomeSource" ADD CONSTRAINT "PersonalIncomeSource_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalIncomeSource" ADD CONSTRAINT "PersonalIncomeSource_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalIncomeSource" ADD CONSTRAINT "PersonalIncomeSource_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalIncome" ADD CONSTRAINT "PersonalIncome_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalIncome" ADD CONSTRAINT "PersonalIncome_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "PersonalIncomeSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalIncome" ADD CONSTRAINT "PersonalIncome_memberPayId_fkey" FOREIGN KEY ("memberPayId") REFERENCES "CompanyMemberPay"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalIncome" ADD CONSTRAINT "PersonalIncome_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalIncome" ADD CONSTRAINT "PersonalIncome_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
