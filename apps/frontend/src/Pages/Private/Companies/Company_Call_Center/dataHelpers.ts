// As contas pequenas das páginas dos dados (sem rede, testadas em dataHelpers.test.ts)

export interface Column_Like {
  key: string;
  label: string;
  sourceHeader?: string | null;
}

/** A key de uma coluna a partir do nome: minúsculas, sem acentos, o resto passa a `_`; repetida leva `_2`, `_3`… */
export const columnKeyOf = (label: string, taken: Iterable<string>) => {
  const base =
    label
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'coluna';
  const used = new Set(taken);
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}_${n}`)) n += 1;
  return `${base}_${n}`;
};

const same = (a: string | null | undefined, b: string | null | undefined) =>
  !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * A que coluna da tabela vai cada cabeçalho do ficheiro, antes de a pessoa mexer: a ligação da
 * importação anterior (se a coluna ainda existe), senão a coluna com o mesmo cabeçalho de origem,
 * o mesmo nome ou a mesma key. Uma coluna só recebe um cabeçalho; os que sobram ficam por ligar ('').
 */
export const suggestMapping = (
  headers: string[],
  columns: Column_Like[],
  previous: Record<string, string> | null | undefined,
): Record<string, string> => {
  const keys = new Set(columns.map((column) => column.key));
  const used = new Set<string>();
  const mapping: Record<string, string> = {};

  for (const header of headers) {
    const before = previous?.[header];
    if (before && keys.has(before) && !used.has(before)) {
      mapping[header] = before;
      used.add(before);
    }
  }
  for (const header of headers) {
    if (mapping[header]) continue;
    const match =
      columns.find((column) => !used.has(column.key) && same(column.sourceHeader, header)) ??
      columns.find((column) => !used.has(column.key) && same(column.label, header)) ??
      columns.find((column) => !used.has(column.key) && same(column.key, header));
    mapping[header] = match?.key ?? '';
    if (match) used.add(match.key);
  }
  return mapping;
};

/** Só os cabeçalhos ligados a uma coluna vão no pedido (o resto o backend ignora). */
export const cleanMapping = (mapping: Record<string, string>) =>
  Object.fromEntries(Object.entries(mapping).filter(([, key]) => key));

/** Uma célula sem nada (sem valor ou texto vazio). */
export const isEmptyValue = (value: string | number | null | undefined) =>
  value === null || value === undefined || (typeof value === 'string' && value.trim() === '');

/** Um valor de uma célula para mostrar: vazio é '—'; os números e as datas no formato da língua. */
export const formatCell = (value: string | number | null | undefined, type: string, locale: string) => {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number') {
    return type === 'money'
      ? value.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : value.toLocaleString(locale);
  }
  if (type === 'date' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
    if (!Number.isNaN(date.getTime())) return date.toLocaleDateString(locale);
  }
  return value;
};

/** Move o elemento `index` uma posição para cima (-1) ou para baixo (+1). */
export const moveItem = <T,>(list: T[], index: number, delta: -1 | 1): T[] => {
  const target = index + delta;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
};
