-- AlterTable
ALTER TABLE "SimulationRun" ADD COLUMN     "exitHourEntries" JSONB,
ADD COLUMN     "exitHourStops" JSONB,
ADD COLUMN     "exitHourWins" JSONB,
ADD COLUMN     "exitHours" JSONB;
