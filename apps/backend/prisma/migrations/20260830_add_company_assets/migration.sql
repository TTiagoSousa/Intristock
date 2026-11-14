-- CreateTable
CREATE TABLE "CompanyPerson" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "taxId" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyPerson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyAsset" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "reference" TEXT,
    "type" TEXT NOT NULL DEFAULT 'property',
    "ownershipType" TEXT NOT NULL DEFAULT 'owned',
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyAssetProperty" (
    "assetId" TEXT NOT NULL,
    "ownerPersonId" TEXT,
    "usageType" TEXT NOT NULL DEFAULT 'local_accommodation',
    "alRegistrationNumber" TEXT,
    "address" TEXT,
    "city" TEXT,
    "postalCode" TEXT,
    "maxOccupancy" INTEGER,
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "channelData" JSONB,

    CONSTRAINT "CompanyAssetProperty_pkey" PRIMARY KEY ("assetId")
);

-- CreateIndex
CREATE INDEX "CompanyPerson_companyId_idx" ON "CompanyPerson"("companyId");

-- CreateIndex
CREATE INDEX "CompanyPerson_userId_idx" ON "CompanyPerson"("userId");

-- CreateIndex
CREATE INDEX "CompanyAsset_companyId_idx" ON "CompanyAsset"("companyId");

-- CreateIndex
CREATE INDEX "CompanyAsset_type_idx" ON "CompanyAsset"("type");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyAsset_companyId_name_key" ON "CompanyAsset"("companyId", "name");

-- CreateIndex
CREATE INDEX "CompanyAssetProperty_ownerPersonId_idx" ON "CompanyAssetProperty"("ownerPersonId");

-- CreateIndex
CREATE INDEX "CompanyAssetProperty_usageType_idx" ON "CompanyAssetProperty"("usageType");

-- AddForeignKey
ALTER TABLE "CompanyPerson" ADD CONSTRAINT "CompanyPerson_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyPerson" ADD CONSTRAINT "CompanyPerson_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyAsset" ADD CONSTRAINT "CompanyAsset_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyAssetProperty" ADD CONSTRAINT "CompanyAssetProperty_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "CompanyAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyAssetProperty" ADD CONSTRAINT "CompanyAssetProperty_ownerPersonId_fkey" FOREIGN KEY ("ownerPersonId") REFERENCES "CompanyPerson"("id") ON DELETE SET NULL ON UPDATE CASCADE;
