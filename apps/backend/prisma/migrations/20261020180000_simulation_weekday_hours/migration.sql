-- AlterTable
ALTER TABLE "SimulationRun" ADD COLUMN     "weekdayHourPnl" JSONB,
ADD COLUMN     "weekdayHourStops" JSONB,
ADD COLUMN     "weekdayHourTrades" JSONB,
ADD COLUMN     "weekdayHourWinRate" JSONB;
