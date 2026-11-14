-- AlterTable
ALTER TABLE "SimulationRun" ADD COLUMN     "orderExecution" JSONB,
ADD COLUMN     "orderTypes" JSONB,
ADD COLUMN     "orderVariants" JSONB;
