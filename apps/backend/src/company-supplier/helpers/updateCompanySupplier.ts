import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaCompanySupplierRepository } from '../repositories/prisma/prisma-company-supplier-repository';
import { assertCompanyAccess } from 'src/company/helpers/assertCompanyAccess';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { PrismaCountryRepository } from 'src/country/repositories/prisma/prisma-country-repository';
import { PrismaCurrencyRepository } from 'src/currency/repositories/prisma/prisma-currency-repository';
import { PrismaBankAccountRepository } from 'src/bank-account/repositories/prisma/prisma-bank-account-repository';
import { PrismaCompanySupplierGroupRepository } from 'src/company-supplier-group/repositories/prisma/prisma-company-supplier-group-repository';
import { UpdateCompanySupplierDto } from '../dto/update-company-supplier.dto';
import { generateSupplierSlug } from './generateSupplierSlug';

export async function updateCompanySupplier(
  userId: string,
  companyId: string,
  supplierId: string,
  dto: UpdateCompanySupplierDto,
  companySupplierRepository: PrismaCompanySupplierRepository,
  companyRepository: PrismaCompanyRepository,
  countryRepository: PrismaCountryRepository,
  currencyRepository: PrismaCurrencyRepository,
  bankAccountRepository: PrismaBankAccountRepository,
  companySupplierGroupRepository: PrismaCompanySupplierGroupRepository,
) {
  // 1. A empresa tem de existir e pertencer a quem está a pedir
  await assertCompanyAccess(userId, companyId, companyRepository, {
    notYours: 'Não podes editar fornecedores de uma empresa que não é tua',
    permission: 'suppliers.edit',
  });

  // 2. O fornecedor tem de existir e ser mesmo desta empresa
  const supplier = await companySupplierRepository.findById(supplierId);

  if (!supplier || supplier.companyId !== companyId) {
    throw new NotFoundException('Fornecedor não encontrado');
  }

  // 3. Se houver país, tem de existir
  if (dto.countryId) {
    const country = await countryRepository.findById(dto.countryId);

    if (!country) {
      throw new BadRequestException('País inválido');
    }
  }

  // 4. Se houver moeda, tem de existir
  if (dto.currencyId) {
    const currency = await currencyRepository.findById(dto.currencyId);

    if (!currency) {
      throw new BadRequestException('Moeda inválida');
    }
  }

  // 5. Pagamento direto não leva conta associada. O método pode não vir no body,
  // por isso vale o que vier ou, na falta dele, o que o fornecedor já tinha
  const paymentMethod = dto.paymentMethod ?? supplier.paymentMethod;
  const bankAccountId =
    dto.bankAccountId !== undefined
      ? dto.bankAccountId
      : supplier.bankAccountId;

  if (paymentMethod === 'direct' && bankAccountId) {
    throw new BadRequestException(
      'Um fornecedor de pagamento direto não pode ter conta bancária',
    );
  }

  // 6. Se houver conta bancária, tem de existir e ser da mesma empresa
  if (dto.bankAccountId) {
    const bankAccount = await bankAccountRepository.findById(dto.bankAccountId);

    if (!bankAccount) {
      throw new BadRequestException('Conta bancária inválida');
    }

    if (bankAccount.companyId !== companyId) {
      throw new BadRequestException(
        'A conta bancária não pertence a esta empresa',
      );
    }
  }

  // 7. Se houver grupo, tem de existir e ser da mesma empresa
  if (dto.groupId) {
    const group = await companySupplierGroupRepository.findById(dto.groupId);

    if (!group || group.companyId !== companyId) {
      throw new BadRequestException('Grupo inválido');
    }
  }

  // 8. Um nome novo muda o slug do URL com ele
  const slug =
    dto.name !== undefined && dto.name !== supplier.name
      ? await generateSupplierSlug(
          companyId,
          dto.name,
          companySupplierRepository,
          supplierId,
        )
      : undefined;

  // 9. Atualizar
  return companySupplierRepository.update(supplierId, { ...dto, slug });
}
