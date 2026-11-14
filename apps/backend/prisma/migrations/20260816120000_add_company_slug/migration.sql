-- AlterTable: adicionar nullable primeiro, para poder preencher as empresas já existentes
ALTER TABLE "Company" ADD COLUMN "slug" TEXT;

-- Backfill: slug a partir do nome (minúsculas, tudo o que não é alfanumérico vira "-")
UPDATE "Company"
SET "slug" = trim(both '-' from lower(regexp_replace("name", '[^a-zA-Z0-9]+', '-', 'g')));

-- Nomes que não produzem nenhum caracter útil (ex. só símbolos) ficam com um base genérico
UPDATE "Company"
SET "slug" = 'empresa'
WHERE "slug" IS NULL OR "slug" = '';

-- Desempate: se dois nomes geraram o mesmo slug, os seguintes levam sufixo do id
WITH duplicates AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (PARTITION BY "slug" ORDER BY "createdAt") AS row_number
  FROM "Company"
)
UPDATE "Company" c
SET "slug" = c."slug" || '-' || substring(c."id" from 1 for 8)
FROM duplicates d
WHERE c."id" = d."id" AND d.row_number > 1;

-- Agora que todas as linhas têm valor único, aplicar as constraints
ALTER TABLE "Company" ALTER COLUMN "slug" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");

-- CreateIndex
CREATE INDEX "Company_slug_idx" ON "Company"("slug");
