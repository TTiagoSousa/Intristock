import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaCompanySupplierRepository } from '../repositories/prisma/prisma-company-supplier-repository';
import { assertCompanyAccess } from 'src/company/helpers/assertCompanyAccess';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';

export async function deleteCompanySupplier(
  userId: string,
  companyId: string,
  supplierId: string,
  companySupplierRepository: PrismaCompanySupplierRepository,
  companyRepository: PrismaCompanyRepository,
) {
  await assertCompanyAccess(userId, companyId, companyRepository, {
    notYours: 'Não podes apagar fornecedores de uma empresa que não é tua',
    permission: 'suppliers.delete',
  });

  const supplier = await companySupplierRepository.findById(supplierId);

  if (!supplier || supplier.companyId !== companyId) {
    throw new NotFoundException('Fornecedor não encontrado');
  }

  // Apagar um fornecedor com pagamentos deixava o histórico a apontar para o
  // vazio. Para o tirar de circulação desativa-se — a mesma saída das contas
  // bancárias e dos itens já usados. As ligações a itens saem com ele.
  const payments = await companySupplierRepository.countPayments(supplierId);

  if (payments > 0) {
    throw new BadRequestException(
      `Este fornecedor tem ${payments} pagamento(s) associados e não pode ser apagado — desativa-o em vez disso`,
    );
  }

  await companySupplierRepository.delete(supplierId);
}
