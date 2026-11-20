/**
 * O que os formulários dos portefólios partilham: ler um número escrito à portuguesa
 * ou à inglesa, o dia de hoje na hora local e mostrar um dia (sem hora) sem o fuso o mudar.
 */

const pad = (value: number) => String(value).padStart(2, '0');

// Grupos de milhares bem feitos: 1.234.567 (o primeiro grupo sem zero à frente)
const grouped = (value: string, mark: string) => new RegExp(`^[1-9]\\d{0,2}(\\${mark}\\d{3})+$`).test(value);

const read = (body: string, decimalMark: string | null, groupMark: string | null) => {
  const at = decimalMark ? body.lastIndexOf(decimalMark) : -1;
  const integer = at >= 0 ? body.slice(0, at) : body;
  const decimals = at >= 0 ? body.slice(at + 1) : '';
  if (at >= 0 && !/^\d+$/.test(decimals)) return null;
  let digits: string;
  if (groupMark && integer.includes(groupMark)) {
    if (!grouped(integer, groupMark)) return null;
    digits = integer.split(groupMark).join('');
  } else if (/^\d+$/.test(integer) || (integer === '' && decimals !== '')) digits = integer || '0';
  else return null;
  const value = Number(`${digits}.${decimals || '0'}`);
  return Number.isFinite(value) ? value : null;
};

/**
 * Um número escrito à mão: "12.500", "1.200,50", "1200.5", "1200,5", "1 200,50". Com as duas
 * marcas, a última é a das casas decimais; só com vírgulas, uma é a decimal e várias são
 * milhares. Um ponto sozinho com três algarismos depois ("12.500") é de milhares quando
 * `groupDot` (os valores em dinheiro); nas quantidades ("1.500" BTC) é sempre o decimal.
 * Inválido ou vazio → nulo.
 */
export const parseAmount = (raw: string, { groupDot = true }: { groupDot?: boolean } = {}): number | null => {
  // O \s apanha também os espaços finos e inquebráveis (os do Intl e do Excel)
  const text = raw.replace(/\s/g, '');
  if (!text || !/^[+-]?[\d.,]+$/.test(text)) return null;
  const sign = text.startsWith('-') ? -1 : 1;
  const body = text.replace(/^[+-]/, '');
  const dots = body.split('.').length - 1;
  const commas = body.split(',').length - 1;
  let value: number | null;
  if (dots && commas) {
    const decimalMark = body.lastIndexOf('.') > body.lastIndexOf(',') ? '.' : ',';
    if (body.split(decimalMark).length - 1 > 1) return null;
    value = read(body, decimalMark, decimalMark === '.' ? ',' : '.');
  } else if (commas) value = commas > 1 ? read(body, null, ',') : read(body, ',', null);
  else if (dots) value = dots > 1 || (groupDot && grouped(body, '.')) ? read(body, null, '.') : read(body, '.', null);
  else value = read(body, null, null);
  return value === null ? null : sign * value;
};

/** Um número para pôr num campo (a vírgula decimal, sem milhares: lê-se sempre igual). */
export const amountInput = (value: number) => String(Number(value.toPrecision(8))).replace('.', ',');

/** O dia de hoje na hora local (YYYY-MM-DD), não o de UTC. */
export const localToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

/** Um dia sem hora (YYYY-MM-DD ou o ISO das 00:00 UTC de um `@db.Date`), sem o fuso o mudar. */
export const formatDateOnly = (value: string | null | undefined, locale: string) =>
  value ? new Date(`${value.slice(0, 10)}T00:00:00Z`).toLocaleDateString(locale, { timeZone: 'UTC' }) : '—';

/** Uma data completa e válida de um campo `type="date"` (o ano com 4 algarismos). */
export const isFullDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && value >= '1900-01-01';
