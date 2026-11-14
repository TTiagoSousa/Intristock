-- AlterTable
ALTER TABLE "SimulationRun" ADD COLUMN     "propChallenge" JSONB,
ADD COLUMN     "propWindows" JSONB;

-- AlterTable
ALTER TABLE "SimulationTrade" ADD COLUMN     "partials" JSONB;
