import { decryptSecret, secretContext } from 'src/utils/crypto/secret-box';
import { DataConnectionRecord, DataTableRecord, PrismaCompanyDataRepository } from '../../repositories/prisma/prisma-company-data-repository';
import { ImportRow } from '../../repositories/company-data-repository';
import { DataColumn, RowData } from '../dataTypes';
import { parseCellValue } from '../parseCellValue';
import { fetchShopifyOrders } from './shopifyClient';
import { mapShopifyOrder, ShopifyOrderNode } from './shopifyOrders';

/// Por volta, no máximo (100 cada): o resto fica para a seguinte, a partir do cursor
const MAX_PAGES = 50;
/// O cursor volta uns minutos atrás: uma encomenda mexida no mesmo segundo não se perde
const OVERLAP_MS = 5 * 60 * 1000;

/// A chave cifrada com a empresa no contexto (copiada para outra empresa não decifra), como as do banco de horas
export const credentialsContext = (companyId: string) => secretContext('company_data_connection', companyId, 'credentials');

/** As linhas de uma página: cada encomenda nos campos ligados às colunas (pelo tipo delas), pela chave. */
export function ordersToRows(orders: ShopifyOrderNode[], mapping: Record<string, string>, table: Pick<DataTableRecord, 'columns' | 'keyColumn'>) {
  const columns = new Map((table.columns as unknown as DataColumn[]).map((c) => [c.key, c]));
  const rows = new Map<string, ImportRow>();
  for (const order of orders) {
    const values = mapShopifyOrder(order);
    const data: RowData = {};
    for (const [field, key] of Object.entries(mapping)) {
      const column = columns.get(key);
      if (!column) continue;
      const parsed = parseCellValue(values[field] ?? null, column.type);
      data[key] = 'error' in parsed ? null : parsed.value;
    }
    const key = table.keyColumn ? data[table.keyColumn] : null;
    if (key === null || key === undefined || String(key).trim() === '') continue;
    // A mesma encomenda duas vezes na página: fica a última
    rows.set(String(key).trim(), { key: String(key).trim(), data });
  }
  return [...rows.values()];
}

/**
 * Uma volta de uma ligação: as encomendas mexidas desde o cursor, página a página (cada uma numa transação, com o
 * cursor gravado no fim dela), juntadas à tabela pela chave como uma importação. Devolve os números.
 */
export async function syncDataConnection(repository: PrismaCompanyDataRepository, connection: DataConnectionRecord) {
  const table = await repository.findTable(connection.tableId);
  if (!table) throw new Error('A tabela da ligação já não existe');
  const token = decryptSecret(connection.credentials, credentialsContext(connection.companyId));
  const mapping = connection.mapping as Record<string, string>;
  const record = await repository.transaction((tx) =>
    repository.createImport(tx, { tableId: table.id, fileName: `Shopify · ${connection.baseUrl}`, status: 'done', createdById: connection.createdById }),
  );

  const counts = { created: 0, updated: 0, unchanged: 0, orders: 0 };
  let cursor = connection.cursor;
  const updatedSince = cursor ? new Date(new Date(cursor).getTime() - OVERLAP_MS).toISOString() : null;
  let after: string | null = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await fetchShopifyOrders(connection.baseUrl, token, { after, updatedSince });
    const rows = ordersToRows(result.nodes, mapping, table);
    counts.orders += result.nodes.length;
    const last = result.nodes.at(-1)?.updatedAt ?? null;
    await repository.transaction(async (tx) => {
      if (rows.length) {
        const page = await repository.upsertRows(tx, table.id, record.id, rows);
        counts.created += page.created;
        counts.updated += page.updated;
        counts.unchanged += page.unchanged;
      }
      if (last && (!cursor || last > cursor)) cursor = last;
      await repository.updateConnection(connection.id, { cursor }, tx);
    });
    if (!result.pageInfo.hasNextPage || !result.pageInfo.endCursor) break;
    after = result.pageInfo.endCursor;
  }

  const { orders, ...rowCounts } = counts;
  await repository.updateImport(record.id, rowCounts);
  // As tabelas unidas e as Leads recalculam-se pelo updatedAt da tabela
  if (counts.created || counts.updated) await repository.touchTable(table.id);
  return { ...rowCounts, orders };
}
