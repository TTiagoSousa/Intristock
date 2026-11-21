import { isoDay } from 'src/utils/dates';
import { BadRequestException, HttpException } from '@nestjs/common';
import { PrismaCurrencyRepository } from '../repositories/prisma/prisma-currency-repository';
import { PrismaCurrencyRateRepository } from '../repositories/prisma/prisma-currency-rate-repository';
import { CurrencyApiConfig, fetchHistoricalRate } from './currencyBeaconClient';

// 'YYYY-MM-DD' em UTC: é assim que as datas dos pagamentos (`@db.Date`) chegam

// '03/03/2026', para as mensagens
const shownDay = (date: Date) => isoDay(date).split('-').reverse().join('/');

/**
 * A cotação de mercado de um dia: quanto vale 1 de `fromCurrencyId` em
 * `toCurrencyId`. Primeiro a da tabela; sem ela, pede-se à API e fica guardada,
 * para o mesmo dia não ser pedido duas vezes.
 *
 * Sem cotação — data futura, API por configurar ou em baixo — a resposta é um
 * erro que diz o que fazer: escrever o valor na moeda da empresa à mão.
 */
export async function findExchangeRate(
  fromCurrencyId: string,
  toCurrencyId: string,
  date: Date,
  currencyRepository: PrismaCurrencyRepository,
  rateRepository: PrismaCurrencyRateRepository,
  // Só se lê a configuração da API quando é mesmo preciso chamá-la
  apiConfig: () => Promise<CurrencyApiConfig>,
): Promise<number> {
  if (fromCurrencyId === toCurrencyId) return 1;

  const day = new Date(`${isoDay(date)}T00:00:00.000Z`);
  const stored = await rateRepository.find(day, fromCurrencyId, toCurrencyId);

  if (stored) return Number(stored.rate);

  const [from, to] = await Promise.all([
    currencyRepository.findById(fromCurrencyId),
    currencyRepository.findById(toCurrencyId),
  ]);

  if (!from || !to) {
    throw new BadRequestException('Moeda inválida');
  }

  const missing = (reason: string) =>
    new BadRequestException(
      `Sem cotação ${from.shortCode}→${to.shortCode} para ${shownDay(day)} (${reason}) — indica o valor em ${to.shortCode}`,
    );

  if (isoDay(day) > isoDay(new Date())) {
    throw missing('a data ainda não chegou');
  }

  let rate: number | null;

  try {
    rate = await fetchHistoricalRate(
      await apiConfig(),
      from.shortCode,
      to.shortCode,
      isoDay(day),
    );
  } catch (error) {
    // A mensagem de quem falhou (chave errada, API em baixo, por configurar)
    // segue entre parênteses
    throw missing(
      error instanceof HttpException ? error.message : 'a API de moedas falhou',
    );
  }

  if (!rate || !Number.isFinite(rate) || rate <= 0) {
    throw missing('a API de moedas não a tem');
  }

  await rateRepository.save(day, fromCurrencyId, toCurrencyId, rate);

  return rate;
}
