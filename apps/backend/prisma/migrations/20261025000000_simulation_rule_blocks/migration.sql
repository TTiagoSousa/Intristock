-- AlterTable
ALTER TABLE "SimulationRun" ADD COLUMN     "chartLevels" JSONB,
ADD COLUMN     "contextRules" JSONB,
ADD COLUMN     "scaleInStats" JSONB,
ADD COLUMN     "setupFunnel" JSONB,
ADD COLUMN     "stopRuleStats" JSONB;

-- AlterTable
ALTER TABLE "SimulationTrade" ADD COLUMN     "stopMoves" JSONB;
