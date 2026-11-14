-- AlterTable
ALTER TABLE "CompanyPayment" ADD COLUMN     "accrualDate" DATE,
ADD COLUMN     "assetId" TEXT,
ADD COLUMN     "isOwnerCost" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "CompanyPayment_accrualDate_idx" ON "CompanyPayment"("accrualDate");

-- CreateIndex
CREATE INDEX "CompanyPayment_assetId_idx" ON "CompanyPayment"("assetId");

-- AddForeignKey
ALTER TABLE "CompanyPayment" ADD CONSTRAINT "CompanyPayment_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "CompanyAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
