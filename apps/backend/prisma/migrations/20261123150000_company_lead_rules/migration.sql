-- AlterTable
ALTER TABLE "CompanyLead" ADD COLUMN     "appliedRuleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "movedByRuleId" TEXT;

-- AlterTable
ALTER TABLE "CompanyLeadEvent" ADD COLUMN     "ruleId" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "CompanyLeadRule" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "conditions" JSONB NOT NULL DEFAULT '[]',
    "fromStageIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "action" TEXT NOT NULL,
    "stageId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyLeadRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyLeadRule_boardId_position_idx" ON "CompanyLeadRule"("boardId", "position");

-- AddForeignKey
ALTER TABLE "CompanyLeadRule" ADD CONSTRAINT "CompanyLeadRule_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "CompanyLeadBoard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyLeadRule" ADD CONSTRAINT "CompanyLeadRule_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "CompanyLeadStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
