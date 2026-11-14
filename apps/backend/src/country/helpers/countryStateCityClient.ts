import axios from 'axios';
import { BadGatewayException } from '@nestjs/common';

export interface CountryStateCityCountry {
  id: number;
  name: string;
  iso2: string;
  iso3: string;
  phonecode: string;
  capital: string | null;
  currency: string;
  native: string | null;
  emoji: string | null;
}

/** Endereço e chave guardados pelo admin em Definições → APIs. */
export interface CountryApiConfig {
  url: string;
  key: string;
}

export async function fetchAllCountries(config: CountryApiConfig): Promise<CountryStateCityCountry[]> {
  try {
    const response = await axios.get(`${config.url}/countries`, {
      headers: { 'X-CSCAPI-KEY': config.key },
      timeout: 20_000,
    });
    return response.data;
  } catch (error) {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    throw new BadGatewayException(
      status === 401 || status === 403
        ? 'A API de países recusou a chave — confirma-a em Definições → APIs'
        : `A API de países não respondeu${status ? ` (${status})` : ''} — tenta outra vez daqui a pouco`,
    );
  }
}
