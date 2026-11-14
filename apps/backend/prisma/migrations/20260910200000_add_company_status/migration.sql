-- Estado da empresa: a trabalhar, parada, ou apagada pelo dono.
--
-- Apagar não apaga nada: a empresa sai da vista e das rotas, mas fica cá. É a
-- única forma de um clique errado não levar anos de contabilidade atrás — para
-- a repor, o dono tem de falar com o suporte.
ALTER TABLE "Company" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "Company" ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "Company_status_idx" ON "Company"("status");
