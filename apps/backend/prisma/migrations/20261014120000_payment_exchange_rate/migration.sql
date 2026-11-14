-- Pagamentos noutra moeda: cada pagamento guarda a taxa com que passa para a moeda
-- da empresa. Os que já existem são todos na moeda da empresa (taxa 1, "same").

-- AlterTable
ALTER TABLE "CompanyPayment" ADD COLUMN     "exchangeRate" DECIMAL(65,30) NOT NULL DEFAULT 1,
ADD COLUMN     "rateSource" TEXT NOT NULL DEFAULT 'same';

-- CreateTable
CREATE TABLE "CurrencyRate" (
    "date" DATE NOT NULL,
    "baseCurrencyId" TEXT NOT NULL,
    "quoteCurrencyId" TEXT NOT NULL,
    "rate" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CurrencyRate_pkey" PRIMARY KEY ("date","baseCurrencyId","quoteCurrencyId")
);

-- AddForeignKey
ALTER TABLE "CurrencyRate" ADD CONSTRAINT "CurrencyRate_baseCurrencyId_fkey" FOREIGN KEY ("baseCurrencyId") REFERENCES "Currency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurrencyRate" ADD CONSTRAINT "CurrencyRate_quoteCurrencyId_fkey" FOREIGN KEY ("quoteCurrencyId") REFERENCES "Currency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
