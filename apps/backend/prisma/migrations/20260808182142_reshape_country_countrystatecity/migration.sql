-- Country only held disposable data from an internal sync test, safe to wipe before reshaping
DELETE FROM "Country";

-- DropForeignKey
ALTER TABLE "Country" DROP CONSTRAINT "Country_currencyId_fkey";

-- DropIndex
DROP INDEX "Country_code_idx";

-- DropIndex
DROP INDEX "Country_code_key";

-- DropIndex
DROP INDEX "Country_currencyId_idx";

-- DropIndex
DROP INDEX "Country_name_idx";

-- DropIndex
DROP INDEX "Country_name_key";

-- AlterTable
ALTER TABLE "Country" DROP COLUMN "code",
DROP COLUMN "currencyId",
ADD COLUMN     "apiId" TEXT NOT NULL,
ADD COLUMN     "capital" TEXT,
ADD COLUMN     "currency" TEXT NOT NULL,
ADD COLUMN     "emoji" TEXT,
ADD COLUMN     "iso2" TEXT NOT NULL,
ADD COLUMN     "iso3" TEXT NOT NULL,
ADD COLUMN     "native" TEXT,
ADD COLUMN     "phonecode" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Country_apiId_key" ON "Country"("apiId");

-- CreateIndex
CREATE UNIQUE INDEX "Country_iso2_key" ON "Country"("iso2");

-- CreateIndex
CREATE UNIQUE INDEX "Country_iso3_key" ON "Country"("iso3");

-- CreateIndex
CREATE INDEX "Country_iso2_idx" ON "Country"("iso2");

-- CreateIndex
CREATE INDEX "Country_iso3_idx" ON "Country"("iso3");
