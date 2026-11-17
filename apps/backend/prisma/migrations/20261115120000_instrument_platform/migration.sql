-- AlterTable
ALTER TABLE "Instrument" ADD COLUMN     "platformId" TEXT;

-- CreateIndex
CREATE INDEX "Instrument_platformId_idx" ON "Instrument"("platformId");

-- AddForeignKey
ALTER TABLE "Instrument" ADD CONSTRAINT "Instrument_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "Platform"("id") ON DELETE SET NULL ON UPDATE CASCADE;
