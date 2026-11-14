-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "assetClass" TEXT NOT NULL,
    "subClass" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ticker" TEXT,
    "isin" TEXT,
    "country" TEXT,
    "ownerUserId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Instrument" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "venue" TEXT,
    "quote" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Instrument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketDataMonth" (
    "instrumentId" TEXT NOT NULL,
    "month" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "candles" INTEGER,
    "error" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketDataMonth_pkey" PRIMARY KEY ("instrumentId","month")
);

-- CreateTable
CREATE TABLE "MarketDataDownload" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "fromDate" TIMESTAMP(3) NOT NULL,
    "toDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "monthsTotal" INTEGER NOT NULL DEFAULT 0,
    "monthsDone" INTEGER NOT NULL DEFAULT 0,
    "currentMonth" TIMESTAMP(3),
    "candles" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "MarketDataDownload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Asset_assetClass_subClass_idx" ON "Asset"("assetClass", "subClass");

-- CreateIndex
CREATE INDEX "Asset_subClass_ticker_idx" ON "Asset"("subClass", "ticker");

-- CreateIndex
CREATE INDEX "Asset_ownerUserId_idx" ON "Asset"("ownerUserId");

-- CreateIndex
CREATE INDEX "Instrument_assetId_idx" ON "Instrument"("assetId");

-- CreateIndex
CREATE INDEX "Instrument_status_type_quote_idx" ON "Instrument"("status", "type", "quote");

-- CreateIndex
CREATE UNIQUE INDEX "Instrument_source_type_symbol_key" ON "Instrument"("source", "type", "symbol");

-- CreateIndex
CREATE INDEX "MarketDataDownload_status_createdAt_idx" ON "MarketDataDownload"("status", "createdAt");

-- CreateIndex
CREATE INDEX "MarketDataDownload_userId_createdAt_idx" ON "MarketDataDownload"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Instrument" ADD CONSTRAINT "Instrument_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketDataMonth" ADD CONSTRAINT "MarketDataMonth_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketDataDownload" ADD CONSTRAINT "MarketDataDownload_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketDataDownload" ADD CONSTRAINT "MarketDataDownload_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
