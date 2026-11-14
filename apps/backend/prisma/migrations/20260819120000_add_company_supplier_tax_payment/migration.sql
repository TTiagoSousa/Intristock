-- CreateTable
CREATE TABLE "CompanySupplier" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "alias" TEXT,
    "countryId" TEXT,
    "currencyId" TEXT,
    "bankAccountId" TEXT,
    "taxId" TEXT,
    "website" TEXT,
    "details" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanySupplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tax" (
    "id" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rate" DOUBLE PRECISION NOT NULL,
    "category" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tax_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyPayment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "paymentType" TEXT NOT NULL,
    "partyType" TEXT NOT NULL,
    "supplierId" TEXT,
    "fromBankAccountId" TEXT,
    "toBankAccountId" TEXT,
    "amount" DECIMAL(65,30) NOT NULL,
    "currencyId" TEXT NOT NULL,
    "description" TEXT,
    "reference" TEXT,
    "paymentDate" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyPaymentTax" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "taxId" TEXT NOT NULL,
    "calculationType" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "netAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyPaymentTax_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanySupplier_companyId_idx" ON "CompanySupplier"("companyId");

-- CreateIndex
CREATE INDEX "CompanySupplier_countryId_idx" ON "CompanySupplier"("countryId");

-- CreateIndex
CREATE INDEX "CompanySupplier_currencyId_idx" ON "CompanySupplier"("currencyId");

-- CreateIndex
CREATE INDEX "CompanySupplier_bankAccountId_idx" ON "CompanySupplier"("bankAccountId");

-- CreateIndex
CREATE INDEX "Tax_countryId_idx" ON "Tax"("countryId");

-- CreateIndex
CREATE INDEX "Tax_category_idx" ON "Tax"("category");

-- CreateIndex
CREATE INDEX "Tax_type_idx" ON "Tax"("type");

-- CreateIndex
CREATE INDEX "CompanyPayment_companyId_idx" ON "CompanyPayment"("companyId");

-- CreateIndex
CREATE INDEX "CompanyPayment_supplierId_idx" ON "CompanyPayment"("supplierId");

-- CreateIndex
CREATE INDEX "CompanyPayment_fromBankAccountId_idx" ON "CompanyPayment"("fromBankAccountId");

-- CreateIndex
CREATE INDEX "CompanyPayment_toBankAccountId_idx" ON "CompanyPayment"("toBankAccountId");

-- CreateIndex
CREATE INDEX "CompanyPayment_currencyId_idx" ON "CompanyPayment"("currencyId");

-- CreateIndex
CREATE INDEX "CompanyPayment_paymentDate_idx" ON "CompanyPayment"("paymentDate");

-- CreateIndex
CREATE INDEX "CompanyPaymentTax_paymentId_idx" ON "CompanyPaymentTax"("paymentId");

-- CreateIndex
CREATE INDEX "CompanyPaymentTax_taxId_idx" ON "CompanyPaymentTax"("taxId");

-- AddForeignKey
ALTER TABLE "CompanySupplier" ADD CONSTRAINT "CompanySupplier_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanySupplier" ADD CONSTRAINT "CompanySupplier_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanySupplier" ADD CONSTRAINT "CompanySupplier_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanySupplier" ADD CONSTRAINT "CompanySupplier_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tax" ADD CONSTRAINT "Tax_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyPayment" ADD CONSTRAINT "CompanyPayment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyPayment" ADD CONSTRAINT "CompanyPayment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "CompanySupplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyPayment" ADD CONSTRAINT "CompanyPayment_fromBankAccountId_fkey" FOREIGN KEY ("fromBankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyPayment" ADD CONSTRAINT "CompanyPayment_toBankAccountId_fkey" FOREIGN KEY ("toBankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyPayment" ADD CONSTRAINT "CompanyPayment_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyPaymentTax" ADD CONSTRAINT "CompanyPaymentTax_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "CompanyPayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyPaymentTax" ADD CONSTRAINT "CompanyPaymentTax_taxId_fkey" FOREIGN KEY ("taxId") REFERENCES "Tax"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
