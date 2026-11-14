-- AlterTable
ALTER TABLE "SimulationRun" ADD COLUMN     "costStress" JSONB,
ADD COLUMN     "monteCarloCards" JSONB,
ADD COLUMN     "monteCarloDrawdowns" JSONB,
ADD COLUMN     "monteCarloFan" JSONB,
ADD COLUMN     "performanceCurve" JSONB,
ADD COLUMN     "regimeGrid" JSONB,
ADD COLUMN     "regimeTable" JSONB,
ADD COLUMN     "sensitivityGrid" JSONB,
ADD COLUMN     "sensitivityParams" JSONB,
ADD COLUMN     "sourceRunId" TEXT,
ADD COLUMN     "verdicts" JSONB,
ADD COLUMN     "walkForward" JSONB,
ADD COLUMN     "walkForwardCards" JSONB;

-- CreateIndex
CREATE INDEX "SimulationRun_sourceRunId_idx" ON "SimulationRun"("sourceRunId");

-- AddForeignKey
ALTER TABLE "SimulationRun" ADD CONSTRAINT "SimulationRun_sourceRunId_fkey" FOREIGN KEY ("sourceRunId") REFERENCES "SimulationRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
