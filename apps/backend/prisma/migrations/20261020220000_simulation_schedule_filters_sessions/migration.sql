-- AlterTable
ALTER TABLE "SimulationRun" ADD COLUMN     "gapCards" JSONB,
ADD COLUMN     "gapDaily" JSONB,
ADD COLUMN     "hourFilterBest" JSONB,
ADD COLUMN     "hourFilterWorst" JSONB,
ADD COLUMN     "hourFilters" JSONB,
ADD COLUMN     "passageGroups" JSONB,
ADD COLUMN     "sessionEdges" JSONB,
ADD COLUMN     "sessionRules" JSONB,
ADD COLUMN     "workHours" JSONB,
ADD COLUMN     "worldSessions" JSONB;
