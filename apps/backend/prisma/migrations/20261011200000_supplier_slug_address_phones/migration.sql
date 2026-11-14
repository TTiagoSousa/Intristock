-- Morada, slug e telefones extra do fornecedor

-- AlterTable: o slug entra opcional, é preenchido em baixo e só depois fica obrigatório
ALTER TABLE "CompanySupplier" ADD COLUMN     "addressLine" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "slug" TEXT;

-- Slug dos fornecedores que já existem, a partir do nome e como o backend o faz:
-- sem acentos, minúsculas, o resto vira "-". Repetidos dentro da mesma empresa
-- levam contador ("iq-capital", "iq-capital-2"); "new-supplier" é o URL de criar
-- e fica reservado.
DO $$
DECLARE
  supplier RECORD;
  base TEXT;
  candidate TEXT;
  counter INT;
BEGIN
  FOR supplier IN SELECT "id", "companyId", "name" FROM "CompanySupplier" ORDER BY "createdAt", "id" LOOP
    base := lower(translate(
      supplier."name",
      'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
      'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'
    ));
    base := regexp_replace(regexp_replace(base, '[^a-z0-9]+', '-', 'g'), '^-+|-+$', '', 'g');
    IF base = '' THEN
      base := 'fornecedor';
    END IF;

    candidate := base;
    counter := 2;

    WHILE candidate = 'new-supplier' OR EXISTS (
      SELECT 1 FROM "CompanySupplier"
      WHERE "companyId" = supplier."companyId" AND "slug" = candidate
    ) LOOP
      candidate := base || '-' || counter;
      counter := counter + 1;
    END LOOP;

    UPDATE "CompanySupplier" SET "slug" = candidate WHERE "id" = supplier."id";
  END LOOP;
END $$;

ALTER TABLE "CompanySupplier" ALTER COLUMN "slug" SET NOT NULL;

-- CreateTable
CREATE TABLE "CompanySupplierPhone" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "label" TEXT,
    "number" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanySupplierPhone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanySupplierPhone_supplierId_idx" ON "CompanySupplierPhone"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanySupplier_companyId_slug_key" ON "CompanySupplier"("companyId", "slug");

-- AddForeignKey
ALTER TABLE "CompanySupplierPhone" ADD CONSTRAINT "CompanySupplierPhone_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "CompanySupplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
