-- AlterTable
ALTER TABLE "CompanyItem" ADD COLUMN     "platformPlanId" TEXT;

-- CreateIndex
CREATE INDEX "CompanyItem_platformPlanId_idx" ON "CompanyItem"("platformPlanId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyItem_companyId_platformPlanId_key" ON "CompanyItem"("companyId", "platformPlanId");

-- AddForeignKey
ALTER TABLE "CompanyItem" ADD CONSTRAINT "CompanyItem_platformPlanId_fkey" FOREIGN KEY ("platformPlanId") REFERENCES "PlatformPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
