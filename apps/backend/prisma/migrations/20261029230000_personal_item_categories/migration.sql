-- DropForeignKey
ALTER TABLE "PersonalExpenseItem" DROP CONSTRAINT "PersonalExpenseItem_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "PersonalProduct" DROP CONSTRAINT "PersonalProduct_categoryId_fkey";

-- DropIndex
DROP INDEX "PersonalExpenseItem_categoryId_idx";

-- AlterTable
ALTER TABLE "PersonalExpenseItem" DROP COLUMN "categoryId";

-- CreateTable
CREATE TABLE "PersonalItemCategory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalItemCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PersonalItemCategory_userId_idx" ON "PersonalItemCategory"("userId");

-- CreateIndex
CREATE INDEX "PersonalItemCategory_parentId_idx" ON "PersonalItemCategory"("parentId");

-- AddForeignKey
ALTER TABLE "PersonalItemCategory" ADD CONSTRAINT "PersonalItemCategory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalItemCategory" ADD CONSTRAINT "PersonalItemCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "PersonalItemCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- As categorias dos produtos passam a ser as de item: as antigas saem
UPDATE "PersonalProduct" SET "categoryId" = NULL;

-- AddForeignKey
ALTER TABLE "PersonalProduct" ADD CONSTRAINT "PersonalProduct_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "PersonalItemCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
