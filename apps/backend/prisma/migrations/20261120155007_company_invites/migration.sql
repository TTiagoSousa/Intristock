-- AlterTable
ALTER TABLE "CompanyMember" ADD COLUMN     "invitedAt" TIMESTAMP(3),
ADD COLUMN     "invitedById" TEXT,
ADD COLUMN     "respondedAt" TIMESTAMP(3),
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'active';

-- AlterTable
ALTER TABLE "CompanyMemberPay" ADD COLUMN     "proposedById" TEXT,
ADD COLUMN     "replacesId" TEXT,
ADD COLUMN     "respondedAt" TIMESTAMP(3),
ADD COLUMN     "responseNote" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'accepted';

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "actionStatus" TEXT;

-- CreateIndex
CREATE INDEX "CompanyMember_userId_status_idx" ON "CompanyMember"("userId", "status");

-- CreateIndex
CREATE INDEX "CompanyMemberPay_replacesId_idx" ON "CompanyMemberPay"("replacesId");

-- AddForeignKey
ALTER TABLE "CompanyMember" ADD CONSTRAINT "CompanyMember_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyMemberPay" ADD CONSTRAINT "CompanyMemberPay_proposedById_fkey" FOREIGN KEY ("proposedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyMemberPay" ADD CONSTRAINT "CompanyMemberPay_replacesId_fkey" FOREIGN KEY ("replacesId") REFERENCES "CompanyMemberPay"("id") ON DELETE SET NULL ON UPDATE CASCADE;
