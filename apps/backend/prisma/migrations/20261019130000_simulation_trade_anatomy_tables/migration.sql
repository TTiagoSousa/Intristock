-- AlterTable
ALTER TABLE "SimulationRun" ADD COLUMN     "exitEfficiency" JSONB,
ADD COLUMN     "nextTrade" JSONB,
ADD COLUMN     "tradeGroups" JSONB,
ADD COLUMN     "tradePath" JSONB;
