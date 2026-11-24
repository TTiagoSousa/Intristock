import { mapShopifyOrder, ShopifyOrderNode } from './shopifyOrders';
import { ordersToRows } from './syncDataConnection';
import { assertConnectionMapping, columnsForFields, normalizeShop } from './saveDataConnection';
import { fetchShopifyOrders, shopifyGraphql } from './shopifyClient';

const order = (extra: Partial<ShopifyOrderNode> = {}): ShopifyOrderNode => ({
  id: 'gid://shopify/Order/6290000046275',
  name: '#1250',
  createdAt: '2026-11-12T10:00:00Z',
  updatedAt: '2026-11-13T09:00:00Z',
  displayFinancialStatus: 'PENDING',
  displayFulfillmentStatus: 'FULFILLED',
  currencyCode: 'EUR',
  totalPriceSet: { shopMoney: { amount: '29.99' } },
  paymentGatewayNames: ['Cash on Delivery (COD)'],
  shippingAddress: { name: 'Cliente Teste', phone: '+351900000000', city: 'Almada', validationResultSummary: 'ERROR', coordinatesValidated: false },
  lineItems: { nodes: [{ name: 'Lanterna', quantity: 1, sku: 'LAN-1' }, { name: 'Pilhas', quantity: 2, sku: null }] },
  ...extra,
});

describe('Shopify: as encomendas', () => {
  it('passa uma encomenda aos campos (valores, datas, morada errada, artigos)', () => {
    expect(mapShopifyOrder(order())).toMatchObject({
      name: '#1250',
      id: '6290000046275',
      createdAt: '2026-11-12',
      financialStatus: 'pending',
      fulfillmentStatus: 'fulfilled',
      totalPrice: 29.99,
      totalShipping: null,
      paymentGateways: 'Cash on Delivery (COD)',
      shippingCity: 'Almada',
      addressValidation: 'ERROR',
      addressError: 'Sim',
      coordinatesValidated: 'Não',
      items: 'Lanterna + Pilhas',
      itemsQuantity: 3,
      skus: 'LAN-1',
    });
    expect(mapShopifyOrder(order({ shippingAddress: { validationResultSummary: 'WARNING' } })).addressError).toBe('Não');
    expect(mapShopifyOrder(order({ shippingAddress: null })).addressError).toBeNull();
  });

  it('faz as linhas pela chave, pelo tipo de cada coluna, e a mesma encomenda duas vezes fica a última', () => {
    const { columns, mapping, keyColumn } = columnsForFields(['totalPrice', 'addressError', 'createdAt']);
    expect(keyColumn).toBe('name');
    expect(mapping).toEqual({ name: 'name', createdAt: 'created_at', totalPrice: 'total_price', addressError: 'address_error' });
    const rows = ordersToRows([order(), order({ totalPriceSet: { shopMoney: { amount: '31' } } }), order({ name: '' })], mapping, { columns: columns as never, keyColumn });
    expect(rows).toEqual([{ key: '#1250', data: { name: '#1250', created_at: '2026-11-12', total_price: 31, address_error: 'Sim' } }]);
  });

  it('valida a loja e a ligação dos campos', () => {
    expect(normalizeShop(' https://A-Minha-Loja.myshopify.com/admin ')).toBe('a-minha-loja.myshopify.com');
    expect(() => normalizeShop('evil.com')).toThrow('domínio da Shopify');
    expect(() => normalizeShop('127.0.0.1')).toThrow();
    const table = { columns: [{ key: 'encomenda' }, { key: 'total' }], keyColumn: 'encomenda' };
    expect(assertConnectionMapping({ name: 'encomenda', totalPrice: 'total', email: '' }, table)).toEqual({ name: 'encomenda', totalPrice: 'total' });
    expect(() => assertConnectionMapping({ totalPrice: 'total' }, table)).toThrow('coluna chave');
    expect(() => assertConnectionMapping({ name: 'encomenda', totalPrice: 'encomenda' }, table)).toThrow();
    expect(() => assertConnectionMapping({ name: 'encomenda', hack: 'total' }, table)).toThrow('Campo desconhecido');
    expect(() => assertConnectionMapping({ name: 'encomenda' }, { ...table, keyColumn: null })).toThrow('coluna chave');
  });

  it('pede à loja com a chave e o filtro da data, sem seguir redireções', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetcher = ((url: string, init: RequestInit) => {
      calls.push({ url, init });
      return Promise.resolve(new Response(JSON.stringify({ data: { orders: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [order()] } } }), { status: 200 }));
    }) as unknown as typeof fetch;
    const page = await fetchShopifyOrders('loja.myshopify.com', 'shpat_x', { after: null, updatedSince: '2026-11-01T00:00:00.000Z' }, fetcher);
    expect(page.nodes).toHaveLength(1);
    expect(calls[0].url).toBe('https://loja.myshopify.com/admin/api/2026-10/graphql.json');
    expect(calls[0].init.redirect).toBe('manual');
    expect((calls[0].init.headers as Record<string, string>)['X-Shopify-Access-Token']).toBe('shpat_x');
    expect((JSON.parse(calls[0].init.body as string) as { variables: { query: string } }).variables.query).toBe("updated_at:>='2026-11-01T00:00:00.000Z'");
  });

  it('diz o que falhou: chave recusada, loja que não existe, erros do GraphQL', async () => {
    const answer = (status: number, body: unknown = {}) => (() => Promise.resolve(new Response(JSON.stringify(body), { status }))) as unknown as typeof fetch;
    await expect(shopifyGraphql('loja.myshopify.com', 't', '{}', {}, answer(401))).rejects.toThrow('recusou a chave');
    await expect(shopifyGraphql('loja.myshopify.com', 't', '{}', {}, answer(404))).rejects.toThrow('não existe');
    await expect(shopifyGraphql('loja.myshopify.com', 't', '{}', {}, answer(200, { errors: [{ message: 'Field x' }] }))).rejects.toThrow('Field x');
    await expect(shopifyGraphql('outra.com', 't', '{}', {}, answer(200))).rejects.toThrow('domínio');
  });
});
