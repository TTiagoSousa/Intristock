-- CreateTable
CREATE TABLE "CompanyLeadBoard" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "tableId" TEXT,
    "viewId" TEXT,
    "filters" JSONB NOT NULL DEFAULT '[]',
    "search" TEXT,
    "only" TEXT,
    "phoneColumn" TEXT,
    "titleColumn" TEXT,
    "cardColumns" JSONB NOT NULL DEFAULT '[]',
    "position" INTEGER NOT NULL DEFAULT 0,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyLeadBoard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyLeadStage" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "isEntry" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CompanyLeadStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyLead" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "rowKey" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "position" DOUBLE PRECISION NOT NULL,
    "assignedToId" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyLeadComment" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" TIMESTAMP(3),

    CONSTRAINT "CompanyLeadComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyLeadEvent" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fromStageId" TEXT,
    "toStageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyLeadEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyLeadBoard_companyId_idx" ON "CompanyLeadBoard"("companyId");

-- CreateIndex
CREATE INDEX "CompanyLeadBoard_tableId_idx" ON "CompanyLeadBoard"("tableId");

-- CreateIndex
CREATE INDEX "CompanyLeadBoard_viewId_idx" ON "CompanyLeadBoard"("viewId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyLeadBoard_companyId_name_key" ON "CompanyLeadBoard"("companyId", "name");

-- CreateIndex
CREATE INDEX "CompanyLeadStage_boardId_position_idx" ON "CompanyLeadStage"("boardId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyLeadStage_boardId_name_key" ON "CompanyLeadStage"("boardId", "name");

-- CreateIndex
CREATE INDEX "CompanyLead_boardId_stageId_position_idx" ON "CompanyLead"("boardId", "stageId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyLead_boardId_rowKey_key" ON "CompanyLead"("boardId", "rowKey");

-- CreateIndex
CREATE INDEX "CompanyLeadComment_leadId_createdAt_idx" ON "CompanyLeadComment"("leadId", "createdAt");

-- CreateIndex
CREATE INDEX "CompanyLeadEvent_leadId_createdAt_idx" ON "CompanyLeadEvent"("leadId", "createdAt");

-- AddForeignKey
ALTER TABLE "CompanyLeadBoard" ADD CONSTRAINT "CompanyLeadBoard_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyLeadBoard" ADD CONSTRAINT "CompanyLeadBoard_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "CompanyDataTable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyLeadBoard" ADD CONSTRAINT "CompanyLeadBoard_viewId_fkey" FOREIGN KEY ("viewId") REFERENCES "CompanyDataView"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyLeadStage" ADD CONSTRAINT "CompanyLeadStage_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "CompanyLeadBoard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyLead" ADD CONSTRAINT "CompanyLead_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "CompanyLeadBoard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyLead" ADD CONSTRAINT "CompanyLead_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "CompanyLeadStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyLeadComment" ADD CONSTRAINT "CompanyLeadComment_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "CompanyLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyLeadEvent" ADD CONSTRAINT "CompanyLeadEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "CompanyLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
