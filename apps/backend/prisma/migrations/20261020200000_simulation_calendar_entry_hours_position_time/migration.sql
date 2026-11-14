-- AlterTable
ALTER TABLE "SimulationRun" ADD COLUMN     "calendarBestDays" JSONB,
ADD COLUMN     "calendarCards" JSONB,
ADD COLUMN     "calendarDaily" JSONB,
ADD COLUMN     "calendarMonthDay" JSONB,
ADD COLUMN     "calendarStopDays" JSONB,
ADD COLUMN     "calendarWeeks" JSONB,
ADD COLUMN     "durationByWeekday" JSONB,
ADD COLUMN     "entryHourBlocks" JSONB,
ADD COLUMN     "entryHourProfiles" JSONB,
ADD COLUMN     "fundingHours" JSONB,
ADD COLUMN     "positionDuration" JSONB,
ADD COLUMN     "positionHours" JSONB,
ADD COLUMN     "sessionMoments" JSONB;
