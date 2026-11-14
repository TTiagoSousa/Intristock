-- Slug do item, para o URL da página do item

-- AlterTable: o slug entra opcional, é preenchido em baixo e só depois fica obrigatório
ALTER TABLE "CompanyItem" ADD COLUMN     "slug" TEXT;

-- Slug dos itens que já existem, a partir do nome e como o backend o faz: sem
-- acentos, minúsculas, o resto vira "-". O nome já é único na empresa, mas dois
-- nomes podem dar o mesmo slug ("PLA 1.75" e "PLA-1-75"): o segundo leva
-- contador. "new-item" é o URL de criar e fica reservado.
DO $$
DECLARE
  item RECORD;
  base TEXT;
  candidate TEXT;
  counter INT;
BEGIN
  FOR item IN SELECT "id", "companyId", "name" FROM "CompanyItem" ORDER BY "createdAt", "id" LOOP
    base := lower(translate(
      item."name",
      'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
      'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'
    ));
    base := regexp_replace(regexp_replace(base, '[^a-z0-9]+', '-', 'g'), '^-+|-+$', '', 'g');
    IF base = '' THEN
      base := 'item';
    END IF;

    candidate := base;
    counter := 2;

    WHILE candidate = 'new-item' OR EXISTS (
      SELECT 1 FROM "CompanyItem"
      WHERE "companyId" = item."companyId" AND "slug" = candidate
    ) LOOP
      candidate := base || '-' || counter;
      counter := counter + 1;
    END LOOP;

    UPDATE "CompanyItem" SET "slug" = candidate WHERE "id" = item."id";
  END LOOP;
END $$;

ALTER TABLE "CompanyItem" ALTER COLUMN "slug" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "CompanyItem_companyId_slug_key" ON "CompanyItem"("companyId", "slug");
