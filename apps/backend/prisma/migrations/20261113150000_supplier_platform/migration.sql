-- AlterTable
ALTER TABLE "CompanySupplier" ADD COLUMN     "platformId" TEXT;

-- CreateIndex
CREATE INDEX "CompanySupplier_platformId_idx" ON "CompanySupplier"("platformId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanySupplier_companyId_platformId_key" ON "CompanySupplier"("companyId", "platformId");

-- AddForeignKey
ALTER TABLE "CompanySupplier" ADD CONSTRAINT "CompanySupplier_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "Platform"("id") ON DELETE SET NULL ON UPDATE CASCADE;
