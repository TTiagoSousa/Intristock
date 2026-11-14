-- AlterTable
ALTER TABLE "CompanySupplier" ADD COLUMN     "groupId" TEXT;

-- CreateTable
CREATE TABLE "CompanySupplierGroup" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanySupplierGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanySupplierGroup_companyId_idx" ON "CompanySupplierGroup"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanySupplierGroup_companyId_name_key" ON "CompanySupplierGroup"("companyId", "name");

-- CreateIndex
CREATE INDEX "CompanySupplier_groupId_idx" ON "CompanySupplier"("groupId");

-- AddForeignKey
ALTER TABLE "CompanySupplier" ADD CONSTRAINT "CompanySupplier_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CompanySupplierGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanySupplierGroup" ADD CONSTRAINT "CompanySupplierGroup_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
