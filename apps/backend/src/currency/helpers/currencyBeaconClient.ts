import axios from 'axios';
import { BadGatewayException } from '@nestjs/common';

export interface CurrencyBeaconCurrency {
  id: number;
  name: string;
  short_code: string;
  code: string;
  precision: number;
  subunit: number;
  symbol: string;
  symbol_first: boolean;
  decimal_mark: string;
  thousands_separator: string;
}

/** Endereço e chave guardados pelo admin em Definições → APIs. */
export interface CurrencyApiConfig {
  url: string;
  key: string;
}

// Uma chave errada não pode chegar ao browser como "500 Internal server error":
// quem carregou no botão tem de perceber que o problema é a chave
async function get<T>(
  config: CurrencyApiConfig,
  path: string,
  params: Record<string, string> = {},
): Promise<T> {
  try {
    const response = await axios.get(`${config.url}${path}`, {
      params: { ...params, api_key: config.key },
      timeout: 20_000,
    });
    return response.data.response as T;
  } catch (error) {
    const status = axios.isAxiosError(error)
      ? error.response?.status
      : undefined;
    throw new BadGatewayException(
      status === 401 || status === 403
        ? 'A API de moedas recusou a chave — confirma-a em Definições → APIs'
        : `A API de moedas não respondeu${status ? ` (${status})` : ''} — tenta outra vez daqui a pouco`,
    );
  }
}

export async function fetchCurrencyByShortCode(
  config: CurrencyApiConfig,
  shortCode: string,
): Promise<CurrencyBeaconCurrency | null> {
  const currencies = await get<CurrencyBeaconCurrency[]>(config, '/currencies');
  return (
    currencies.find((currency) => currency.short_code === shortCode) ?? null
  );
}

export async function fetchAllCurrencies(
  config: CurrencyApiConfig,
): Promise<CurrencyBeaconCurrency[]> {
  return get<CurrencyBeaconCurrency[]>(config, '/currencies');
}

// As de agora, base USD: 1 USD = X de cada uma (só as `symbols`, se vierem)
export async function fetchLatestRates(
  config: CurrencyApiConfig,
  symbols?: string[],
): Promise<Record<string, number>> {
  const data = await get<{ rates: Record<string, number> }>(config, '/latest', {
    base: 'USD',
    ...(symbols?.length ? { symbols: symbols.join(',') } : {}),
  });
  return data.rates;
}

// A cotação de um dia: 1 `base` = X `symbol`. A CurrencyBeacon cota todos os dias
// de calendário, fins de semana incluídos.
export async function fetchHistoricalRate(
  config: CurrencyApiConfig,
  base: string,
  symbol: string,
  date: string,
): Promise<number | null> {
  const data = await get<{ rates?: Record<string, number> }>(
    config,
    '/historical',
    { base, date, symbols: symbol },
  );
  return data?.rates?.[symbol] ?? null;
}

// As cotações de um dia para várias moedas: 1 `base` = X de cada uma
export async function fetchHistoricalRates(
  config: CurrencyApiConfig,
  base: string,
  symbols: string[],
  date: string,
): Promise<Record<string, number>> {
  const data = await get<{ rates?: Record<string, number> }>(
    config,
    '/historical',
    { base, date, symbols: symbols.join(',') },
  );
  return data?.rates ?? {};
}
