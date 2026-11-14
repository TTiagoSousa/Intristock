-- DropIndex
DROP INDEX "CompanyAsset_companyId_name_key";

-- AlterTable
ALTER TABLE "CompanyAssetProperty" ADD COLUMN     "building" TEXT;
