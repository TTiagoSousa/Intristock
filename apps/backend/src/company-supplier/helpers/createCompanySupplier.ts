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
import { CreateCompanySupplierDto } from '../dto/create-company-supplier.dto';
import { generateSupplierSlug } from './generateSupplierSlug';

export async function createCompanySupplier(
  userId: string,
  companyId: string,
  dto: CreateCompanySupplierDto,
  companySupplierRepository: PrismaCompanySupplierRepository,
  companyRepository: PrismaCompanyRepository,
  countryRepository: PrismaCountryRepository,
  currencyRepository: PrismaCurrencyRepository,
  bankAccountRepository: PrismaBankAccountRepository,
  companySupplierGroupRepository: PrismaCompanySupplierGroupRepository,
) {
  // 1. A empresa tem de existir e pertencer a quem está a pedir
  await assertCompanyAccess(userId, companyId, companyRepository, {
    notYours: 'Não podes criar fornecedores numa empresa que não é tua',
    permission: 'suppliers.create',
  });

  // 2. Se houver país, tem de existir
  if (dto.countryId) {
    const country = await countryRepository.findById(dto.countryId);

    if (!country) {
      throw new BadRequestException('País inválido');
    }
  }

  // 3. Se houver moeda, tem de existir
  if (dto.currencyId) {
    const currency = await currencyRepository.findById(dto.currencyId);

    if (!currency) {
      throw new BadRequestException('Moeda inválida');
    }
  }

  // 4. Pagamento direto (subscrição/plataforma) não leva conta associada
  if (dto.paymentMethod === 'direct' && dto.bankAccountId) {
    throw new BadRequestException(
      'Um fornecedor de pagamento direto não pode ter conta bancária',
    );
  }

  // 5. Se houver conta bancária, tem de existir e ser da mesma empresa
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

  // 6. Se houver grupo, tem de existir e ser da mesma empresa
  if (dto.groupId) {
    const group = await companySupplierGroupRepository.findById(dto.groupId);

    if (!group || group.companyId !== companyId) {
      throw new BadRequestException('Grupo inválido');
    }
  }

  // 7. Criar, com o slug do URL feito a partir do nome
  const slug = await generateSupplierSlug(
    companyId,
    dto.name,
    companySupplierRepository,
  );

  return companySupplierRepository.create({ ...dto, companyId, slug });
}
