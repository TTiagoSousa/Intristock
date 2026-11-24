import { CellValue } from './dataTypes';

// UTF-8 (com ou sem BOM); se não for UTF-8 válido, é quase sempre o Windows-1252 do Excel
function decode(buffer: Buffer) {
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    // Sem a marca de ordem dos bytes (U+FEFF) do Excel
    return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  } catch {
    return new TextDecoder('windows-1252').decode(buffer);
  }
}

// O separador mais frequente na primeira linha (fora das aspas)
function detectDelimiter(text: string) {
  const newline = text.search(/\r?\n/);
  const firstLine = newline < 0 ? text : text.slice(0, newline);
  let best = ',';
  let bestCount = -1;
  for (const d of [',', ';', '\t', '|']) {
    let count = 0;
    let quoted = false;
    for (const ch of firstLine) {
      if (ch === '"') quoted = !quoted;
      else if (ch === d && !quoted) count++;
    }
    if (count > bestCount) {
      best = d;
      bestCount = count;
    }
  }
  return best;
}

/** As linhas de um CSV (RFC 4180: aspas, aspas duplas e quebras de linha dentro das aspas). */
export function readCsv(buffer: Buffer): CellValue[][] {
  const text = decode(buffer);
  const delimiter = detectDelimiter(text);
  const rows: CellValue[][] = [];
  let row: CellValue[] = [];
  let field = '';
  let quoted = false;

  const endField = () => {
    const value = field.trim();
    row.push(value === '' ? null : value);
    field = '';
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) endField();
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      endField();
      rows.push(row);
      row = [];
    } else field += ch;
  }

  if (field !== '' || row.length) {
    endField();
    rows.push(row);
  }

  return rows;
}
