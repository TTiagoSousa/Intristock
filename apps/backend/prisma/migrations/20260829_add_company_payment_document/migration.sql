-- CreateTable
CREATE TABLE "CompanyPaymentDocument" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "storageProvider" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyPaymentDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyPaymentDocument_storageKey_key" ON "CompanyPaymentDocument"("storageKey");

-- CreateIndex
CREATE INDEX "CompanyPaymentDocument_paymentId_idx" ON "CompanyPaymentDocument"("paymentId");

-- AddForeignKey
ALTER TABLE "CompanyPaymentDocument" ADD CONSTRAINT "CompanyPaymentDocument_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "CompanyPayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
