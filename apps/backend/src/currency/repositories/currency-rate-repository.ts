import { CurrencyRate } from 'src/generated/prisma/client/client';

export interface CurrencyRateRepository {
  find(
    date: Date,
    baseCurrencyId: string,
    quoteCurrencyId: string,
  ): Promise<CurrencyRate | null>;
  // As cotações para uma moeda em vários dias e de várias moedas, de uma vez
  findMany(
    dates: Date[],
    baseCurrencyIds: string[],
    quoteCurrencyId: string,
  ): Promise<CurrencyRate[]>;
  // Dois pedidos ao mesmo tempo podem ir buscar a mesma cotação: o segundo não
  // pode rebentar por a linha já existir
  save(
    date: Date,
    baseCurrencyId: string,
    quoteCurrencyId: string,
    rate: number,
  ): Promise<CurrencyRate>;
}
