import { CellValue, DataColumnType } from './dataTypes';

export type ParsedCell = { value: CellValue } | { error: string };

// O dia 0 do Excel (com o 29 de fevereiro de 1900 que ele inventa)
const EXCEL_EPOCH = Date.UTC(1899, 11, 30);

/** Um número de série do Excel → «AAAA-MM-DD» (com «THH:MM» se tiver horas). */
export function excelSerialToIso(serial: number) {
  const ms = Math.round(EXCEL_EPOCH + serial * 86_400_000);
  const iso = new Date(ms).toISOString();
  return serial % 1 === 0 ? iso.slice(0, 10) : iso.slice(0, 16);
}

/**
 * «6.17 EUR», «€ 1.234,56», «1,234.56» → número. A vírgula ou o ponto que vem
 * por último é o decimal; uma só vírgula com 1 ou 2 casas também.
 */
export function parseLooseNumber(text: string): number | null {
  // O \s apanha também o espaço que não quebra do Excel
  let s = text.replace(/\s/g, '').replace(/^(EUR|USD|GBP|BRL|€|\$|£|R\$)/i, '').replace(/(EUR|USD|GBP|BRL|€|\$|£)$/i, '');
  if (!/^[-+]?[\d.,]+$/.test(s)) return null;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (lastComma >= 0) {
    const decimals = s.length - lastComma - 1;
    s = s.split(',').length === 2 && decimals <= 2 ? s.replace(',', '.') : s.replace(/,/g, '');
  } else if (lastDot >= 0 && s.split('.').length > 2) {
    s = s.replace(/\./g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// «18/11/2026», «18-11-2026 14:05», «2026-11-18», «2026-11-18T14:05:00»
function parseDateText(text: string): string | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(text);
  if (iso) return iso[4] ? `${iso[1]}-${iso[2]}-${iso[3]}T${iso[4]}:${iso[5]}` : `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/.exec(text);
  if (dmy) {
    const [, d, m, y, h, min] = dmy;
    if (Number(m) > 12 || Number(d) > 31) return null;
    const day = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    return h ? `${day}T${h.padStart(2, '0')}:${min}` : day;
  }
  return null;
}

// Um número inteiro como texto, sem notação científica
const numberToText = (n: number) => (Number.isInteger(n) && Math.abs(n) < 1e21 ? BigInt(n).toString() : String(n));

/** O valor de uma célula no tipo da coluna; um que não dá vira erro (a linha fica sem ele). */
export function parseCellValue(raw: CellValue | undefined, type: DataColumnType): ParsedCell {
  if (raw === null || raw === undefined || (typeof raw === 'string' && raw.trim() === '')) return { value: null };

  switch (type) {
    case 'number':
    case 'money': {
      const n = typeof raw === 'number' ? raw : parseLooseNumber(raw);
      return n === null ? { error: `«${raw}» não é um número` } : { value: n };
    }
    case 'date': {
      if (typeof raw === 'number') {
        return raw > 0 && raw < 2_958_466 ? { value: excelSerialToIso(raw) } : { error: `«${raw}» não é uma data` };
      }
      const date = parseDateText(raw.trim());
      return date ? { value: date } : { error: `«${raw}» não é uma data` };
    }
    case 'email':
      return { value: String(raw).trim().toLowerCase() };
    case 'phone':
    case 'text':
    default:
      return { value: typeof raw === 'number' ? numberToText(raw) : raw.trim().replace(/\s+/g, ' ') };
  }
}
