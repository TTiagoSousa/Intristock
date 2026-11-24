import { CellValue, DataColumnType } from './dataTypes';
import { parseLooseNumber } from './parseCellValue';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_HEADER = /(^|[^a-z])(tel|telefone|telemóvel|telemovel|phone|mobile|telm)([^a-z]|$)/i;
const DATE_HEADER = /(^|[^a-z])(date|data|dia|day|created|delivery|payout|change|criad[oa]|entrega)([^a-z]|$)/i;
// Os identificadores ficam texto mesmo que sejam números (não se somam e o zero à esquerda conta)
const ID_HEADER = /(^|[^a-z])(id|ref|number|nº|n.º|no|code|código|codigo|waybill|awb|preawb|nif|iban|zip|postal)([^a-z]|$)/i;
const MONEY_TEXT = /^\s*(?:(?:EUR|USD|GBP|BRL|€|\$|£)\s*[-+]?[\d.,]+|[-+]?[\d.,]+\s*(?:EUR|USD|GBP|BRL|€|\$|£))\s*$/i;
const DATE_TEXT = /^(\d{4}-\d{2}-\d{2}|\d{1,2}[/.-]\d{1,2}[/.-]\d{4})/;

/** O tipo que a coluna parece ter, pelo cabeçalho e pelos valores (só uma sugestão: muda-se à mão). */
export function inferColumnType(header: string, values: CellValue[]): DataColumnType {
  const filled = values.filter((v): v is string | number => v !== null && v !== '').slice(0, 300);
  if (!filled.length) return PHONE_HEADER.test(header) ? 'phone' : 'text';

  const texts = filled.filter((v): v is string => typeof v === 'string');
  const numbers = filled.filter((v): v is number => typeof v === 'number');

  if (texts.length === filled.length && texts.every((v) => EMAIL.test(v.trim()))) return 'email';
  if (PHONE_HEADER.test(header)) return 'phone';

  if (DATE_HEADER.test(header)) {
    const serials = numbers.every((n) => n > 20_000 && n < 80_000);
    if (serials && texts.every((t) => DATE_TEXT.test(t.trim()))) return 'date';
  }
  if (texts.length === filled.length && texts.every((t) => DATE_TEXT.test(t.trim()))) return 'date';

  if (ID_HEADER.test(header)) return 'text';

  if (texts.length && texts.every((t) => MONEY_TEXT.test(t))) return 'money';
  if (texts.every((t) => parseLooseNumber(t) !== null)) return 'number';

  return 'text';
}
