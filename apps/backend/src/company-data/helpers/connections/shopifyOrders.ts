import { CellValue, DataColumnType } from '../dataTypes';

/** A versão da Admin API da Shopify (GraphQL) que a ligação usa. */
export const SHOPIFY_API_VERSION = '2026-10';
/// A loja: só o domínio da Shopify (nunca outro endereço, contra o SSRF)
export const SHOPIFY_SHOP = /^[a-z0-9][a-z0-9-]{0,60}\.myshopify\.com$/;

/** Um campo de uma encomenda que se pode levar para uma coluna da tabela. */
export interface ConnectionField {
  field: string;
  label: string;
  type: DataColumnType;
  personal: boolean;
}

/// Os campos das encomendas, pela ordem em que se propõem (o «name» é o número, #1001, a chave)
export const SHOPIFY_ORDER_FIELDS: ConnectionField[] = [
  { field: 'name', label: 'Encomenda', type: 'text', personal: false },
  { field: 'id', label: 'Id Shopify', type: 'text', personal: false },
  { field: 'createdAt', label: 'Criada em', type: 'date', personal: false },
  { field: 'processedAt', label: 'Processada em', type: 'date', personal: false },
  { field: 'updatedAt', label: 'Atualizada em', type: 'date', personal: false },
  { field: 'cancelledAt', label: 'Cancelada em', type: 'date', personal: false },
  { field: 'financialStatus', label: 'Pagamento', type: 'text', personal: false },
  { field: 'fulfillmentStatus', label: 'Expedição', type: 'text', personal: false },
  { field: 'totalPrice', label: 'Total', type: 'money', personal: false },
  { field: 'subtotalPrice', label: 'Subtotal', type: 'money', personal: false },
  { field: 'totalShipping', label: 'Portes', type: 'money', personal: false },
  { field: 'totalTax', label: 'Impostos', type: 'money', personal: false },
  { field: 'totalDiscounts', label: 'Descontos', type: 'money', personal: false },
  { field: 'totalRefunded', label: 'Reembolsado', type: 'money', personal: false },
  { field: 'totalOutstanding', label: 'Por pagar', type: 'money', personal: false },
  { field: 'currency', label: 'Moeda', type: 'text', personal: false },
  { field: 'paymentGateways', label: 'Método de pagamento', type: 'text', personal: false },
  { field: 'shippingMethod', label: 'Método de envio', type: 'text', personal: false },
  { field: 'email', label: 'Email', type: 'email', personal: true },
  { field: 'phone', label: 'Telefone', type: 'phone', personal: true },
  { field: 'shippingName', label: 'Nome de envio', type: 'text', personal: true },
  { field: 'shippingPhone', label: 'Telefone de envio', type: 'phone', personal: true },
  { field: 'shippingAddress1', label: 'Morada', type: 'text', personal: true },
  { field: 'shippingAddress2', label: 'Morada (2)', type: 'text', personal: true },
  { field: 'shippingZip', label: 'Código postal', type: 'text', personal: true },
  { field: 'shippingCity', label: 'Localidade', type: 'text', personal: false },
  { field: 'shippingProvince', label: 'Distrito', type: 'text', personal: false },
  { field: 'shippingCountry', label: 'País', type: 'text', personal: false },
  { field: 'addressValidation', label: 'Validação da morada', type: 'text', personal: false },
  { field: 'addressError', label: 'Erro na morada', type: 'text', personal: false },
  { field: 'coordinatesValidated', label: 'Coordenadas validadas', type: 'text', personal: false },
  { field: 'items', label: 'Artigos', type: 'text', personal: false },
  { field: 'itemsQuantity', label: 'Quantidade', type: 'number', personal: false },
  { field: 'skus', label: 'SKUs', type: 'text', personal: false },
  { field: 'tags', label: 'Tags', type: 'text', personal: false },
  { field: 'note', label: 'Notas', type: 'text', personal: true },
  { field: 'sourceName', label: 'Origem', type: 'text', personal: false },
];

/// A pergunta: as encomendas mexidas depois do cursor, das mais antigas para as recentes, 100 de cada vez
export const SHOPIFY_ORDERS_QUERY = `query Orders($first: Int!, $after: String, $query: String) {
  orders(first: $first, after: $after, query: $query, sortKey: UPDATED_AT) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id name createdAt processedAt updatedAt cancelledAt
      displayFinancialStatus displayFulfillmentStatus
      currencyCode email phone note tags sourceName paymentGatewayNames
      totalPriceSet { shopMoney { amount } }
      subtotalPriceSet { shopMoney { amount } }
      totalShippingPriceSet { shopMoney { amount } }
      totalTaxSet { shopMoney { amount } }
      totalDiscountsSet { shopMoney { amount } }
      totalRefundedSet { shopMoney { amount } }
      totalOutstandingSet { shopMoney { amount } }
      shippingLine { title }
      shippingAddress { name phone address1 address2 zip city province country validationResultSummary coordinatesValidated }
      lineItems(first: 50) { nodes { name quantity sku } }
    }
  }
}`;

