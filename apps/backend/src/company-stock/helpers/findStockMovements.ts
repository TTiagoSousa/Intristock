import { PrismaCompanyStockRepository } from '../repositories/prisma/prisma-company-stock-repository';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { assertCompanyOwnership } from './assertStockInput';
import { calculateStockBalance } from './calculateStockBalance';

export async function findStockMovements(
  userId: string,
  companyId: string,
  stockRepository: PrismaCompanyStockRepository,
  companyRepository: PrismaCompanyRepository,
  pagination: { skip: number; take: number },
  itemId?: string,
) {
  await assertCompanyOwnership(userId, companyId, companyRepository, 'stock.view');

  return stockRepository.findPageByCompanyId(companyId, pagination, itemId);
}

export async function findStockBalance(
  userId: string,
  companyId: string,
  stockRepository: PrismaCompanyStockRepository,
  companyRepository: PrismaCompanyRepository,
  pagination: { skip: number; take: number },
) {
  await assertCompanyOwnership(userId, companyId, companyRepository, 'stock.view');

  // Aqui a página só se corta **depois** de somar: o saldo de um item é a série
  // toda dos movimentos dele, por isso não dá para paginar a leitura. Paginam-se
  // as linhas de saldo que saem da soma, que são uma por item.
  const movements = await stockRepository.findAllByCompanyId(companyId);
  const balances = calculateStockBalance(movements);

  return {
    items: balances.slice(pagination.skip, pagination.skip + pagination.take),
    total: balances.length,
    // O valor de tudo o que está em mão, não o das dez linhas à vista. Somado
    // aqui porque a página sozinha não sabe o que ficou de fora.
    totalValue: Number(balances.reduce((sum, row) => sum + row.totalValue, 0).toFixed(2)),
  };
}
