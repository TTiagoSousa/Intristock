import { BadRequestException } from '@nestjs/common';
import { PrismaCurrencyRepository } from 'src/currency/repositories/prisma/prisma-currency-repository';
import { PrismaCurrencyRateRepository } from 'src/currency/repositories/prisma/prisma-currency-rate-repository';
import { CurrencyApiConfig } from 'src/currency/helpers/currencyBeaconClient';
import { findExchangeRate } from 'src/currency/helpers/findExchangeRate';

export type RateSource = 'same' | 'market' | 'manual';

export interface PaymentRate {
  exchangeRate: number;
  rateSource: RateSource;
}

export interface PaymentRateLookup {
  currencyRepository: PrismaCurrencyRepository;
  rateRepository: PrismaCurrencyRateRepository;
  apiConfig: () => Promise<CurrencyApiConfig>;
}

/**
 * A taxa com que um pagamento passa para a moeda da empresa, fixada ao gravar.
 *
 * - Na moeda da empresa: 1.
 * - Com o valor na moeda da empresa escrito à mão (o que o banco cobrou): a taxa
 *   sai dele, `companyAmount / amount`, e fica marcada como manual.
 * - Sem ele: a cotação de mercado do dia do pagamento.
 *
 * Não se arredonda a taxa manual: `amount × exchangeRate` tem de voltar a dar
 * exatamente o valor escrito.
 */
export async function resolvePaymentRate(
  paymentCurrencyId: string,
  companyCurrencyId: string,
  amount: number,
  paymentDate: Date,
  companyAmount: number | undefined,
  lookup: PaymentRateLookup,
): Promise<PaymentRate> {
  if (paymentCurrencyId === companyCurrencyId) {
    return { exchangeRate: 1, rateSource: 'same' };
  }

  if (companyAmount !== undefined) {
    if (amount <= 0) {
      throw new BadRequestException(
        'Um pagamento de valor 0 não tem taxa — não indiques o valor na moeda da empresa',
      );
    }

    // 15 algarismos tiram o ruído da divisão em vírgula flutuante (93,1 / 100
    // dava 0,9309999999999999) sem perder nada que conte
    return {
      exchangeRate: Number((companyAmount / amount).toPrecision(15)),
      rateSource: 'manual',
    };
  }

  const exchangeRate = await findExchangeRate(
    paymentCurrencyId,
    companyCurrencyId,
    paymentDate,
    lookup.currencyRepository,
    lookup.rateRepository,
    lookup.apiConfig,
  );

  return { exchangeRate, rateSource: 'market' };
}
