import axios from 'axios';
import { BadGatewayException } from '@nestjs/common';

/** Uma firma na lista (`GET /firms`): só o resumo, sem planos nem regras. */
export interface PropFirmListItem {
  id: number;
  slug: string;
  name: string;
  url: string | null;
  logo_url: string | null;
  country: string | null;
  established: string | null;
  asset_type: string | null;
  profit_split: string | null;
  payout_frequency: string | null;
  daily_drawdown: string | null;
  direct_funding: boolean | null;
  propfirmmap_score: number | null;
  safety_grade: string | null;
  trustpilot: {
    rating: string | null;
    review_count: number | null;
    suspended: boolean | null;
  } | null;
  platforms: string[] | null;
}

/** A ficha de uma firma (`GET /firms/{slug}`): o resumo mais os planos e as regras. */
export interface PropFirmDetail extends PropFirmListItem {
  payout_methods: string[] | null;
  challenges: Record<string, unknown>[] | null;
  rules: {
    trading_rules?: Record<string, unknown> | null;
    payout_rules?: Record<string, unknown> | null;
  } | null;
}

const PAGE_SIZE = 50;
const TIMEOUT_MS = 20_000;

const fail = (error: unknown): never => {
  const status = axios.isAxiosError(error) ? error.response?.status : undefined;
  throw new BadGatewayException(
    status === 429
      ? 'A PropFirmMap pediu para abrandar (limite de pedidos) — tenta daqui a um minuto'
      : 'A API das prop firms não respondeu — tenta mais tarde',
  );
};

/** A lista inteira, às páginas (50 de cada vez; ~6 pedidos). */
export async function fetchPropFirmList(config: {
  url: string;
}): Promise<PropFirmListItem[]> {
  const firms: PropFirmListItem[] = [];
  for (let page = 1; ; page++) {
    try {
      const { data } = await axios.get<{
        data: PropFirmListItem[];
        meta: { last_page: number };
      }>(`${config.url}/firms`, {
        params: { per_page: PAGE_SIZE, page },
        timeout: TIMEOUT_MS,
      });
      firms.push(...data.data);
      if (page >= data.meta.last_page) return firms;
    } catch (error) {
      fail(error);
    }
  }
}

/** A ficha de uma firma, com os planos e as regras. */
export async function fetchPropFirm(
  config: { url: string },
  slug: string,
): Promise<PropFirmDetail> {
  try {
    const { data } = await axios.get<{ data: PropFirmDetail }>(
      `${config.url}/firms/${encodeURIComponent(slug)}`,
      {
        timeout: TIMEOUT_MS,
      },
    );
    return data.data;
  } catch (error) {
    return fail(error);
  }
}
