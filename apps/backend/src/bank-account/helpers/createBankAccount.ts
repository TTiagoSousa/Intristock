import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaBankAccountRepository } from '../repositories/prisma/prisma-bank-account-repository';
import { assertCompanyAccess } from 'src/company/helpers/assertCompanyAccess';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { PrismaCurrencyRepository } from 'src/currency/repositories/prisma/prisma-currency-repository';
import { PrismaPlatformRepository } from 'src/platform/repositories/prisma/prisma-platform-repository';
import { CreateBankAccountDto } from '../dto/create-bank-account.dto';

export async function createBankAccount(
  userId: string,
  dto: CreateBankAccountDto,
  bankAccountRepository: PrismaBankAccountRepository,
  companyRepository: PrismaCompanyRepository,
  currencyRepository: PrismaCurrencyRepository,
  platformRepository: PrismaPlatformRepository,
) {
  // 1. A moeda tem sempre de existir
  const currency = await currencyRepository.findById(dto.currencyId);

  if (!currency) {
    throw new BadRequestException('Moeda inválida');
  }

  // 2. A plataforma (banco/broker/exchange/postal) tem sempre de existir
  const platform = await platformRepository.findById(dto.platformId);

  if (!platform) {
    throw new BadRequestException('Plataforma inválida');
  }

  // 3. userId OU companyId — nunca os dois, nunca nenhum.
  // Se vier companyId, a conta pertence à empresa (e não diretamente ao user).
  // Se não vier, a conta pertence ao user autenticado.
  let ownerCompanyId: string | undefined;
  let ownerUserId: string | undefined;

  if (dto.companyId) {
    await assertCompanyAccess(userId, dto.companyId, companyRepository, {
      notYours: 'Não podes criar uma conta bancária numa empresa que não é tua',
      permission: 'settings.edit',
    });

    ownerCompanyId = dto.companyId;
  } else {
    ownerUserId = userId;
  }

  // 4. O IBAN, se vier, é único entre as contas do mesmo dono (depois do acesso: quem
  // não é da empresa não fica a saber que IBAN ela tem)
  if (dto.iban) {
    const existing = await bankAccountRepository.findByOwnerIban(
      { userId: ownerUserId, companyId: ownerCompanyId },
      dto.iban,
    );

    if (existing) {
      throw new ConflictException(ownerCompanyId ? 'A empresa já tem uma conta com este IBAN' : 'Já tens uma conta com este IBAN');
    }
  }

  // 5. Criar
  return bankAccountRepository.create({
    userId: ownerUserId,
    companyId: ownerCompanyId,
    name: dto.name,
    iban: dto.iban,
    currencyId: dto.currencyId,
    platformId: dto.platformId,
    initialBalance: dto.initialBalance,
  });
}
