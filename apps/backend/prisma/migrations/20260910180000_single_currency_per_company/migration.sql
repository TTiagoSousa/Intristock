-- A empresa passa a trabalhar exclusivamente na sua moeda.
--
-- Cai por terra a conversão entre moedas: o histórico de cotações deixa de ser
-- preciso, e o custo de um movimento de stock está sempre na moeda da empresa,
-- por isso a coluna que dizia qual era passa a ser redundante.
--
-- A `Company.currencyId` fica — é ela a moeda escolhida.

-- ---------------------------------------------------------------------------
-- 1. Sem conversão, não há histórico de cotações a guardar
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS "CurrencyRate";

-- ---------------------------------------------------------------------------
-- 2. O custo de um movimento é sempre na moeda da empresa
-- ---------------------------------------------------------------------------
ALTER TABLE "CompanyStockMovement" DROP CONSTRAINT IF EXISTS "CompanyStockMovement_currencyId_fkey";
DROP INDEX IF EXISTS "CompanyStockMovement_currencyId_idx";
ALTER TABLE "CompanyStockMovement" DROP COLUMN IF EXISTS "currencyId";

-- ---------------------------------------------------------------------------
-- 3. Alinhar o que já lá está com a regra nova
--
-- Havia um ativo gravado em dólares cujo pagamento de origem era em euros —
-- criado à mão, num formulário que obrigava a escolher a moeda e não sugeria
-- nenhuma. Com a empresa a trabalhar só na sua moeda, um ativo noutra deixa de
-- poder existir.
-- ---------------------------------------------------------------------------
UPDATE "CompanyAsset" a
SET "currencyId" = c."currencyId"
FROM "Company" c
WHERE a."companyId" = c."id" AND a."currencyId" <> c."currencyId";

UPDATE "CompanyPayment" p
SET "currencyId" = c."currencyId"
FROM "Company" c
WHERE p."companyId" = c."id" AND p."currencyId" <> c."currencyId";
