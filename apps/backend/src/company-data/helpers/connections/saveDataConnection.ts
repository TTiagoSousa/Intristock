import { BadRequestException } from '@nestjs/common';
import { DataColumn } from '../dataTypes';
import { SHOPIFY_ORDER_FIELDS, SHOPIFY_SHOP } from './shopifyOrders';

export const DATA_CONNECTION_PROVIDERS = ['shopify'] as const;
export type DataConnectionProvider = (typeof DATA_CONNECTION_PROVIDERS)[number];
export const CONNECTION_SYNC_HOURS = [1, 24, 168] as const;
export const MAX_CONNECTIONS = 10;

/** A loja como vem escrita (com https://, barra, maiúsculas) passa ao domínio; outro endereço recusa-se. */
export function normalizeShop(raw: string) {
  const shop = raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '');
  if (!SHOPIFY_SHOP.test(shop)) throw new BadRequestException('A loja tem de ser o domínio da Shopify (a-tua-loja.myshopify.com)');
  return shop;
}

/**
 * A ligação campo → coluna: só campos das encomendas e colunas da tabela, uma coluna por campo, e a coluna chave
 * da tabela tem de vir de algum (é por ela que as encomendas se juntam às linhas).
 */
export function assertConnectionMapping(raw: unknown, table: { columns: unknown; keyColumn: string | null }) {
  if (!table.keyColumn) throw new BadRequestException('A tabela precisa de uma coluna chave (o número da encomenda) para receber a ligação');
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new BadRequestException('A ligação dos campos não é válida');
  const columns = new Set((table.columns as DataColumn[]).map((c) => c.key));
  const fields = new Set(SHOPIFY_ORDER_FIELDS.map((f) => f.field));
  const mapping: Record<string, string> = {};
  const used = new Set<string>();
  for (const [field, key] of Object.entries(raw as Record<string, unknown>)) {
    if (key === null || key === '' || key === undefined) continue;
    if (!fields.has(field)) throw new BadRequestException(`Campo desconhecido: ${field}`);
    if (typeof key !== 'string' || !columns.has(key)) throw new BadRequestException('Uma das colunas não é da tabela');
    if (used.has(key)) throw new BadRequestException('Dois campos vão para a mesma coluna');
    used.add(key);
    mapping[field] = key;
  }
  if (!used.has(table.keyColumn)) throw new BadRequestException('A coluna chave da tabela tem de receber um campo (o número da encomenda)');
  return mapping;
}

/** As colunas de uma tabela nova feita para os campos escolhidos (a chave é o número da encomenda). */
export function columnsForFields(fields: string[]) {
  const chosen = SHOPIFY_ORDER_FIELDS.filter((f) => f.field === 'name' || fields.includes(f.field));
  const columns: DataColumn[] = chosen.map((f) => ({
    key: f.field.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/[^a-z0-9_]/g, ''),
    label: f.label,
    type: f.type,
    personal: f.personal,
    hidden: false,
    sourceHeader: null,
  }));
  const mapping = Object.fromEntries(chosen.map((f, i) => [f.field, columns[i].key]));
  return { columns, mapping, keyColumn: mapping.name };
}
