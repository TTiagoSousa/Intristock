-- Employee.firstName: add nullable, backfill from fullName, then enforce NOT NULL
ALTER TABLE "Employee" ADD COLUMN "firstName" TEXT;
UPDATE "Employee" SET "firstName" = split_part("fullName", ' ', 1) WHERE "firstName" IS NULL;
ALTER TABLE "Employee" ALTER COLUMN "firstName" SET NOT NULL;

-- JobType.updatedAt: add nullable, backfill from createdAt, then enforce NOT NULL
ALTER TABLE "JobType" ADD COLUMN "updatedAt" TIMESTAMP(3);
UPDATE "JobType" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;
ALTER TABLE "JobType" ALTER COLUMN "updatedAt" SET NOT NULL;

-- Company.userId -> createdById (table is empty, safe to drop+add)
ALTER TABLE "Company" DROP CONSTRAINT "Company_userId_fkey";
DROP INDEX "Company_userId_idx";
ALTER TABLE "Company" DROP COLUMN "userId",
ADD COLUMN     "createdById" TEXT NOT NULL;

-- BankAccount: drop bankName, add platformId (table is empty, safe)
ALTER TABLE "BankAccount" DROP COLUMN "bankName",
ADD COLUMN     "platformId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Platform" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "logo" TEXT,
    "website" TEXT,
    "countryId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Platform_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Platform_type_idx" ON "Platform"("type");

-- CreateIndex
CREATE INDEX "Platform_countryId_idx" ON "Platform"("countryId");

-- CreateIndex
CREATE UNIQUE INDEX "BankAccount_iban_key" ON "BankAccount"("iban");

-- CreateIndex
CREATE INDEX "BankAccount_platformId_idx" ON "BankAccount"("platformId");

-- CreateIndex
CREATE INDEX "Company_createdById_idx" ON "Company"("createdById");

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Platform" ADD CONSTRAINT "Platform_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "Platform"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
