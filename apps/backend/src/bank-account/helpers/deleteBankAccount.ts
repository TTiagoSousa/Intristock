import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaBankAccountRepository } from '../repositories/prisma/prisma-bank-account-repository';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { assertCompanyAccess } from 'src/company/helpers/assertCompanyAccess';

export async function deleteBankAccount(
  userId: string,
  companyId: string,
  bankAccountId: string,
  bankAccountRepository: PrismaBankAccountRepository,
  companyRepository: PrismaCompanyRepository,
) {
  await assertCompanyAccess(userId, companyId, companyRepository, {
    notYours: 'Não podes apagar contas de uma empresa que não é tua',
    permission: 'settings.edit',
  });

  const account = await bankAccountRepository.findById(bankAccountId);

  if (!account || account.companyId !== companyId) {
    throw new NotFoundException('Conta bancária não encontrada');
  }

  // Apagar uma conta por onde já passou dinheiro deixava pagamentos a apontar
  // para o vazio. Para a tirar de circulação sem perder o histórico, fecha-se
  // com `status: inactive` — a mesma saída dos itens já usados.
  const payments = await bankAccountRepository.countPayments(bankAccountId);

  if (payments > 0) {
    throw new BadRequestException(
      `Esta conta tem ${payments} pagamento(s) associados e não pode ser apagada — fecha-a em vez disso`,
    );
  }

  // O mesmo para os fornecedores que se pagam por ela: apagá-la deixava-os a
  // dizer que se paga por transferência de uma conta que já não existe
  const suppliers = await bankAccountRepository.countSuppliers(bankAccountId);

  if (suppliers > 0) {
    throw new BadRequestException(
      `Esta conta está associada a ${suppliers} fornecedor(es) — muda-lhes a conta antes de a apagar`,
    );
  }

  await bankAccountRepository.delete(bankAccountId);
}
