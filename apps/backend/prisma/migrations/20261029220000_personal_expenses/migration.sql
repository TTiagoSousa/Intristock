-- CreateTable
CREATE TABLE "PersonalExpenseCategory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalProduct" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "unit" TEXT,
    "categoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalExpense" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'purchase',
    "date" DATE NOT NULL,
    "merchant" TEXT,
    "description" TEXT,
    "categoryId" TEXT,
    "companyId" TEXT,
    "companyPaymentId" TEXT,
    "amount" DECIMAL(65,30) NOT NULL,
    "currencyId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'paid',
    "bankAccountId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalExpenseItem" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "productId" TEXT,
    "name" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(65,30) NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "categoryId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PersonalExpenseItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PersonalExpenseCategory_userId_idx" ON "PersonalExpenseCategory"("userId");

-- CreateIndex
CREATE INDEX "PersonalExpenseCategory_parentId_idx" ON "PersonalExpenseCategory"("parentId");

-- CreateIndex
CREATE INDEX "PersonalProduct_userId_idx" ON "PersonalProduct"("userId");

-- CreateIndex
CREATE INDEX "PersonalProduct_categoryId_idx" ON "PersonalProduct"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "PersonalExpense_companyPaymentId_key" ON "PersonalExpense"("companyPaymentId");

-- CreateIndex
CREATE INDEX "PersonalExpense_userId_date_idx" ON "PersonalExpense"("userId", "date");

-- CreateIndex
CREATE INDEX "PersonalExpense_categoryId_idx" ON "PersonalExpense"("categoryId");

-- CreateIndex
CREATE INDEX "PersonalExpense_companyId_idx" ON "PersonalExpense"("companyId");

-- CreateIndex
CREATE INDEX "PersonalExpense_currencyId_idx" ON "PersonalExpense"("currencyId");

-- CreateIndex
CREATE INDEX "PersonalExpense_bankAccountId_idx" ON "PersonalExpense"("bankAccountId");

-- CreateIndex
CREATE INDEX "PersonalExpenseItem_expenseId_idx" ON "PersonalExpenseItem"("expenseId");

-- CreateIndex
CREATE INDEX "PersonalExpenseItem_productId_idx" ON "PersonalExpenseItem"("productId");

-- CreateIndex
CREATE INDEX "PersonalExpenseItem_categoryId_idx" ON "PersonalExpenseItem"("categoryId");

-- AddForeignKey
ALTER TABLE "PersonalExpenseCategory" ADD CONSTRAINT "PersonalExpenseCategory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalExpenseCategory" ADD CONSTRAINT "PersonalExpenseCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "PersonalExpenseCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalProduct" ADD CONSTRAINT "PersonalProduct_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalProduct" ADD CONSTRAINT "PersonalProduct_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "PersonalExpenseCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalExpense" ADD CONSTRAINT "PersonalExpense_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalExpense" ADD CONSTRAINT "PersonalExpense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "PersonalExpenseCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalExpense" ADD CONSTRAINT "PersonalExpense_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalExpense" ADD CONSTRAINT "PersonalExpense_companyPaymentId_fkey" FOREIGN KEY ("companyPaymentId") REFERENCES "CompanyPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalExpense" ADD CONSTRAINT "PersonalExpense_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalExpense" ADD CONSTRAINT "PersonalExpense_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalExpenseItem" ADD CONSTRAINT "PersonalExpenseItem_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "PersonalExpense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalExpenseItem" ADD CONSTRAINT "PersonalExpenseItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "PersonalProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalExpenseItem" ADD CONSTRAINT "PersonalExpenseItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "PersonalExpenseCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
