-- AlterTable
ALTER TABLE "CompanyChannel" ADD COLUMN     "lastSyncCount" INTEGER,
ADD COLUMN     "lastSyncMessage" TEXT,
ADD COLUMN     "lastSyncStatus" TEXT,
ADD COLUMN     "lastSyncedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CompanyReservation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "companyChannelId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "arrival" DATE NOT NULL,
    "departure" DATE NOT NULL,
    "guestName" TEXT,
    "guestEmail" TEXT,
    "guestPhone" TEXT,
    "adults" INTEGER,
    "children" INTEGER,
    "propertyName" TEXT,
    "sourceChannel" TEXT,
    "totalPrice" DECIMAL(65,30),
    "currency" TEXT,
    "notes" TEXT,
    "raw" JSONB NOT NULL,
    "externalCreatedAt" TIMESTAMP(3),
    "externalUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyReservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyReservation_companyId_idx" ON "CompanyReservation"("companyId");

-- CreateIndex
CREATE INDEX "CompanyReservation_companyChannelId_idx" ON "CompanyReservation"("companyChannelId");

-- CreateIndex
CREATE INDEX "CompanyReservation_arrival_idx" ON "CompanyReservation"("arrival");

-- CreateIndex
CREATE INDEX "CompanyReservation_status_idx" ON "CompanyReservation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyReservation_companyChannelId_externalId_key" ON "CompanyReservation"("companyChannelId", "externalId");

-- AddForeignKey
ALTER TABLE "CompanyReservation" ADD CONSTRAINT "CompanyReservation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyReservation" ADD CONSTRAINT "CompanyReservation_companyChannelId_fkey" FOREIGN KEY ("companyChannelId") REFERENCES "CompanyChannel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
