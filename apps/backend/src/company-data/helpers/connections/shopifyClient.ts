import { BadRequestException } from '@nestjs/common';
import { SHOPIFY_API_VERSION, SHOPIFY_ORDERS_QUERY, SHOPIFY_SHOP, SHOPIFY_SHOP_QUERY, ShopifyOrderNode } from './shopifyOrders';

const TIMEOUT_MS = 30_000;
const RETRIES = 3;

type Fetch = typeof fetch;

/** O erro de uma chamada à Shopify, já no texto que o ecrã mostra. */
export class ShopifyError extends BadRequestException {}

/**
 * Um pedido à Admin API (GraphQL) de uma loja: com a chave no cabeçalho, sem seguir redireções, e outra vez (até 3)
 * quando a Shopify pede para esperar (429, «THROTTLED») ou falha do lado dela (5xx).
 */
export async function shopifyGraphql<T>(shop: string, token: string, query: string, variables: Record<string, unknown> = {}, fetcher: Fetch = fetch): Promise<T> {
  if (!SHOPIFY_SHOP.test(shop)) throw new ShopifyError('A loja tem de ser o domínio da Shopify (a-tua-loja.myshopify.com)');
  const url = `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;
  for (let attempt = 0; ; attempt++) {
    let response: Response;
    try {
      response = await fetcher(url, {
        method: 'POST',
        redirect: 'manual',
        headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      if (attempt < RETRIES) {
        await wait(attempt);
        continue;
      }
      throw new ShopifyError('A Shopify não respondeu');
    }
    if (response.status === 401 || response.status === 403) throw new ShopifyError('A Shopify recusou a chave (ou falta-lhe a permissão read_orders)');
    if (response.status === 404) throw new ShopifyError('A loja não existe na Shopify');
    if ((response.status === 429 || response.status >= 500) && attempt < RETRIES) {
      await wait(attempt);
      continue;
    }
    if (!response.ok) throw new ShopifyError(`A Shopify respondeu ${response.status}`);
    const body = (await response.json()) as { data?: T; errors?: { message?: string; extensions?: { code?: string } }[] };
    if (body.errors?.length) {
      if (body.errors.some((e) => e.extensions?.code === 'THROTTLED') && attempt < RETRIES) {
        await wait(attempt);
        continue;
      }
      throw new ShopifyError(`A Shopify recusou o pedido: ${body.errors[0].message ?? 'erro'}`);
    }
    if (!body.data) throw new ShopifyError('A Shopify não devolveu dados');
    return body.data;
  }
}

const wait = (attempt: number) => new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));

/** Vê se a chave serve: o nome e a moeda da loja. */
export async function checkShopifyShop(shop: string, token: string, fetcher?: Fetch) {
  const data = await shopifyGraphql<{ shop: { name: string; currencyCode: string } }>(shop, token, SHOPIFY_SHOP_QUERY, {}, fetcher);
  return data.shop;
}

/** Uma página das encomendas mexidas desde `updatedSince` (ISO), pela ordem da última mudança. */
export async function fetchShopifyOrders(shop: string, token: string, input: { after: string | null; updatedSince: string | null }, fetcher?: Fetch) {
  const data = await shopifyGraphql<{ orders: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: ShopifyOrderNode[] } }>(
    shop,
    token,
    SHOPIFY_ORDERS_QUERY,
    { first: 100, after: input.after, query: input.updatedSince ? `updated_at:>='${input.updatedSince}'` : null },
    fetcher,
  );
  return data.orders;
}
