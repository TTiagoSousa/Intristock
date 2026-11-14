-- CreateTable
CREATE TABLE "LiveTest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "strategy" JSONB NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "dataFromDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "state" JSONB,
    "memory" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "LiveTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveTestEvent" (
    "id" BIGSERIAL NOT NULL,
    "testId" TEXT NOT NULL,
    "time" TIMESTAMP(3) NOT NULL,
    "kind" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveTestEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LiveTest_userId_createdAt_idx" ON "LiveTest"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "LiveTest_runId_createdAt_idx" ON "LiveTest"("runId", "createdAt");

-- CreateIndex
CREATE INDEX "LiveTest_status_idx" ON "LiveTest"("status");

-- CreateIndex
CREATE INDEX "LiveTestEvent_testId_time_idx" ON "LiveTestEvent"("testId", "time");

-- CreateIndex
CREATE INDEX "LiveTestEvent_testId_kind_time_idx" ON "LiveTestEvent"("testId", "kind", "time");

-- AddForeignKey
ALTER TABLE "LiveTest" ADD CONSTRAINT "LiveTest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveTest" ADD CONSTRAINT "LiveTest_runId_fkey" FOREIGN KEY ("runId") REFERENCES "SimulationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveTest" ADD CONSTRAINT "LiveTest_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveTestEvent" ADD CONSTRAINT "LiveTestEvent_testId_fkey" FOREIGN KEY ("testId") REFERENCES "LiveTest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
