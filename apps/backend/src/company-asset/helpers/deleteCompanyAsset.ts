import { NotFoundException } from '@nestjs/common';
import { PrismaCompanyAssetRepository } from '../repositories/prisma/prisma-company-asset-repository';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { assertCompanyOwnership } from './assertAssetInput';

export async function deleteCompanyAsset(
  userId: string,
  companyId: string,
  assetId: string,
  assetRepository: PrismaCompanyAssetRepository,
  companyRepository: PrismaCompanyRepository,
) {
  await assertCompanyOwnership(userId, companyId, companyRepository, 'assets.delete');

  const asset = await assetRepository.findById(assetId);

  if (!asset || asset.companyId !== companyId) {
    throw new NotFoundException('Ativo não encontrado');
  }

  // Ao contrário dos itens, apagar um ativo não parte histórico nenhum: a
  // compra que o originou continua lá, e o `paymentId` fica a `null`.
  // Para tirar de circulação sem perder o registo, usa-se o estado `abatido`.
  await assetRepository.delete(assetId);
}
