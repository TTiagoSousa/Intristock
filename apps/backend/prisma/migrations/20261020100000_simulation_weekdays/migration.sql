-- AlterTable
ALTER TABLE "SimulationRun" ADD COLUMN     "weekdayCards" JSONB,
ADD COLUMN     "weekdayEntries" JSONB,
ADD COLUMN     "weekdayEntryPnl" JSONB,
ADD COLUMN     "weekdayEntryStops" JSONB,
ADD COLUMN     "weekdayEntryWins" JSONB,
ADD COLUMN     "weekdayPnl" JSONB,
ADD COLUMN     "weekdayStops" JSONB,
ADD COLUMN     "weekdayTable" JSONB;
