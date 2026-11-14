-- CreateTable
CREATE TABLE "CompanyItem" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "supplierId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "unit" TEXT,
    "defaultPrice" DECIMAL(65,30),
    "currencyId" TEXT,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurrencePeriod" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyPaymentItem" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(65,30) NOT NULL,
    "totalPrice" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyPaymentItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyItem_companyId_idx" ON "CompanyItem"("companyId");

-- CreateIndex
CREATE INDEX "CompanyItem_supplierId_idx" ON "CompanyItem"("supplierId");

-- CreateIndex
CREATE INDEX "CompanyItem_currencyId_idx" ON "CompanyItem"("currencyId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyItem_companyId_name_key" ON "CompanyItem"("companyId", "name");

-- CreateIndex
CREATE INDEX "CompanyPaymentItem_paymentId_idx" ON "CompanyPaymentItem"("paymentId");

-- CreateIndex
CREATE INDEX "CompanyPaymentItem_itemId_idx" ON "CompanyPaymentItem"("itemId");

-- AddForeignKey
ALTER TABLE "CompanyItem" ADD CONSTRAINT "CompanyItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyItem" ADD CONSTRAINT "CompanyItem_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "CompanySupplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyItem" ADD CONSTRAINT "CompanyItem_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyPaymentItem" ADD CONSTRAINT "CompanyPaymentItem_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "CompanyPayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyPaymentItem" ADD CONSTRAINT "CompanyPaymentItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "CompanyItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
