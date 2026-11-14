-- Um item passa a poder ter vários fornecedores: a ligação sai da coluna
-- CompanyItem.supplierId para a tabela CompanyItemSupplier

-- CreateTable
CREATE TABLE "CompanyItemSupplier" (
    "itemId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyItemSupplier_pkey" PRIMARY KEY ("itemId","supplierId")
);

-- O fornecedor que cada item já tinha passa para a tabela nova antes de a
-- coluna sair — nenhuma ligação se perde
INSERT INTO "CompanyItemSupplier" ("itemId", "supplierId", "createdAt")
SELECT "id", "supplierId", "createdAt" FROM "CompanyItem" WHERE "supplierId" IS NOT NULL;

-- CreateIndex
CREATE INDEX "CompanyItemSupplier_supplierId_idx" ON "CompanyItemSupplier"("supplierId");

-- AddForeignKey
ALTER TABLE "CompanyItemSupplier" ADD CONSTRAINT "CompanyItemSupplier_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "CompanyItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyItemSupplier" ADD CONSTRAINT "CompanyItemSupplier_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "CompanySupplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropForeignKey
ALTER TABLE "CompanyItem" DROP CONSTRAINT "CompanyItem_supplierId_fkey";

-- DropIndex
DROP INDEX "CompanyItem_supplierId_idx";

-- AlterTable
ALTER TABLE "CompanyItem" DROP COLUMN "supplierId";
