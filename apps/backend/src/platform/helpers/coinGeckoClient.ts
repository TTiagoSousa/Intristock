import axios from 'axios';
import { BadGatewayException } from '@nestjs/common';

/** Uma exchange na lista da CoinGecko (`GET /exchanges`). */
export interface CoinGeckoExchange {
  id: string;
  name: string;
  year_established: number | null;
  country: string | null;
  url: string | null;
  image: string | null;
  trust_score: number | null;
  trust_score_rank: number | null;
}

// O máximo por página; a lista inteira são ~4 pedidos
const PAGE_SIZE = 250;
const TIMEOUT_MS = 20_000;
// Sem chave o limite é baixo: se pedir para abrandar, espera um minuto e tenta outra vez
const RATE_LIMIT_WAIT_MS = 60_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Todas as exchanges, às páginas. A chave (Demo) é opcional. */
export async function fetchCoinGeckoExchanges(config: {
  url: string;
  key: string;
}): Promise<CoinGeckoExchange[]> {
  const headers = config.key ? { 'x-cg-demo-api-key': config.key } : {};
  const get = (page: number) =>
    axios.get<CoinGeckoExchange[]>(`${config.url}/exchanges`, {
      params: { per_page: PAGE_SIZE, page },
      headers,
      timeout: TIMEOUT_MS,
    });

  const exchanges: CoinGeckoExchange[] = [];
  for (let page = 1; ; page++) {
    let data: CoinGeckoExchange[];
    try {
      try {
        ({ data } = await get(page));
      } catch (error) {
        if (!axios.isAxiosError(error) || error.response?.status !== 429) throw error;
        await sleep(RATE_LIMIT_WAIT_MS);
        ({ data } = await get(page));
      }
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      throw new BadGatewayException(
        status === 401 || status === 403
          ? 'A CoinGecko recusou a chave — confirma-a em Definições → APIs'
          : status === 429
            ? 'A CoinGecko pediu para abrandar (limite de pedidos) — tenta daqui a um minuto'
            : 'A API das exchanges não respondeu — tenta mais tarde',
      );
    }
    exchanges.push(...data);
    if (data.length < PAGE_SIZE) return exchanges;
  }
}
