import { BadRequestException } from '@nestjs/common';
import { assertCompanyAccess, CompanyAccessPermission } from 'src/company/helpers/assertCompanyAccess';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { PrismaCurrencyRepository } from 'src/currency/repositories/prisma/prisma-currency-repository';
import { PrismaCompanyItemRepository } from 'src/company-item/repositories/prisma/prisma-company-item-repository';
import { PrismaCompanyAssetRepository } from '../repositories/prisma/prisma-company-asset-repository';

// Mesma regra do resto da app: o dono pode tudo, um membro o que o cargo lhe dá
export async function assertCompanyOwnership(
  userId: string,
  companyId: string,
  companyRepository: PrismaCompanyRepository,
  // O que é preciso (`assertCompanyAccess`): ver lê, o resto grava
  permission: CompanyAccessPermission,
) {
  return assertCompanyAccess(userId, companyId, companyRepository, {
    notYours: 'Não podes gerir os ativos de uma empresa que não é tua',
    permission,
  });
}

// O que vem por referência tem de existir e ser desta empresa
export async function assertAssetRelations(
  companyId: string,
  dto: { currencyId?: string; itemId?: string; paymentId?: string },
  currencyRepository: PrismaCurrencyRepository,
  itemRepository: PrismaCompanyItemRepository,
  assetRepository: PrismaCompanyAssetRepository,
) {
  if (dto.currencyId) {
    const currency = await currencyRepository.findById(dto.currencyId);

    if (!currency) {
      throw new BadRequestException('Moeda inválida');
    }
  }

  if (dto.itemId) {
    const item = await itemRepository.findById(dto.itemId);

    if (!item) {
      throw new BadRequestException('Item inválido');
    }

    if (item.companyId !== companyId) {
      throw new BadRequestException('O item não pertence a esta empresa');
    }
  }

  // A compra de origem é opcional — um ativo pode ser anterior à empresa — mas
  // se vier tem de ser uma compra desta empresa.
  //
  // A verificação vive no repositório dos ativos e não no dos pagamentos: o
  // `company-payment` já importa o `company-asset` (para recusar apagar uma
  // compra que criou ativos), e importar ao contrário fechava um ciclo de
  // módulos. Uma mensagem só para as duas situações, que também evita dizer a
  // quem tenta se o id existe noutra empresa.
  if (dto.paymentId) {
    const payment = await assetRepository.findPaymentInCompany(
      dto.paymentId,
      companyId,
    );

    if (!payment) {
      throw new BadRequestException('Compra inválida');
    }
  }
}
