-- Cotações diárias, moeda base da empresa e moeda do movimento de stock.
--
-- Escrita à mão porque três destas colunas são NOT NULL em tabelas que já têm
-- linhas: entram nullable, levam backfill e só depois apanham a constraint.

-- ---------------------------------------------------------------------------
-- 1. Histórico de cotações
-- ---------------------------------------------------------------------------
CREATE TABLE "CurrencyRate" (
    "id" TEXT NOT NULL,
    "currencyId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CurrencyRate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CurrencyRate_currencyId_date_key" ON "CurrencyRate"("currencyId", "date");
CREATE INDEX "CurrencyRate_date_idx" ON "CurrencyRate"("date");

ALTER TABLE "CurrencyRate" ADD CONSTRAINT "CurrencyRate_currencyId_fkey"
    FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 2. Moeda base da empresa — nullable, backfill a euros, depois NOT NULL
-- ---------------------------------------------------------------------------
ALTER TABLE "Company" ADD COLUMN "currencyId" TEXT;

UPDATE "Company"
SET "currencyId" = (SELECT "id" FROM "Currency" WHERE "shortCode" = 'EUR' LIMIT 1)
WHERE "currencyId" IS NULL;

-- Numa base vazia não há empresas e o UPDATE acima não mexe em nada. Numa base
-- com empresas mas sem o euro, o NOT NULL abaixo rebentava com uma mensagem que
-- não explicava porquê — mais vale dizê-lo aqui.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM "Company" WHERE "currencyId" IS NULL) THEN
        RAISE EXCEPTION 'Não há moeda EUR na tabela Currency para servir de base às empresas existentes. Corre o seed antes desta migration.';
    END IF;
END $$;

ALTER TABLE "Company" ALTER COLUMN "currencyId" SET NOT NULL;

CREATE INDEX "Company_currencyId_idx" ON "Company"("currencyId");

ALTER TABLE "Company" ADD CONSTRAINT "Company_currencyId_fkey"
    FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 3. Moeda do movimento de stock
--
-- Os movimentos que vieram de uma compra herdam a moeda dela; os manuais ficam
-- com a moeda base da empresa, que é a suposição menos errada para um custo
-- escrito à mão antes de a moeda existir sequer como campo.
-- ---------------------------------------------------------------------------
ALTER TABLE "CompanyStockMovement" ADD COLUMN "currencyId" TEXT;

UPDATE "CompanyStockMovement" m
SET "currencyId" = p."currencyId"
FROM "CompanyPayment" p
WHERE m."paymentId" = p."id" AND m."currencyId" IS NULL;

UPDATE "CompanyStockMovement" m
SET "currencyId" = c."currencyId"
FROM "Company" c
WHERE m."companyId" = c."id" AND m."currencyId" IS NULL;

ALTER TABLE "CompanyStockMovement" ALTER COLUMN "currencyId" SET NOT NULL;

CREATE INDEX "CompanyStockMovement_currencyId_idx" ON "CompanyStockMovement"("currencyId");

ALTER TABLE "CompanyStockMovement" ADD CONSTRAINT "CompanyStockMovement_currencyId_fkey"
    FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
