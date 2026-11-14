import { NotFoundException } from '@nestjs/common';
import {
  FindReportQueryDto,
  REPORT_BLOCKS,
} from '../dto/find-report-query.dto';
import { PrismaSimulationRepository } from '../repositories/prisma/prisma-simulation-repository';

// Os blocos do relatório de uma simulação, só os pedidos (sem eles, todos), já
// calculados pelo simulador: o ecrã e uma IA leem-nos tal como vêm
export async function findSimulationReport(
  userId: string,
  id: string,
  query: FindReportQueryDto,
  repository: PrismaSimulationRepository,
) {
  const blocks = query.blocks?.length ? query.blocks : [...REPORT_BLOCKS];
  const report = await repository.findReport(id, userId, blocks);
  if (!report) throw new NotFoundException('Simulação não encontrada');
  return report;
}
