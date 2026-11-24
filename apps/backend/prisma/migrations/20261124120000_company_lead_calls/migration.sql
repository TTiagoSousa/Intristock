-- AlterTable
ALTER TABLE "CompanyLead" ADD COLUMN     "assignedAt" TIMESTAMP(3),
ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "callbackAt" TIMESTAMP(3),
ADD COLUMN     "callbackNote" TEXT,
ADD COLUMN     "lastCallAt" TIMESTAMP(3),
ADD COLUMN     "lastOutcomeId" TEXT,
ADD COLUMN     "stageEnteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "CompanyLeadRule" ADD COLUMN     "assignCursor" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "assigneeIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "leadConditions" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "CompanyLeadStage" ADD COLUMN     "cardLimit" INTEGER;

-- CreateTable
CREATE TABLE "CompanyLeadOutcome" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stageId" TEXT,
    "answered" BOOLEAN NOT NULL DEFAULT false,
    "countsAsAttempt" BOOLEAN NOT NULL DEFAULT true,
    "asksCallback" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CompanyLeadOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyLeadCall" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "outcomeId" TEXT,
    "outcomeName" TEXT NOT NULL,
    "answered" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyLeadCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyDataConnection" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "credentials" TEXT NOT NULL,
    "mapping" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'active',
    "syncEveryHours" INTEGER NOT NULL DEFAULT 1,
    "cursor" TEXT,
    "lastError" TEXT,
    "syncedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyDataConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyLeadOutcome_boardId_position_idx" ON "CompanyLeadOutcome"("boardId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyLeadOutcome_boardId_name_key" ON "CompanyLeadOutcome"("boardId", "name");

-- CreateIndex
CREATE INDEX "CompanyLeadCall_boardId_createdAt_idx" ON "CompanyLeadCall"("boardId", "createdAt");

-- CreateIndex
CREATE INDEX "CompanyLeadCall_userId_createdAt_idx" ON "CompanyLeadCall"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "CompanyLeadCall_leadId_createdAt_idx" ON "CompanyLeadCall"("leadId", "createdAt");

-- CreateIndex
CREATE INDEX "CompanyDataConnection_companyId_idx" ON "CompanyDataConnection"("companyId");

-- CreateIndex
CREATE INDEX "CompanyDataConnection_tableId_idx" ON "CompanyDataConnection"("tableId");

-- CreateIndex
CREATE INDEX "CompanyLead_boardId_assignedToId_idx" ON "CompanyLead"("boardId", "assignedToId");

-- CreateIndex
CREATE INDEX "CompanyLead_boardId_callbackAt_idx" ON "CompanyLead"("boardId", "callbackAt");

-- AddForeignKey
ALTER TABLE "CompanyLeadOutcome" ADD CONSTRAINT "CompanyLeadOutcome_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "CompanyLeadBoard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyLeadOutcome" ADD CONSTRAINT "CompanyLeadOutcome_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "CompanyLeadStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyLeadCall" ADD CONSTRAINT "CompanyLeadCall_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "CompanyLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyLeadCall" ADD CONSTRAINT "CompanyLeadCall_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "CompanyLeadOutcome"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyDataConnection" ADD CONSTRAINT "CompanyDataConnection_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyDataConnection" ADD CONSTRAINT "CompanyDataConnection_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "CompanyDataTable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- As leads que já existem: desde a última vez que mudaram de coluna (ou desde que foram criadas)
UPDATE "CompanyLead" l SET "stageEnteredAt" = COALESCE(
  (SELECT MAX(e."createdAt") FROM "CompanyLeadEvent" e WHERE e."leadId" = l."id" AND e."kind" = 'moved'),
  l."createdAt"
);

-- Os botões de resultado das secções que já existem (para as colunas com o nome de origem, se ainda lá estiverem)
INSERT INTO "CompanyLeadOutcome" ("id", "boardId", "name", "stageId", "answered", "countsAsAttempt", "asksCallback", "position")
SELECT gen_random_uuid()::text, b."id", o."name",
  (SELECT s."id" FROM "CompanyLeadStage" s WHERE s."boardId" = b."id" AND s."name" = o."stage" LIMIT 1),
  o."answered", TRUE, o."asksCallback", o."position"
FROM "CompanyLeadBoard" b
CROSS JOIN (VALUES
  ('Atendeu', 'Atendeu', TRUE, FALSE, 0),
  ('Não atendeu', 'Não atendeu', FALSE, TRUE, 1),
  ('Caixa de correio', 'Não atendeu', FALSE, TRUE, 2),
  ('Número errado', 'Não quer', FALSE, FALSE, 3)
) AS o("name", "stage", "answered", "asksCallback", "position");
