-- CreateTable
CREATE TABLE "CompanyDataTable" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'file',
    "columns" JSONB NOT NULL,
    "keyColumn" TEXT,
    "importConfig" JSONB,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyDataTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyDataRow" (
    "id" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "key" TEXT,
    "data" JSONB NOT NULL,
    "importId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyDataRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyDataImport" (
    "id" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "created" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "unchanged" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyDataImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyDataView" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "leftTableId" TEXT NOT NULL,
    "rightTableId" TEXT NOT NULL,
    "joinOn" JSONB NOT NULL,
    "joinType" TEXT NOT NULL DEFAULT 'left',
    "columns" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyDataView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyDataTable_companyId_idx" ON "CompanyDataTable"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyDataTable_companyId_name_key" ON "CompanyDataTable"("companyId", "name");

-- CreateIndex
CREATE INDEX "CompanyDataRow_tableId_idx" ON "CompanyDataRow"("tableId");

-- CreateIndex
CREATE INDEX "CompanyDataRow_data_idx" ON "CompanyDataRow" USING GIN ("data" jsonb_path_ops);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyDataRow_tableId_key_key" ON "CompanyDataRow"("tableId", "key");

-- CreateIndex
CREATE INDEX "CompanyDataImport_tableId_createdAt_idx" ON "CompanyDataImport"("tableId", "createdAt");

-- CreateIndex
CREATE INDEX "CompanyDataView_companyId_idx" ON "CompanyDataView"("companyId");

-- CreateIndex
CREATE INDEX "CompanyDataView_leftTableId_idx" ON "CompanyDataView"("leftTableId");

-- CreateIndex
CREATE INDEX "CompanyDataView_rightTableId_idx" ON "CompanyDataView"("rightTableId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyDataView_companyId_name_key" ON "CompanyDataView"("companyId", "name");

-- AddForeignKey
ALTER TABLE "CompanyDataTable" ADD CONSTRAINT "CompanyDataTable_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyDataRow" ADD CONSTRAINT "CompanyDataRow_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "CompanyDataTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyDataRow" ADD CONSTRAINT "CompanyDataRow_importId_fkey" FOREIGN KEY ("importId") REFERENCES "CompanyDataImport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyDataImport" ADD CONSTRAINT "CompanyDataImport_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "CompanyDataTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyDataView" ADD CONSTRAINT "CompanyDataView_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyDataView" ADD CONSTRAINT "CompanyDataView_leftTableId_fkey" FOREIGN KEY ("leftTableId") REFERENCES "CompanyDataTable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyDataView" ADD CONSTRAINT "CompanyDataView_rightTableId_fkey" FOREIGN KEY ("rightTableId") REFERENCES "CompanyDataTable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
