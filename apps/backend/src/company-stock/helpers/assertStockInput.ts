import { BadRequestException, NotFoundException } from '@nestjs/common';
import { assertCompanyAccess, CompanyAccessPermission } from 'src/company/helpers/assertCompanyAccess';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { PrismaCompanyItemRepository } from 'src/company-item/repositories/prisma/prisma-company-item-repository';

export async function assertCompanyOwnership(
  userId: string,
  companyId: string,
  companyRepository: PrismaCompanyRepository,
  // O que é preciso (`assertCompanyAccess`): ver lê, o resto grava
  permission: CompanyAccessPermission,
) {
  return assertCompanyAccess(userId, companyId, companyRepository, {
    notYours: 'Não podes gerir o stock de uma empresa que não é tua',
    permission,
  });
}

// Só itens marcados como `stock` é que podem ter movimentos. Sem isto ficavam
// a existir movimentos de serviços, que não têm quantidade nenhuma.
export async function assertStockItem(
  companyId: string,
  itemId: string,
  itemRepository: PrismaCompanyItemRepository,
) {
  const item = await itemRepository.findById(itemId);

  if (!item || item.companyId !== companyId) {
    throw new NotFoundException('Item não encontrado');
  }

  if (item.kind !== 'stock') {
    throw new BadRequestException(
      `O item "${item.name}" não é de stock — muda o tipo para "stock" para lhe registares movimentos`,
    );
  }

  return item;
}

/**
 * Não se tira do stock mais do que lá está.
 *
 * A quantidade em mão nunca é um contador guardado: é a soma dos movimentos,
 * por isso quem quiser saber quanto pode sair tem de a calcular na hora. A
 * mensagem diz sempre a unidade — "só tens 3180" não diz nada quando o mesmo
 * armazém tem gramas, litros e unidades.
 */
export function assertEnoughStock(
  itemName: string,
  stockUnit: string | null,
  available: number,
  requested: number,
) {
  if (requested <= available) return;

  const unit = stockUnit ? ` ${stockUnit}` : '';

  throw new BadRequestException(
    available <= 0
      ? `Não há stock de "${itemName}" para tirar — tens ${available}${unit} em mão`
      : `Só tens ${available}${unit} de "${itemName}" e estás a tirar ${requested}${unit}`,
  );
}
