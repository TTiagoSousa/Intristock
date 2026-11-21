-- AlterTable
ALTER TABLE "TimeTrackingSettlement" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "personId" TEXT,
ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE INDEX "TimeTrackingSettlement_personId_idx" ON "TimeTrackingSettlement"("personId");

-- CreateIndex
CREATE INDEX "TimeTrackingSettlement_userId_idx" ON "TimeTrackingSettlement"("userId");

-- AddForeignKey
ALTER TABLE "TimeTrackingSettlement" ADD CONSTRAINT "TimeTrackingSettlement_personId_fkey" FOREIGN KEY ("personId") REFERENCES "TimeTrackingPerson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeTrackingSettlement" ADD CONSTRAINT "TimeTrackingSettlement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
