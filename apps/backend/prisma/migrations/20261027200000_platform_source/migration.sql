-- AlterTable
ALTER TABLE "Platform" ADD COLUMN     "details" JSONB,
ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'manual',
ADD COLUMN     "syncedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Platform_source_externalId_key" ON "Platform"("source", "externalId");

-- As do catálogo pré-definido (systemCatalog.ts) passam a dizer que vieram dele
UPDATE "Platform" SET "source" = 'system' WHERE "name" IN ('Caixa Geral de Depósitos', 'Millennium bcp', 'Santander', 'novobanco', 'BPI', 'Banco Montepio', 'Crédito Agrícola', 'ActivoBank', 'Banco CTT', 'Bankinter', 'CTT', 'Revolut', 'Wise', 'N26', 'Trade Republic', 'Interactive Brokers', 'DEGIRO', 'XTB', 'eToro', 'Binance', 'Kraken', 'Coinbase');
