-- AlterTable
ALTER TABLE "CompanyReservation" ADD COLUMN     "assetId" TEXT,
ADD COLUMN     "externalPropertyId" TEXT;

-- CreateTable
CREATE TABLE "CompanyAssetChannel" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "companyChannelId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "externalName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyAssetChannel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyAssetChannel_assetId_idx" ON "CompanyAssetChannel"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyAssetChannel_companyChannelId_externalId_key" ON "CompanyAssetChannel"("companyChannelId", "externalId");

-- CreateIndex
CREATE INDEX "CompanyReservation_externalPropertyId_idx" ON "CompanyReservation"("externalPropertyId");

-- CreateIndex
CREATE INDEX "CompanyReservation_assetId_idx" ON "CompanyReservation"("assetId");

-- AddForeignKey
ALTER TABLE "CompanyReservation" ADD CONSTRAINT "CompanyReservation_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "CompanyAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyAssetChannel" ADD CONSTRAINT "CompanyAssetChannel_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "CompanyAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyAssetChannel" ADD CONSTRAINT "CompanyAssetChannel_companyChannelId_fkey" FOREIGN KEY ("companyChannelId") REFERENCES "CompanyChannel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preenche o id do apartamento nas reservas já importadas. Estava só dentro do
-- `raw`, e é por ele que a reserva se liga ao ativo.
UPDATE "CompanyReservation"
SET "externalPropertyId" = "raw"->'apartment'->>'id'
WHERE "externalPropertyId" IS NULL
  AND "raw"->'apartment'->>'id' IS NOT NULL;
