import { PrismaBankAccountRepository } from '../repositories/prisma/prisma-bank-account-repository';

export async function findUserBankAccounts(userId: string, bankAccountRepository: PrismaBankAccountRepository) {
  return bankAccountRepository.findAllByUserId(userId);
}
