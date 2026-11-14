-- CreateTable
CREATE TABLE "Channel" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "logo" TEXT,
    "website" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelCredentialDefinition" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelCredentialDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyChannel" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyChannelCredential" (
    "id" TEXT NOT NULL,
    "companyChannelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'infisical',
    "secretPath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyChannelCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Channel_name_key" ON "Channel"("name");

-- CreateIndex
CREATE INDEX "Channel_moduleId_idx" ON "Channel"("moduleId");

-- CreateIndex
CREATE INDEX "Channel_name_idx" ON "Channel"("name");

-- CreateIndex
CREATE INDEX "ChannelCredentialDefinition_channelId_idx" ON "ChannelCredentialDefinition"("channelId");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelCredentialDefinition_channelId_name_key" ON "ChannelCredentialDefinition"("channelId", "name");

-- CreateIndex
CREATE INDEX "CompanyChannel_companyId_idx" ON "CompanyChannel"("companyId");

-- CreateIndex
CREATE INDEX "CompanyChannel_channelId_idx" ON "CompanyChannel"("channelId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyChannel_companyId_channelId_key" ON "CompanyChannel"("companyId", "channelId");

-- CreateIndex
CREATE INDEX "CompanyChannelCredential_companyChannelId_idx" ON "CompanyChannelCredential"("companyChannelId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyChannelCredential_companyChannelId_name_key" ON "CompanyChannelCredential"("companyChannelId", "name");

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelCredentialDefinition" ADD CONSTRAINT "ChannelCredentialDefinition_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyChannel" ADD CONSTRAINT "CompanyChannel_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyChannel" ADD CONSTRAINT "CompanyChannel_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyChannelCredential" ADD CONSTRAINT "CompanyChannelCredential_companyChannelId_fkey" FOREIGN KEY ("companyChannelId") REFERENCES "CompanyChannel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
