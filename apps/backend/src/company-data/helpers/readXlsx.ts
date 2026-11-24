import { inflateRawSync } from 'zlib';
import { BadRequestException } from '@nestjs/common';
import { CellValue } from './dataTypes';

// Um .xlsx é um zip de XML. Lê-se aqui sem dependências: o diretório central do
// zip, os ficheiros que interessam (o livro, as ligações, as strings partilhadas
// e a primeira folha) e as células dela.

// Tudo descomprimido junto não passa disto (contra um zip que rebenta a memória)
const MAX_UNZIPPED = 120 * 1024 * 1024;

interface ZipEntry {
  method: number;
  compressedSize: number;
  localOffset: number;
}

function zipEntries(buffer: Buffer): Map<string, ZipEntry> {
  // O fim do diretório central está nos últimos 64 KB + 22 bytes
  let end = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65_557); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new BadRequestException('O ficheiro Excel está danificado');

  const count = buffer.readUInt16LE(end + 10);
  let offset = buffer.readUInt32LE(end + 16);
  const entries = new Map<string, ZipEntry>();

  for (let i = 0; i < count; i++) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new BadRequestException('O ficheiro Excel está danificado');
    }
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength);
    entries.set(name, {
      method: buffer.readUInt16LE(offset + 10),
      compressedSize: buffer.readUInt32LE(offset + 20),
      localOffset: buffer.readUInt32LE(offset + 42),
    });
    offset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

function readEntry(buffer: Buffer, entry: ZipEntry, budget: { left: number }): string {
  const local = entry.localOffset;
  if (local + 30 > buffer.length || buffer.readUInt32LE(local) !== 0x04034b50) {
    throw new BadRequestException('O ficheiro Excel está danificado');
  }
  const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
  const data = buffer.subarray(start, start + entry.compressedSize);

  let out: Buffer;
  if (entry.method === 0) out = data;
  else if (entry.method === 8) {
    try {
      out = inflateRawSync(data, { maxOutputLength: budget.left });
    } catch {
      throw new BadRequestException('O ficheiro Excel é grande demais ou está danificado');
    }
  } else throw new BadRequestException('O ficheiro Excel usa uma compressão que não se lê');

  budget.left -= out.length;
  if (budget.left <= 0) throw new BadRequestException('O ficheiro Excel é grande demais');
  return out.toString('utf8');
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

export function decodeXml(text: string) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (all, code: string) => {
    if (code[0] === '#') {
      const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : all;
    }
    return ENTITIES[code] ?? all;
  });
}

// O texto de um <si> ou <is>: todas as partes <t>, sem a fonética (<rPh>)
function richText(xml: string) {
  const plain = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '');
  let text = '';
  for (const m of plain.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)) text += m[1];
  return decodeXml(text);
}

const attr = (attrs: string, name: string) => new RegExp(`\\b${name}="([^"]*)"`).exec(attrs)?.[1];

// A1 → 0, AB7 → 27
function columnIndex(ref: string) {
  let n = 0;
  for (const ch of ref) {
    const code = ch.charCodeAt(0);
    if (code < 65 || code > 90) break;
    n = n * 26 + (code - 64);
  }
  return n - 1;
}

function resolveTarget(target: string) {
  if (target.startsWith('/')) return target.slice(1);
  return `xl/${target.replace(/^\.\//, '')}`;
}

/** As linhas da primeira folha, cada célula como número, texto ou nula. */
export function readXlsx(buffer: Buffer): CellValue[][] {
  const entries = zipEntries(buffer);
  const budget = { left: MAX_UNZIPPED };
  const read = (name: string) => {
    const entry = entries.get(name);
    return entry ? readEntry(buffer, entry, budget) : null;
  };

  const workbook = read('xl/workbook.xml');
  if (!workbook) throw new BadRequestException('O ficheiro não é um Excel (.xlsx)');

  const firstSheet = /<sheet\b([^>]*)\/?>/.exec(workbook);
  const relId = firstSheet ? attr(firstSheet[1], 'r:id') : undefined;
  let sheetPath = 'xl/worksheets/sheet1.xml';
  const rels = read('xl/_rels/workbook.xml.rels');
  if (relId && rels) {
    for (const m of rels.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
      if (attr(m[1], 'Id') === relId) {
        const target = attr(m[1], 'Target');
        if (target) sheetPath = resolveTarget(target);
      }
    }
  }

  const shared: string[] = [];
  const sharedXml = read('xl/sharedStrings.xml');
  if (sharedXml) for (const m of sharedXml.matchAll(/<si>([\s\S]*?)<\/si>/g)) shared.push(richText(m[1]));

  const sheet = read(sheetPath);
  if (!sheet) throw new BadRequestException('O ficheiro Excel não tem folhas');

  const rows: CellValue[][] = [];
  for (const rowMatch of sheet.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const rowNumber = Number(attr(rowMatch[1], 'r') ?? rows.length + 1);
    const row: CellValue[] = [];
    let next = 0;

    for (const cell of (rowMatch[2] ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = attr(cell[1], 'r');
      const index = ref ? columnIndex(ref) : next;
      next = index + 1;
      const type = attr(cell[1], 't');
      const inner = cell[2] ?? '';
      const raw = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];

      let value: CellValue = null;
      if (type === 's') value = raw !== undefined ? (shared[Number(raw)] ?? null) : null;
      else if (type === 'inlineStr') value = richText(inner);
      else if (type === 'str' || type === 'e') value = raw !== undefined ? decodeXml(raw) : null;
      else if (type === 'b') value = raw === '1' ? 'TRUE' : 'FALSE';
      else if (raw !== undefined) {
        const n = Number(raw);
        value = Number.isFinite(n) ? n : decodeXml(raw);
      }

      row[index] = value === '' ? null : value;
    }

    // As linhas que faltam (o Excel não as escreve se estiverem vazias)
    while (rows.length < rowNumber - 1) rows.push([]);
    rows.push(Array.from(row, (v) => v ?? null));
  }

  return rows;
}
