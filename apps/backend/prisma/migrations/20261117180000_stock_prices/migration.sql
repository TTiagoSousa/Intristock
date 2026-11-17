-- AlterTable
ALTER TABLE "Instrument" ADD COLUMN     "priceInstrumentId" TEXT;

-- AlterTable
ALTER TABLE "PersonalPortfolioTransaction" ADD COLUMN     "instrumentId" TEXT;

-- CreateTable
CREATE TABLE "InstrumentPrice" (
    "instrumentId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "close" DECIMAL(65,30) NOT NULL,
    "adjClose" DECIMAL(65,30),

    CONSTRAINT "InstrumentPrice_pkey" PRIMARY KEY ("instrumentId","date")
);

-- CreateIndex
CREATE INDEX "PersonalPortfolioTransaction_instrumentId_idx" ON "PersonalPortfolioTransaction"("instrumentId");

-- AddForeignKey
ALTER TABLE "Instrument" ADD CONSTRAINT "Instrument_priceInstrumentId_fkey" FOREIGN KEY ("priceInstrumentId") REFERENCES "Instrument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstrumentPrice" ADD CONSTRAINT "InstrumentPrice_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalPortfolioTransaction" ADD CONSTRAINT "PersonalPortfolioTransaction_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