export const SHOPIFY_SHOP_QUERY = `query { shop { name currencyCode } }`;

type Money = { shopMoney?: { amount?: string | null } | null } | null | undefined;

export interface ShopifyOrderNode {
  id: string;
  name: string;
  createdAt?: string | null;
  processedAt?: string | null;
  updatedAt: string;
  cancelledAt?: string | null;
  displayFinancialStatus?: string | null;
  displayFulfillmentStatus?: string | null;
  currencyCode?: string | null;
  email?: string | null;
  phone?: string | null;
  note?: string | null;
  tags?: string[] | null;
  sourceName?: string | null;
  paymentGatewayNames?: string[] | null;
  totalPriceSet?: Money;
  subtotalPriceSet?: Money;
  totalShippingPriceSet?: Money;
  totalTaxSet?: Money;
  totalDiscountsSet?: Money;
  totalRefundedSet?: Money;
  totalOutstandingSet?: Money;
  shippingLine?: { title?: string | null } | null;
  shippingAddress?: {
    name?: string | null;
    phone?: string | null;
    address1?: string | null;
    address2?: string | null;
    zip?: string | null;
    city?: string | null;
    province?: string | null;
    country?: string | null;
    validationResultSummary?: string | null;
    coordinatesValidated?: boolean | null;
  } | null;
  lineItems?: { nodes?: { name?: string | null; quantity?: number | null; sku?: string | null }[] | null } | null;
}

const amount = (money: Money) => {
  const raw = money?.shopMoney?.amount;
  if (raw === null || raw === undefined || raw === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
};
const day = (iso?: string | null) => (iso ? iso.slice(0, 10) : null);
const join = (values: (string | null | undefined)[] | null | undefined, separator = ', ') => {
  const list = (values ?? []).filter((v): v is string => Boolean(v && v.trim()));
  return list.length ? list.join(separator) : null;
};
const yesNo = (value: boolean | null | undefined) => (value === null || value === undefined ? null : value ? 'Sim' : 'Não');

/** Uma encomenda da Shopify em valores por campo (os de `SHOPIFY_ORDER_FIELDS`). */
export function mapShopifyOrder(order: ShopifyOrderNode): Record<string, CellValue> {
  const address = order.shippingAddress ?? null;
  const items = order.lineItems?.nodes ?? [];
  const validation = address?.validationResultSummary ?? null;
  return {
    name: order.name,
    // O id numérico (o da loja), sem o «gid://shopify/Order/»
    id: order.id.split('/').pop() ?? order.id,
    createdAt: day(order.createdAt),
    processedAt: day(order.processedAt),
    updatedAt: day(order.updatedAt),
    cancelledAt: day(order.cancelledAt),
    financialStatus: order.displayFinancialStatus?.toLowerCase() ?? null,
    fulfillmentStatus: order.displayFulfillmentStatus?.toLowerCase() ?? null,
    totalPrice: amount(order.totalPriceSet),
    subtotalPrice: amount(order.subtotalPriceSet),
    totalShipping: amount(order.totalShippingPriceSet),
    totalTax: amount(order.totalTaxSet),
    totalDiscounts: amount(order.totalDiscountsSet),
    totalRefunded: amount(order.totalRefundedSet),
    totalOutstanding: amount(order.totalOutstandingSet),
    currency: order.currencyCode ?? null,
    paymentGateways: join(order.paymentGatewayNames),
    shippingMethod: order.shippingLine?.title ?? null,
    email: order.email ?? null,
    phone: order.phone ?? null,
    shippingName: address?.name ?? null,
    shippingPhone: address?.phone ?? null,
    shippingAddress1: address?.address1 ?? null,
    shippingAddress2: address?.address2 ?? null,
    shippingZip: address?.zip ?? null,
    shippingCity: address?.city ?? null,
    shippingProvince: address?.province ?? null,
    shippingCountry: address?.country ?? null,
    addressValidation: validation,
    // ERROR é morada errada; WARNING é só um aviso (a morada pode estar certa)
    addressError: validation ? (validation === 'ERROR' ? 'Sim' : 'Não') : null,
    coordinatesValidated: yesNo(address?.coordinatesValidated),
    items: join(items.map((i) => i.name), ' + '),
    itemsQuantity: items.length ? items.reduce((sum, i) => sum + (i.quantity ?? 0), 0) : null,
    skus: join(items.map((i) => i.sku)),
    tags: join(order.tags),
    note: order.note ?? null,
    sourceName: order.sourceName ?? null,
  };
}
