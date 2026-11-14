/*
  Warnings:

  - You are about to drop the `Simulation` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Simulation" DROP CONSTRAINT "Simulation_calculatorId_fkey";

-- DropForeignKey
ALTER TABLE "Simulation" DROP CONSTRAINT "Simulation_userId_fkey";

-- DropTable
DROP TABLE "Simulation";

-- CreateTable
CREATE TABLE "CalculatorSimulation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "calculatorId" TEXT NOT NULL,
    "inputs" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalculatorSimulation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CalculatorSimulation_userId_idx" ON "CalculatorSimulation"("userId");

-- CreateIndex
CREATE INDEX "CalculatorSimulation_calculatorId_idx" ON "CalculatorSimulation"("calculatorId");

-- AddForeignKey
ALTER TABLE "CalculatorSimulation" ADD CONSTRAINT "CalculatorSimulation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalculatorSimulation" ADD CONSTRAINT "CalculatorSimulation_calculatorId_fkey" FOREIGN KEY ("calculatorId") REFERENCES "Calculator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
