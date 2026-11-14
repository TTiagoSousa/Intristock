-- DropForeignKey
ALTER TABLE "CompanyMember" DROP CONSTRAINT "CompanyMember_userId_fkey";

-- AlterTable
ALTER TABLE "CompanyMember" ADD COLUMN     "addressLine" TEXT,
ADD COLUMN     "bankAccountId" TEXT,
ADD COLUMN     "birthDate" DATE,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "countryId" TEXT,
ADD COLUMN     "currencyId" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "iban" TEXT,
ADD COLUMN     "idDocumentNumber" TEXT,
ADD COLUMN     "jobTitle" TEXT,
ADD COLUMN     "name" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "socialSecurityNumber" TEXT,
ADD COLUMN     "taxNumber" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "CompanyPayment" ADD COLUMN     "memberId" TEXT,
ADD COLUMN     "memberPayId" TEXT,
ADD COLUMN     "memberPayPeriod" TEXT;

-- CreateTable
CREATE TABLE "CompanyMemberPay" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "contractId" TEXT,
    "kind" TEXT NOT NULL,
    "description" TEXT,
    "grossAmount" DECIMAL(65,30) NOT NULL,
    "paymentsPerYear" INTEGER,
    "payDay" INTEGER,
    "startDate" DATE,
    "endDate" DATE,
    "dueDate" DATE,
    "withholdingPct" DECIMAL(65,30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyMemberPay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyMemberContract" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyMemberContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyMemberDocument" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "contractId" TEXT,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "storageProvider" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyMemberDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyMemberPay_memberId_idx" ON "CompanyMemberPay"("memberId");

-- CreateIndex
CREATE INDEX "CompanyMemberPay_contractId_idx" ON "CompanyMemberPay"("contractId");

-- CreateIndex
CREATE INDEX "CompanyMemberContract_memberId_idx" ON "CompanyMemberContract"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyMemberDocument_storageKey_key" ON "CompanyMemberDocument"("storageKey");

-- CreateIndex
CREATE INDEX "CompanyMemberDocument_memberId_idx" ON "CompanyMemberDocument"("memberId");

-- CreateIndex
CREATE INDEX "CompanyMemberDocument_contractId_idx" ON "CompanyMemberDocument"("contractId");

-- CreateIndex
CREATE INDEX "CompanyMember_countryId_idx" ON "CompanyMember"("countryId");

-- CreateIndex
CREATE INDEX "CompanyMember_currencyId_idx" ON "CompanyMember"("currencyId");

-- CreateIndex
CREATE INDEX "CompanyMember_bankAccountId_idx" ON "CompanyMember"("bankAccountId");

-- CreateIndex
CREATE INDEX "CompanyPayment_memberId_idx" ON "CompanyPayment"("memberId");

-- CreateIndex
CREATE INDEX "CompanyPayment_memberPayId_memberPayPeriod_idx" ON "CompanyPayment"("memberPayId", "memberPayPeriod");

-- AddForeignKey
ALTER TABLE "CompanyMember" ADD CONSTRAINT "CompanyMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyMember" ADD CONSTRAINT "CompanyMember_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyMember" ADD CONSTRAINT "CompanyMember_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyMember" ADD CONSTRAINT "CompanyMember_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyMemberPay" ADD CONSTRAINT "CompanyMemberPay_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "CompanyMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyMemberPay" ADD CONSTRAINT "CompanyMemberPay_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "CompanyMemberContract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyMemberContract" ADD CONSTRAINT "CompanyMemberContract_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "CompanyMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyMemberDocument" ADD CONSTRAINT "CompanyMemberDocument_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "CompanyMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyMemberDocument" ADD CONSTRAINT "CompanyMemberDocument_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "CompanyMemberContract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyPayment" ADD CONSTRAINT "CompanyPayment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "CompanyMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyPayment" ADD CONSTRAINT "CompanyPayment_memberPayId_fkey" FOREIGN KEY ("memberPayId") REFERENCES "CompanyMemberPay"("id") ON DELETE SET NULL ON UPDATE CASCADE;
