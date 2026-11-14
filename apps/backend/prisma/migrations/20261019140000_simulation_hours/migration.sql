-- AlterTable
ALTER TABLE "SimulationRun" ADD COLUMN     "hourCards" JSONB,
ADD COLUMN     "hourEntries" JSONB,
ADD COLUMN     "hourPnl" JSONB,
ADD COLUMN     "hourStops" JSONB;
