import { BadRequestException } from '@nestjs/common';
import { PrismaCompanyItemRepository } from 'src/company-item/repositories/prisma/prisma-company-item-repository';
import { PrismaCompanyStockRepository } from 'src/company-stock/repositories/prisma/prisma-company-stock-repository';
import { assertEnoughStock } from 'src/company-stock/helpers/assertStockInput';
import { calculateStockBalance } from 'src/company-stock/helpers/calculateStockBalance';
import {
  CompanyAssetInput,
  CompanyStockMovementInput,
} from '../repositories/company-payment-repository';

// O custo por unidade de stock precisa de mais casas do que o dinheiro: uma
// bobine de 20 € com 1000 g dá 0,02 €/g, e a 2 casas 0,015 desaparecia
const roundUnitCost = (value: number) => Math.round(value * 10000) / 10000;

const roundMoney = (value: number) => Math.round(value * 100) / 100;

// O preço já na moeda da empresa: é nela que se contam o stock e os ativos
export interface PaymentEffectLine {
  itemId: string;
  quantity: number;
  unitPrice: number;
}

export interface PaymentEffects {
  stockMovements: CompanyStockMovementInput[];
  assets: CompanyAssetInput[];
}

/**
 * O que as linhas de um pagamento deixam atrás de si.
 *
 * O `kind` do item é quem decide: `stock` dá movimento, `asset` abre ficha de
 * imobilizado, `expense` não deixa nada. Vive à parte porque são precisos dois
 * caminhos — ao criar um pagamento já concluído, e ao concluir mais tarde um
 * que nasceu em rascunho. Escrito duas vezes, seriam duas regras a divergir.
 *
 * Só se chama para pagamentos concluídos: um rascunho é uma intenção e não
 * mexe no inventário.
 */
export async function derivePaymentEffects(
  companyId: string,
  paymentType: string,
  lines: PaymentEffectLine[],
  companyItemRepository: PrismaCompanyItemRepository,
  stockRepository: PrismaCompanyStockRepository,
  // Movimentos que já existem e vão desaparecer nesta operação. Ao recalcular
  // um pagamento, o stock que ele próprio trouxe não pode contar como saldo
  // disponível para ele mesmo.
  ignoreMovementsOfPaymentId?: string,
): Promise<PaymentEffects> {
  const stockMovements: CompanyStockMovementInput[] = [];
  const assets: CompanyAssetInput[] = [];

  for (const line of lines) {
    const item = await companyItemRepository.findById(line.itemId);

    if (!item) {
      throw new BadRequestException(`Item inválido: "${line.itemId}"`);
    }

    if (item.companyId !== companyId) {
      throw new BadRequestException('O item não pertence a esta empresa');
    }

    if (item.kind === 'stock') {
      // Compras bobines mas contas gramas: a quantidade de stock é a da linha
      // vezes o que cada unidade comprada traz
      const perUnit = item.stockPerUnit === null ? 1 : Number(item.stockPerUnit);

      stockMovements.push({
        itemId: line.itemId,
        // Numa compra entra, numa venda sai
        type: paymentType === 'receive' ? 'out' : 'in',
        quantity: line.quantity * perUnit,
        // À saída o custo é preenchido abaixo com o médio do momento
        unitCost: paymentType === 'receive' ? null : roundUnitCost(line.unitPrice / perUnit),
      });
    }

    if (item.kind === 'asset' && paymentType !== 'receive') {
      // Cada unidade comprada é um ativo próprio: duas impressoras iguais
      // amortizam e abatem-se separadamente
      for (let unit = 0; unit < line.quantity; unit += 1) {
        assets.push({
          itemId: line.itemId,
          name: item.name,
          // A categoria e a taxa afinam-se depois na ficha do ativo
          category: 'equipamento_basico',
          // Convertido de outra moeda, o preço traz casas a mais
          acquisitionValue: roundMoney(line.unitPrice),
          depreciationRate: 0,
        });
      }
    }
  }

  if (paymentType !== 'receive') return { stockMovements, assets };

  // Uma venda tira do stock, e daí não pode sair mais do que há em mão. As
  // linhas são somadas por item primeiro: duas linhas do mesmo filamento na
  // mesma fatura contam como uma só contra o saldo.
  const leaving = new Map<string, number>();

  for (const movement of stockMovements) {
    leaving.set(movement.itemId, (leaving.get(movement.itemId) ?? 0) + movement.quantity);
  }

  for (const [itemId, quantity] of leaving) {
    const all = await stockRepository.findAllByItemId(companyId, itemId);
    const relevant = ignoreMovementsOfPaymentId
      ? all.filter((row) => row.paymentId !== ignoreMovementsOfPaymentId)
      : all;

    const [balance] = calculateStockBalance(relevant);
    const item = await companyItemRepository.findById(itemId);

    assertEnoughStock(
      item?.name ?? itemId,
      item?.stockUnit ?? null,
      balance?.quantity ?? 0,
      quantity,
    );

    // O custo do que sai fica congelado, com o médio que o item tinha neste
    // momento. É isto que torna o custo das vendas — e portanto a margem —
    // calculável: o médio de amanhã já não é o de hoje.
    for (const movement of stockMovements) {
      if (movement.itemId === itemId) {
        movement.unitCost = balance?.averageUnitCost ?? 0;
      }
    }
  }

  return { stockMovements, assets };
}
