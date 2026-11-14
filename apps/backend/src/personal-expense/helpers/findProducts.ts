import { CurrencyService } from 'src/currency/currency.service';
import { PrismaPersonalExpenseRepository } from '../repositories/prisma/prisma-personal-expense-repository';
import { ExpenseCurrency } from '../repositories/personal-expense-repository';
import { ProductsQueryDto } from '../dto/personal-expense.dto';

const FALLBACK_CURRENCY = 'EUR';
const round = (value: number) => Math.round(value * 100) / 100;

/**
 * Os itens da pessoa (o catálogo de produtos), cada um com o que se gastou nele
 * nas despesas pagas, numa moeda (a pedida, senão o euro; as outras pelo
 * cotação do dia de cada compra): as compras, a quantidade, o total e o último preço.
 */
export async function findProducts(
  userId: string,
  query: ProductsQueryDto,
  repository: PrismaPersonalExpenseRepository,
  currencyService: CurrencyService,
) {
  const [products, purchases] = await Promise.all([
    repository.findProducts(userId),
    repository.findProductPurchases(userId),
  ]);
  const target: ExpenseCurrency | null =
    (query.currencyId
      ? await repository.findCurrency(query.currencyId)
      : null) ?? (await repository.findCurrencyByCode(FALLBACK_CURRENCY));
  const converter = await currencyService.converter(
    target,
    purchases.map((purchase) => ({
      currency: purchase.expense.currency,
      day: purchase.expense.date.toISOString().slice(0, 10),
      hour: purchase.expense.rateHour,
    })),
  );
  const convert = converter.convert;

  const stats = new Map<
    string,
    {
      count: number;
      quantity: number;
      total: number;
      lastPrice: number;
      lastDate: string;
    }
  >();
  for (const purchase of purchases) {
    if (!purchase.productId || purchase.expense.status !== 'paid') continue;
    const date = purchase.expense.date.toISOString().slice(0, 10);
    const entry = stats.get(purchase.productId) ?? {
      count: 0,
      quantity: 0,
      total: 0,
      lastPrice: 0,
      lastDate: '',
    };
    entry.count += 1;
    entry.quantity += Number(purchase.quantity);
    entry.total += convert(
      Number(purchase.amount),
      purchase.expense.currency,
      date,
      purchase.expense.rateHour,
    );
    if (date >= entry.lastDate) {
      entry.lastDate = date;
      entry.lastPrice = convert(
        Number(purchase.unitPrice),
        purchase.expense.currency,
        date,
        purchase.expense.rateHour,
      );
    }
    stats.set(purchase.productId, entry);
  }

  return {
    currency: target,
    estimatedRates: converter.estimated(),
    products: products.map((product) => {
      const entry = stats.get(product.id);
      return {
        id: product.id,
        name: product.name,
        brand: product.brand,
        unit: product.unit,
        categoryId: product.categoryId,
        count: entry?.count ?? 0,
        quantity: round(entry?.quantity ?? 0),
        total: round(entry?.total ?? 0),
        lastPrice: entry ? round(entry.lastPrice) : null,
        lastDate: entry?.lastDate || null,
      };
    }),
  };
}
