-- AlterTable
ALTER TABLE "CompanyItem" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'expense',
ADD COLUMN     "stockPerUnit" DECIMAL(65,30),
ADD COLUMN     "stockUnit" TEXT;

-- CreateTable
CREATE TABLE "CompanyAsset" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "paymentId" TEXT,
    "itemId" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "acquisitionDate" DATE NOT NULL,
    "acquisitionValue" DECIMAL(65,30) NOT NULL,
    "currencyId" TEXT NOT NULL,
    "depreciationRate" DECIMAL(65,30) NOT NULL,
    "usefulLifeHours" INTEGER,
    "residualValue" DECIMAL(65,30),
    "status" TEXT NOT NULL DEFAULT 'em_uso',
    "disposedAt" DATE,
    "disposalValue" DECIMAL(65,30),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyStockMovement" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "unitCost" DECIMAL(65,30),
    "sourceType" TEXT NOT NULL DEFAULT 'manual',
    "paymentId" TEXT,
    "occurredAt" DATE NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyStockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyAsset_companyId_idx" ON "CompanyAsset"("companyId");

-- CreateIndex
CREATE INDEX "CompanyAsset_paymentId_idx" ON "CompanyAsset"("paymentId");

-- CreateIndex
CREATE INDEX "CompanyAsset_itemId_idx" ON "CompanyAsset"("itemId");

-- CreateIndex
CREATE INDEX "CompanyAsset_currencyId_idx" ON "CompanyAsset"("currencyId");

-- CreateIndex
CREATE INDEX "CompanyStockMovement_companyId_idx" ON "CompanyStockMovement"("companyId");

-- CreateIndex
CREATE INDEX "CompanyStockMovement_itemId_idx" ON "CompanyStockMovement"("itemId");

-- CreateIndex
CREATE INDEX "CompanyStockMovement_paymentId_idx" ON "CompanyStockMovement"("paymentId");

-- AddForeignKey
ALTER TABLE "CompanyAsset" ADD CONSTRAINT "CompanyAsset_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyAsset" ADD CONSTRAINT "CompanyAsset_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "CompanyPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyAsset" ADD CONSTRAINT "CompanyAsset_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "CompanyItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyAsset" ADD CONSTRAINT "CompanyAsset_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyStockMovement" ADD CONSTRAINT "CompanyStockMovement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyStockMovement" ADD CONSTRAINT "CompanyStockMovement_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "CompanyItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyStockMovement" ADD CONSTRAINT "CompanyStockMovement_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "CompanyPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
