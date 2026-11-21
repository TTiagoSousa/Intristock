import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { PrismaCompanySupplierRepository } from 'src/company-supplier/repositories/prisma/prisma-company-supplier-repository';
import { generateSupplierSlug } from 'src/company-supplier/helpers/generateSupplierSlug';
import { PrismaTimeTrackingRepository } from '../repositories/prisma/prisma-time-tracking-repository';
import { UpdateTimeTrackingClientDto } from '../dto/time-tracking.dto';
import { assertTimesheetAccess } from './assertTimesheetAccess';

/**
 * O que um cliente da app é aqui: o cliente (fornecedor) da empresa a que se liga — um que já
 * existe, ou um novo com o nome dele (`createSupplier`, particular ou empresa, de pagamento
 * direto) —, o preço por hora que vale mais que o da app, como se cobra e a retenção.
 */
export async function updateTimeTrackingClient(
  userId: string,
  companyId: string,
  clientId: string,
  dto: UpdateTimeTrackingClientDto,
  repository: PrismaTimeTrackingRepository,
  companyRepository: PrismaCompanyRepository,
  supplierRepository: PrismaCompanySupplierRepository,
) {
  await assertTimesheetAccess(userId, companyId, companyRepository, true);
  const client = await repository.findClient(companyId, clientId);
  if (!client) throw new NotFoundException('Cliente não encontrado');
  if (dto.createSupplier && dto.supplierId)
    throw new BadRequestException('Escolhe um cliente da empresa ou cria um novo, não os dois');

  let supplierId = dto.supplierId;
  if (supplierId && !(await repository.findSupplier(companyId, supplierId)))
    throw new BadRequestException('Esse cliente não é desta empresa');
  if (dto.createSupplier) {
    const slug = await generateSupplierSlug(companyId, client.name, supplierRepository);
    const supplier = await supplierRepository.create({
      companyId,
      name: client.name,
      slug,
      type: dto.createSupplier,
      // Um cliente não tem conta para onde se lhe paga
      paymentMethod: 'direct',
    });
    supplierId = supplier.id;
  }

  await repository.updateClient(clientId, {
    supplierId,
    hourlyRate: dto.hourlyRate,
    billing: dto.billing,
    withholdingPct: dto.withholdingPct,
  });
  return { updated: true };
}
