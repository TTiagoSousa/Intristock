-- Remove o módulo de Alojamento Local por inteiro: channels, credenciais,
-- reservas, ativos/imóveis e pessoas. O sistema de módulos fica de pé — só sai
-- a linha do catálogo, no fim.


-- DropForeignKey
ALTER TABLE "Channel" DROP CONSTRAINT "Channel_moduleId_fkey";

-- DropForeignKey
ALTER TABLE "ChannelCredentialDefinition" DROP CONSTRAINT "ChannelCredentialDefinition_channelId_fkey";

-- DropForeignKey
ALTER TABLE "CompanyAsset" DROP CONSTRAINT "CompanyAsset_companyId_fkey";

-- DropForeignKey
ALTER TABLE "CompanyAssetChannel" DROP CONSTRAINT "CompanyAssetChannel_assetId_fkey";

-- DropForeignKey
ALTER TABLE "CompanyAssetChannel" DROP CONSTRAINT "CompanyAssetChannel_companyChannelId_fkey";

-- DropForeignKey
ALTER TABLE "CompanyAssetProperty" DROP CONSTRAINT "CompanyAssetProperty_assetId_fkey";

-- DropForeignKey
ALTER TABLE "CompanyAssetProperty" DROP CONSTRAINT "CompanyAssetProperty_ownerPersonId_fkey";

-- DropForeignKey
ALTER TABLE "CompanyChannel" DROP CONSTRAINT "CompanyChannel_channelId_fkey";

-- DropForeignKey
ALTER TABLE "CompanyChannel" DROP CONSTRAINT "CompanyChannel_companyId_fkey";

-- DropForeignKey
ALTER TABLE "CompanyChannelCredential" DROP CONSTRAINT "CompanyChannelCredential_companyChannelId_fkey";

-- DropForeignKey
ALTER TABLE "CompanyPayment" DROP CONSTRAINT "CompanyPayment_assetId_fkey";

-- DropForeignKey
ALTER TABLE "CompanyPerson" DROP CONSTRAINT "CompanyPerson_companyId_fkey";

-- DropForeignKey
ALTER TABLE "CompanyPerson" DROP CONSTRAINT "CompanyPerson_userId_fkey";

-- DropForeignKey
ALTER TABLE "CompanyReservation" DROP CONSTRAINT "CompanyReservation_assetId_fkey";

-- DropForeignKey
ALTER TABLE "CompanyReservation" DROP CONSTRAINT "CompanyReservation_companyChannelId_fkey";

-- DropForeignKey
ALTER TABLE "CompanyReservation" DROP CONSTRAINT "CompanyReservation_companyId_fkey";

-- DropIndex
DROP INDEX "CompanyPayment_accrualDate_idx";

-- DropIndex
DROP INDEX "CompanyPayment_assetId_idx";

-- AlterTable
ALTER TABLE "CompanyPayment" DROP COLUMN "accrualDate",
DROP COLUMN "assetId",
DROP COLUMN "isOwnerCost";

-- DropTable
DROP TABLE "Channel";

-- DropTable
DROP TABLE "ChannelCredentialDefinition";

-- DropTable
DROP TABLE "CompanyAsset";

-- DropTable
DROP TABLE "CompanyAssetChannel";

-- DropTable
DROP TABLE "CompanyAssetProperty";

-- DropTable
DROP TABLE "CompanyChannel";

-- DropTable
DROP TABLE "CompanyChannelCredential";

-- DropTable
DROP TABLE "CompanyPerson";

-- DropTable
DROP TABLE "CompanyReservation";

-- Só agora é que a linha do catálogo pode sair: enquanto a tabela Channel
-- existisse, a FK Channel_moduleId_fkey (RESTRICT) impedia apagar o módulo.
-- As empresas que o tinham ativo perdem a ligação primeiro.
DELETE FROM "CompanyModule"
WHERE "moduleId" IN (SELECT "id" FROM "Module" WHERE "name" = 'local-accommodation');

DELETE FROM "Module" WHERE "name" = 'local-accommodation';
