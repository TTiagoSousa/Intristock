import { StockMovementWithItem } from '../repositories/company-stock-repository';

export interface StockBalance {
  itemId: string;
  itemName: string;
  stockUnit: string | null;
  // Entradas menos saídas. Pode dar negativo se houver saídas por lançar
  // entradas — e isso é informação, não erro: mostra-se como está.
  quantity: number;
  // Média ponderada das entradas. É o custo com que se valoriza o que está
  // em mão e o que sai.
  averageUnitCost: number;
  totalValue: number;
  movements: number;
  lastMovementAt: Date | null;
}

/**
 * O saldo não está guardado em lado nenhum — é a soma dos movimentos.
 * É mais trabalho a ler do que um contador, mas é a única forma de haver
 * sempre resposta para "porque tenho esta quantidade".
 */
export function calculateStockBalance(movements: StockMovementWithItem[]): StockBalance[] {
  const byItem = new Map<string, StockBalance & { inQuantity: number; inValue: number }>();

  for (const movement of movements) {
    const current = byItem.get(movement.itemId) ?? {
      itemId: movement.itemId,
      itemName: movement.item.name,
      stockUnit: movement.item.stockUnit,
      quantity: 0,
      averageUnitCost: 0,
      totalValue: 0,
      movements: 0,
      lastMovementAt: null,
      inQuantity: 0,
      inValue: 0,
    };

    const quantity = Number(movement.quantity);

    // A saída subtrai, a entrada soma, e o acerto soma como está — porque já
    // traz o sinal dele. É essa a diferença entre acertar e dar saída: um
    // acerto corrige o que o sistema dizia, uma saída regista o que aconteceu.
    if (movement.type === 'out') {
      current.quantity -= Math.abs(quantity);
    } else {
      current.quantity += quantity;
    }

    // Só as entradas com custo entram na média ponderada. Um acerto não tem
    // preço de compra — corrige quantidade, não valor.
    if (movement.type === 'in' && movement.unitCost !== null) {
      current.inQuantity += quantity;
      current.inValue += quantity * Number(movement.unitCost);
    }

    current.movements += 1;

    if (!current.lastMovementAt || movement.occurredAt > current.lastMovementAt) {
      current.lastMovementAt = movement.occurredAt;
    }

    byItem.set(movement.itemId, current);
  }

  return Array.from(byItem.values())
    .map(({ inQuantity, inValue, ...balance }) => {
      const average = inQuantity > 0 ? inValue / inQuantity : 0;

      return {
        ...balance,
        quantity: Number(balance.quantity.toFixed(3)),
        averageUnitCost: Number(average.toFixed(4)),
        totalValue: Number((balance.quantity * average).toFixed(2)),
      };
    })
    .sort((a, b) => a.itemName.localeCompare(b.itemName));
}
