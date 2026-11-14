import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaBankAccountRepository } from '../repositories/prisma/prisma-bank-account-repository';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { PrismaCurrencyRepository } from 'src/currency/repositories/prisma/prisma-currency-repository';
import { PrismaPlatformRepository } from 'src/platform/repositories/prisma/prisma-platform-repository';
import { assertCompanyAccess } from 'src/company/helpers/assertCompanyAccess';
import { UpdateBankAccountDto } from '../dto/update-bank-account.dto';
import { BankAccountUpdateData } from '../repositories/bank-account-repository';

export async function updateBankAccount(
  userId: string,
  companyId: string,
  bankAccountId: string,
  dto: UpdateBankAccountDto,
  bankAccountRepository: PrismaBankAccountRepository,
  companyRepository: PrismaCompanyRepository,
  currencyRepository: PrismaCurrencyRepository,
  platformRepository: PrismaPlatformRepository,
) {
  await assertCompanyAccess(userId, companyId, companyRepository, {
    notYours: 'Não podes editar contas de uma empresa que não é tua',
    permission: 'settings.edit',
  });

  const account = await bankAccountRepository.findById(bankAccountId);

  // O segundo teste é o que impede quem sabe o id de editar a conta de outra
  // empresa através de uma empresa sua
  if (!account || account.companyId !== companyId) {
    throw new NotFoundException('Conta bancária não encontrada');
  }

  const data: BankAccountUpdateData = {};

  if (dto.name !== undefined) data.name = dto.name;
  if (dto.initialBalance !== undefined)
    data.initialBalance = dto.initialBalance;
  if (dto.status !== undefined) data.status = dto.status;

  if (dto.iban !== undefined) {
    // Vazio limpa: uma conta de plataforma ou de cartão pode não ter IBAN
    const iban = dto.iban.trim();

    if (iban && iban !== account.iban) {
      const existing = await bankAccountRepository.findByIban(iban);

      if (existing && existing.id !== bankAccountId) {
        throw new ConflictException(`Já existe uma conta com o IBAN "${iban}"`);
      }
    }

    data.iban = iban || null;
  }

  if (dto.platformId !== undefined) {
    const platform = await platformRepository.findById(dto.platformId);

    if (!platform) {
      throw new BadRequestException('Plataforma inválida');
    }

    data.platformId = dto.platformId;
  }

  // A moeda de uma conta só se corrige enquanto ela não tiver movimento: os
  // pagamentos que já passaram por cá foram feitos na moeda antiga, e trocá-la
  // não os converte — mudava só o que eles parecem valer.
  if (dto.currencyId !== undefined && dto.currencyId !== account.currencyId) {
    const currency = await currencyRepository.findById(dto.currencyId);

    if (!currency) {
      throw new BadRequestException('Moeda inválida');
    }

    const payments = await bankAccountRepository.countPayments(bankAccountId);

    if (payments > 0) {
      throw new BadRequestException(
        `Esta conta já tem ${payments} pagamento(s) — mudar a moeda alterava o que eles valem`,
      );
    }

    data.currencyId = dto.currencyId;
  }

  return bankAccountRepository.update(bankAccountId, data);
}
