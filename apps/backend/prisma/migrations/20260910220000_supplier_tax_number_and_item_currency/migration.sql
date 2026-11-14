-- Dois campos que diziam a coisa errada.
--
-- 1. `CompanySupplier.taxId` é o número de contribuinte do fornecedor e nunca
--    foi FK nenhuma. Ao lado do `CompanyPaymentTax.taxId`, que é FK a sério,
--    eram dois campos com o mesmo nome e significados diferentes.
ALTER TABLE "CompanySupplier" RENAME COLUMN "taxId" TO "taxNumber";

-- 2. `CompanyItem.currencyId` só podia ter um valor desde que a empresa passou
--    a trabalhar exclusivamente na moeda dela: o preço de catálogo é nessa
--    moeda, como tudo o resto. Um campo que só admite uma resposta é ruído.
ALTER TABLE "CompanyItem" DROP CONSTRAINT IF EXISTS "CompanyItem_currencyId_fkey";
DROP INDEX IF EXISTS "CompanyItem_currencyId_idx";
ALTER TABLE "CompanyItem" DROP COLUMN IF EXISTS "currencyId";
