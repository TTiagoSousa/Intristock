import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaCompanyRepository } from '../repositories/prisma/prisma-company-repository';
import { PrismaCountryRepository } from 'src/country/repositories/prisma/prisma-country-repository';
import { PrismaCurrencyRepository } from 'src/currency/repositories/prisma/prisma-currency-repository';
import { PrismaPlatformRepository } from 'src/platform/repositories/prisma/prisma-platform-repository';
import { CreateCompanyDto } from '../dto/create-company.dto';
import { assertCompanyAccess } from './assertCompanyAccess';
import { generateCompanySlug } from './generateCompanySlug';
import { resolveCompanyCurrencyId } from './resolveCompanyCurrency';

export async function createCompany(
  userId: string,
  dto: CreateCompanyDto,
  companyRepository: PrismaCompanyRepository,
  countryRepository: PrismaCountryRepository,
  currencyRepository: PrismaCurrencyRepository,
  platformRepository: PrismaPlatformRepository,
) {
  // 1. Se houver empresa-mãe, tem de existir, ser tua e estar a trabalhar —
  // pendurar uma filial numa empresa parada ou apagada não faz sentido
  if (dto.parentId) {
    await assertCompanyAccess(userId, dto.parentId, companyRepository, {
      notYours: 'Não podes ligar a uma empresa que não é tua',
      permission: 'owner',
    });
  }

  // 2. Se houver país, tem de existir
  if (dto.countryId) {
    const country = await countryRepository.findById(dto.countryId);

    if (!country) {
      throw new BadRequestException('País inválido');
    }
  }

  // 3. A moeda base: a escolhida, a do país, ou o euro
  const currencyId = await resolveCompanyCurrencyId(
    dto,
    countryRepository,
    currencyRepository,
  );

  // 4. Se vierem contas bancárias, moeda, plataforma e IBAN têm de ser válidos, todos, antes de criar seja o que for
  if (dto.bankAccounts && dto.bankAccounts.length > 0) {
    const ibansInRequest = new Set<string>();

    for (const account of dto.bankAccounts) {
      const currency = await currencyRepository.findById(account.currencyId);

      if (!currency) {
        throw new BadRequestException(
          `Moeda inválida na conta "${account.name}"`,
        );
      }

      const platform = await platformRepository.findById(account.platformId);

      if (!platform) {
        throw new BadRequestException(
          `Plataforma inválida na conta "${account.name}"`,
        );
      }

      if (account.iban) {
        if (ibansInRequest.has(account.iban)) {
          throw new ConflictException(
            `IBAN repetido no pedido: "${account.iban}"`,
          );
        }
        ibansInRequest.add(account.iban);

        const existing = await companyRepository.findBankAccountByIban(
          account.iban,
        );

        if (existing) {
          throw new ConflictException(
            `Já existe uma conta com o IBAN "${account.iban}"`,
          );
        }
      }
    }

    // 5. Criar empresa + contas bancárias juntas, numa transação (tudo ou nada)
    return companyRepository.createWithBankAccounts({
      createdById: userId,
      name: dto.name,
      slug: await generateCompanySlug(dto.name, companyRepository),
      parentId: dto.parentId,
      countryId: dto.countryId,
      currencyId,
      bankAccounts: dto.bankAccounts,
    });
  }

  // 5. Sem contas bancárias — cria só a empresa
  return companyRepository.create({
    createdById: userId,
    name: dto.name,
    slug: await generateCompanySlug(dto.name, companyRepository),
    parentId: dto.parentId,
    countryId: dto.countryId,
    currencyId,
  });
}
