-- CreateTable
CREATE TABLE "Currency" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortCode" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "precision" INTEGER NOT NULL,
    "subunit" INTEGER NOT NULL,
    "symbol" TEXT NOT NULL,
    "symbolFirst" BOOLEAN NOT NULL,
    "decimalMark" TEXT NOT NULL,
    "thousandsSeparator" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Currency_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Currency_shortCode_key" ON "Currency"("shortCode");

-- CreateIndex
CREATE INDEX "Currency_shortCode_idx" ON "Currency"("shortCode");
