-- CreateTable
CREATE TABLE "TimeTrackingConnection" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "apiToken" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "organizationName" TEXT NOT NULL,
    "currencyId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "syncEveryHours" INTEGER NOT NULL DEFAULT 1,
    "lastError" TEXT,
    "syncedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimeTrackingConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeTrackingClient" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "supplierId" TEXT,
    "hourlyRate" DECIMAL(65,30),
    "billing" TEXT NOT NULL DEFAULT 'freelance',
    "withholdingPct" DECIMAL(65,30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimeTrackingClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeTrackingProject" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "clientId" TEXT,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "billableRate" DECIMAL(65,30),
    "isBillable" BOOLEAN NOT NULL DEFAULT true,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TimeTrackingProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeTrackingPerson" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "billableRate" DECIMAL(65,30),
    "memberId" TEXT,
    "userId" TEXT,

    CONSTRAINT "TimeTrackingPerson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeTrackingEntry" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "projectId" TEXT,
    "clientId" TEXT,
    "personId" TEXT,
    "start" TIMESTAMPTZ NOT NULL,
    "end" TIMESTAMPTZ,
    "seconds" INTEGER NOT NULL,
    "description" TEXT,
    "billable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimeTrackingEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeTrackingSettlement" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "memberId" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'range',
    "fromDate" DATE,
    "toDate" DATE,
    "seconds" INTEGER NOT NULL,
    "hourlyRate" DECIMAL(65,30) NOT NULL,
    "grossAmount" DECIMAL(65,30) NOT NULL,
    "withholdingPct" DECIMAL(65,30),
    "netAmount" DECIMAL(65,30) NOT NULL,
    "currencyId" TEXT NOT NULL,
    "paidAt" DATE NOT NULL,
    "companyPaymentId" TEXT,
    "personalIncomeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimeTrackingSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeTrackingAllocation" (
    "id" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "seconds" INTEGER NOT NULL,

    CONSTRAINT "TimeTrackingAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TimeTrackingConnection_currencyId_idx" ON "TimeTrackingConnection"("currencyId");

-- CreateIndex
CREATE UNIQUE INDEX "TimeTrackingConnection_companyId_provider_baseUrl_organizat_key" ON "TimeTrackingConnection"("companyId", "provider", "baseUrl", "organizationId");

-- CreateIndex
CREATE INDEX "TimeTrackingClient_supplierId_idx" ON "TimeTrackingClient"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "TimeTrackingClient_connectionId_externalId_key" ON "TimeTrackingClient"("connectionId", "externalId");

-- CreateIndex
CREATE INDEX "TimeTrackingProject_clientId_idx" ON "TimeTrackingProject"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "TimeTrackingProject_connectionId_externalId_key" ON "TimeTrackingProject"("connectionId", "externalId");

-- CreateIndex
CREATE INDEX "TimeTrackingPerson_memberId_idx" ON "TimeTrackingPerson"("memberId");

-- CreateIndex
CREATE INDEX "TimeTrackingPerson_userId_idx" ON "TimeTrackingPerson"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TimeTrackingPerson_connectionId_externalId_key" ON "TimeTrackingPerson"("connectionId", "externalId");

-- CreateIndex
CREATE INDEX "TimeTrackingEntry_clientId_start_idx" ON "TimeTrackingEntry"("clientId", "start");

-- CreateIndex
CREATE INDEX "TimeTrackingEntry_personId_start_idx" ON "TimeTrackingEntry"("personId", "start");

-- CreateIndex
CREATE UNIQUE INDEX "TimeTrackingEntry_connectionId_externalId_key" ON "TimeTrackingEntry"("connectionId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "TimeTrackingSettlement_companyPaymentId_key" ON "TimeTrackingSettlement"("companyPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "TimeTrackingSettlement_personalIncomeId_key" ON "TimeTrackingSettlement"("personalIncomeId");

-- CreateIndex
CREATE INDEX "TimeTrackingSettlement_companyId_paidAt_idx" ON "TimeTrackingSettlement"("companyId", "paidAt");

-- CreateIndex
CREATE INDEX "TimeTrackingSettlement_clientId_idx" ON "TimeTrackingSettlement"("clientId");

-- CreateIndex
CREATE INDEX "TimeTrackingSettlement_memberId_idx" ON "TimeTrackingSettlement"("memberId");

-- CreateIndex
CREATE INDEX "TimeTrackingAllocation_entryId_idx" ON "TimeTrackingAllocation"("entryId");

-- CreateIndex
CREATE UNIQUE INDEX "TimeTrackingAllocation_settlementId_entryId_key" ON "TimeTrackingAllocation"("settlementId", "entryId");

-- AddForeignKey
ALTER TABLE "TimeTrackingConnection" ADD CONSTRAINT "TimeTrackingConnection_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeTrackingConnection" ADD CONSTRAINT "TimeTrackingConnection_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeTrackingClient" ADD CONSTRAINT "TimeTrackingClient_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "TimeTrackingConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeTrackingClient" ADD CONSTRAINT "TimeTrackingClient_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "CompanySupplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeTrackingProject" ADD CONSTRAINT "TimeTrackingProject_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "TimeTrackingConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeTrackingProject" ADD CONSTRAINT "TimeTrackingProject_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "TimeTrackingClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeTrackingPerson" ADD CONSTRAINT "TimeTrackingPerson_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "TimeTrackingConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeTrackingPerson" ADD CONSTRAINT "TimeTrackingPerson_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "CompanyMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeTrackingPerson" ADD CONSTRAINT "TimeTrackingPerson_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeTrackingEntry" ADD CONSTRAINT "TimeTrackingEntry_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "TimeTrackingConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeTrackingEntry" ADD CONSTRAINT "TimeTrackingEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "TimeTrackingProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeTrackingEntry" ADD CONSTRAINT "TimeTrackingEntry_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "TimeTrackingClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeTrackingEntry" ADD CONSTRAINT "TimeTrackingEntry_personId_fkey" FOREIGN KEY ("personId") REFERENCES "TimeTrackingPerson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeTrackingSettlement" ADD CONSTRAINT "TimeTrackingSettlement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeTrackingSettlement" ADD CONSTRAINT "TimeTrackingSettlement_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "TimeTrackingClient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeTrackingSettlement" ADD CONSTRAINT "TimeTrackingSettlement_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "CompanyMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeTrackingSettlement" ADD CONSTRAINT "TimeTrackingSettlement_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeTrackingSettlement" ADD CONSTRAINT "TimeTrackingSettlement_companyPaymentId_fkey" FOREIGN KEY ("companyPaymentId") REFERENCES "CompanyPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeTrackingSettlement" ADD CONSTRAINT "TimeTrackingSettlement_personalIncomeId_fkey" FOREIGN KEY ("personalIncomeId") REFERENCES "PersonalIncome"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeTrackingAllocation" ADD CONSTRAINT "TimeTrackingAllocation_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "TimeTrackingSettlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeTrackingAllocation" ADD CONSTRAINT "TimeTrackingAllocation_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "TimeTrackingEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- O banco de horas faz parte da empresa, não é um módulo: tira-se do catálogo dos módulos
DELETE FROM "CompanyModule" WHERE "moduleId" IN (SELECT "id" FROM "Module" WHERE "name" = 'time_tracking');
DELETE FROM "Module" WHERE "name" = 'time_tracking';
