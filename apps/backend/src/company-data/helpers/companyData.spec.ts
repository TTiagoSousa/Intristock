import { deflateRawSync } from 'zlib';
import { joinTables } from './joinTables';
import { normalizeJoinValue } from './normalizeJoinValue';
import { excelSerialToIso, parseCellValue, parseLooseNumber } from './parseCellValue';
import { inferColumnType } from './inferColumnType';
import { readCsv } from './readCsv';
import { readXlsx } from './readXlsx';
import { readSpreadsheet } from './readSpreadsheet';
import { assertColumns, columnKeyOf } from './assertColumns';
import { pageJoinedRows } from './pageJoinedRows';
import { DataColumn } from './dataTypes';
import { matchesRowFilter, parseRowFilters } from './rowFilters';
import { joinedColumnValues } from './joinedColumnValues';
import { JoinResult } from './joinTables';

// Um zip mínimo (deflate) com os ficheiros dados, para testar o leitor de .xlsx
function zip(files: Record<string, string>) {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const nameBuf = Buffer.from(name);
    const data = deflateRawSync(Buffer.from(content));
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt16LE(nameBuf.length, 26);
    locals.push(local, nameBuf, data);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);
    offset += 30 + nameBuf.length + data.length;
  }
  const centralBuf = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBuf, end]);
}

const col = (key: string, extra: Partial<DataColumn> = {}): DataColumn => ({
  key,
  label: key,
  type: 'text',
  personal: false,
  hidden: false,
  ...extra,
});

describe('readXlsx', () => {
  it('lê as strings partilhadas, os números, as células em falta e a folha pelas ligações', () => {
    const buffer = zip({
      'xl/workbook.xml': '<workbook><sheets><sheet name="Export" sheetId="1" r:id="rId3"/></sheets></workbook>',
      'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Id="rId3" Target="worksheets/sheet7.xml"/></Relationships>',
      'xl/sharedStrings.xml': '<sst><si><t>Ref. number</t></si><si><r><t>CO</t></r><r><t>D</t></r></si><si><t>#1001 &amp; co</t></si></sst>',
      'xl/worksheets/sheet7.xml':
        '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c></row>' +
        '<row r="3"><c r="A3" t="s"><v>2</v></c><c r="C3"><v>12.5</v></c></row></sheetData></worksheet>',
    });
    expect(readXlsx(buffer)).toEqual([['Ref. number', null, 'COD'], [], ['#1001 & co', null, 12.5]]);
  });
});

describe('readSpreadsheet', () => {
  it('tira as linhas vazias, numera os cabeçalhos repetidos e vê a linha de totais', () => {
    const csv = Buffer.from(String.fromCharCode(0xfeff) + 'Ref;Valor;Valor\n#1;1,5;x\n\n#2;2;y\nTotal: 2 shipments;3,5;\n');
    const sheet = readSpreadsheet({ buffer: csv, size: csv.length });
    expect(sheet.headers).toEqual(['Ref', 'Valor', 'Valor (2)']);
    expect(sheet.rows).toHaveLength(3);
    expect(sheet.totalsRowDetected).toBe(true);
  });

  it('recusa um .xls antigo', () => {
    const xls = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0, 0, 0, 0]);
    expect(() => readSpreadsheet({ buffer: xls, size: xls.length })).toThrow(/xlsx/);
  });
});

describe('readCsv', () => {
  it('aceita aspas, aspas duplas e quebras de linha dentro das aspas', () => {
    expect(readCsv(Buffer.from('a,b\n"x, y","diz ""olá""\nfim"\r\n'))).toEqual([
      ['a', 'b'],
      ['x, y', 'diz "olá"\nfim'],
    ]);
  });
});

describe('parseCellValue', () => {
  it('converte números com moeda e os dois separadores', () => {
    expect(parseLooseNumber('6.17 EUR')).toBe(6.17);
    expect(parseLooseNumber('€ 1.234,56')).toBe(1234.56);
    expect(parseLooseNumber('1,234.56')).toBe(1234.56);
    expect(parseLooseNumber('1,5')).toBe(1.5);
    expect(parseLooseNumber('abc')).toBeNull();
  });

  it('passa os números de série do Excel e as datas em texto a ISO', () => {
    expect(excelSerialToIso(46330)).toBe('2026-11-04');
    expect(parseCellValue(46330.5, 'date')).toEqual({ value: '2026-11-04T12:00' });
    expect(parseCellValue('18/11/2026', 'date')).toEqual({ value: '2026-11-18' });
    expect(parseCellValue('ontem', 'date')).toHaveProperty('error');
  });

  it('um identificador numérico fica texto sem notação científica', () => {
    expect(parseCellValue(12345678, 'text')).toEqual({ value: '12345678' });
    expect(parseCellValue('  ', 'number')).toEqual({ value: null });
  });
});

describe('inferColumnType', () => {
  it('sugere pelo cabeçalho e pelos valores', () => {
    expect(inferColumnType('ORDER ID', [12345678, 23456789])).toBe('text');
    expect(inferColumnType('Tel.', ['+351 912 345 678'])).toBe('phone');
    expect(inferColumnType('Created at', [46330, 46331.4])).toBe('date');
    expect(inferColumnType('Final price Euro', ['6.17 EUR', '7.00 EUR'])).toBe('money');
    expect(inferColumnType('Weight', [1.2, 0.5])).toBe('number');
    expect(inferColumnType('Email', ['a@b.pt'])).toBe('email');
    expect(inferColumnType('Status', ['Delivered'])).toBe('text');
  });
});

describe('assertColumns', () => {
  it('gera chaves sem acentos e sem repetir, e mantém as que vêm', () => {
    expect(columnKeyOf('Telemóvel n.º')).toBe('telemovel_n');
    const columns = assertColumns([
      { label: 'Ref. number', type: 'text' },
      { label: 'Ref number', type: 'text' },
      { key: 'cod', label: 'COD', type: 'money', personal: true },
    ]);
    expect(columns.map((c) => c.key)).toEqual(['ref_number', 'ref_number_2', 'cod']);
    expect(columns[2].personal).toBe(true);
  });

  it('recusa nomes repetidos e tipos inválidos', () => {
    expect(() => assertColumns([{ label: 'A', type: 'text' }, { label: 'a', type: 'text' }])).toThrow();
    expect(() => assertColumns([{ label: 'A', type: 'blob' }])).toThrow();
  });
});

describe('normalizeJoinValue', () => {
  it('aplica os passos pela mesma ordem', () => {
    expect(normalizeJoinValue('  #1234 Return: ab1 ', ['firstToken'])).toBe('#1234');
    expect(normalizeJoinValue('+351 912-345', ['digits'])).toBe('351912345');
    expect(normalizeJoinValue(' ABC ', ['trim', 'lower'])).toBe('abc');
    expect(normalizeJoinValue('   ', ['trim'])).toBeNull();
  });
});

describe('joinTables', () => {
  const shopify = {
    columns: [col('name'), col('email', { personal: true })],
    rows: [
      { name: '#1001', email: 'a@x.pt' },
      { name: '#1002', email: 'b@x.pt' },
      { name: '#1003', email: 'c@x.pt' },
    ],
  };
  const shipments = {
    columns: [col('ref'), col('status')],
    rows: [
      { ref: '#1001', status: 'Delivered' },
      { ref: '#1002 Return: ab1', status: 'Returned' },
      { ref: '#1002', status: 'In the office' },
      { ref: '#9999', status: 'PreAlert' },
    ],
  };
  const base = {
    left: shopify,
    right: shipments,
    joinOn: [{ left: 'name', right: 'ref', normalize: ['firstToken' as const] }],
    columns: [
      { side: 'left' as const, column: 'name', label: 'Encomenda' },
      { side: 'left' as const, column: 'email', label: 'Email' },
      { side: 'right' as const, column: 'status', label: 'Estado' },
    ],
  };

  it('junta todas as da A e marca as repetidas', () => {
    const result = joinTables({ ...base, joinType: 'left' });
    expect(result.stats).toEqual({ matched: 3, leftOnly: 1, rightOnly: 1, duplicates: 2, leftRows: 3, rightRows: 4 });
    expect(result.rows.map((r) => [r.values.c0, r.values.c2, r.match])).toEqual([
      ['#1001', 'Delivered', 'matched'],
      ['#1002', 'Returned', 'matched'],
      ['#1002', 'In the office', 'matched'],
      ['#1003', null, 'leftOnly'],
    ]);
    expect(result.columns[1]).toMatchObject({ personal: true, label: 'Email' });
  });

  it('só as que têm par, ou todas de ambos', () => {
    expect(joinTables({ ...base, joinType: 'inner' }).rows).toHaveLength(3);
    const full = joinTables({ ...base, joinType: 'full' });
    expect(full.rows).toHaveLength(5);
    expect(full.rows[4]).toMatchObject({ match: 'rightOnly', values: { c0: null, c2: 'PreAlert' } });
  });

  it('a página esconde as colunas pessoais e não pesquisa nelas', () => {
    const result = joinTables({ ...base, joinType: 'left' });
    const masked = pageJoinedRows(result, false, { page: 1, take: 10 });
    expect(masked.rows[0].values.c1).toBe('•••');
    expect(pageJoinedRows(result, false, { page: 1, take: 10, search: 'a@x' }).total).toBe(0);
    expect(pageJoinedRows(result, true, { page: 1, take: 10, search: 'a@x' }).total).toBe(1);
    expect(pageJoinedRows(result, true, { page: 1, take: 10, only: 'duplicates' }).total).toBe(2);
    expect(pageJoinedRows(result, true, { page: 1, take: 10, only: 'leftOnly' }).total).toBe(1);
  });

  it('cada linha leva o que a identifica dos dois lados', () => {
    const refs = (side: { rows: unknown[] }, prefix: string) => side.rows.map((_r, i) => `${prefix}${i}`);
    const full = joinTables({
      ...base,
      left: { ...shopify, refs: refs(shopify, 'a') },
      right: { ...shipments, refs: refs(shipments, 'b') },
      joinType: 'full',
    });
    expect(full.rows.map((r) => r.ref)).toEqual(['a0|b0', 'a1|b1', 'a1|b2', 'a2|', '|b3']);
  });

  it('a tabela unida aplica os filtros', () => {
    const result = joinTables({ ...base, joinType: 'left' });
    const filters = JSON.stringify([{ column: 'c2', op: 'equals', value: 'delivered' }]);
    expect(pageJoinedRows(result, true, { page: 1, take: 10, filters }).total).toBe(1);
  });
});

describe('filtros por coluna', () => {
  const columns = [
    { key: 'name', type: 'text' as const, personal: false },
    { key: 'email', type: 'email' as const, personal: true },
    { key: 'total', type: 'money' as const, personal: false },
    { key: 'paid', type: 'date' as const, personal: false },
  ];
  const one = (filter: object) => parseRowFilters(JSON.stringify([filter]), columns, true)[0];

  it('valida as colunas, as condições e os valores', () => {
    expect(parseRowFilters(undefined, columns, true)).toEqual([]);
    expect(() => parseRowFilters('{', columns, true)).toThrow();
    expect(() => parseRowFilters(JSON.stringify([{ column: 'x', op: 'equals', value: '1' }]), columns, true)).toThrow();
    expect(() => parseRowFilters(JSON.stringify([{ column: 'email', op: 'empty' }]), columns, false)).toThrow();
    expect(() => one({ column: 'name', op: 'gt', value: 'a' })).toThrow();
    expect(() => one({ column: 'total', op: 'gt', value: 'abc' })).toThrow();
    expect(() => one({ column: 'paid', op: 'lt', value: '14/11/2026' })).toThrow();
    expect(() => one({ column: 'name', op: 'equals', value: ' ' })).toThrow();
    expect(one({ column: 'total', op: 'gte', value: '27,99' })).toMatchObject({ kind: 'number', number: 27.99 });
  });

  it('cada condição bate como no SQL', () => {
    expect(matchesRowFilter('Paid', one({ column: 'name', op: 'equals', value: 'paid' }))).toBe(true);
    expect(matchesRowFilter(null, one({ column: 'name', op: 'not', value: 'paid' }))).toBe(true);
    expect(matchesRowFilter('Ana Silva', one({ column: 'name', op: 'contains', value: 'SIL' }))).toBe(true);
    expect(matchesRowFilter(' ', one({ column: 'name', op: 'empty' }))).toBe(true);
    expect(matchesRowFilter(30, one({ column: 'total', op: 'gt', value: '27.99' }))).toBe(true);
    expect(matchesRowFilter('30', one({ column: 'total', op: 'gt', value: '27.99' }))).toBe(false);
    expect(matchesRowFilter('2026-11-14T10:00:00Z', one({ column: 'paid', op: 'equals', value: '2026-11-14' }))).toBe(true);
    expect(matchesRowFilter(null, one({ column: 'paid', op: 'lt', value: '2026-11-14' }))).toBe(false);
  });

  it('«é um de» escolhe valores da lista, o vazio também', () => {
    expect(() => one({ column: 'name', op: 'in', values: [] })).toThrow();
    expect(() => one({ column: 'total', op: 'in', values: ['1'] })).toThrow();
    expect(() => one({ column: 'name', op: 'in', values: [1] })).toThrow();
    const filter = one({ column: 'name', op: 'in', values: ['Delivered', ' returned ', ''] });
    expect(filter.values).toEqual(['delivered', 'returned', '']);
    expect(matchesRowFilter('delivered ', filter)).toBe(true);
    expect(matchesRowFilter('RETURNED', filter)).toBe(true);
    expect(matchesRowFilter(null, filter)).toBe(true);
    expect(matchesRowFilter('In the office', filter)).toBe(false);
  });

  it('os valores de uma coluna da tabela unida contam-se sem o filtro dela', () => {
    const result: JoinResult = {
      columns: [
        { key: 'a.status', label: 'Estado', side: 'left', type: 'text', personal: false },
        { key: 'a.email', label: 'Email', side: 'left', type: 'email', personal: true },
        { key: 'a.total', label: 'Total', side: 'left', type: 'number', personal: false },
      ],
      rows: [
        ['Delivered', 1],
        ['delivered ', 2],
        ['Returned', 3],
        [null, 4],
        ['Delivered', 50],
      ].map(([status, total], i) => ({ ref: `${i}|${i}`, match: 'matched' as const, duplicate: false, values: { 'a.status': status, 'a.email': 'x@y.z', 'a.total': total } })),
      stats: { matched: 5, leftOnly: 0, rightOnly: 0, duplicates: 0, leftRows: 5, rightRows: 5 },
    };
    const filters = JSON.stringify([
      { column: 'a.status', op: 'in', values: ['Returned'] },
      { column: 'a.total', op: 'lt', value: '10' },
    ]);
    const found = joinedColumnValues(result, true, { column: 'a.status', filters });
    expect(found.values).toEqual([
      { value: 'Delivered', count: 2 },
      { value: '', count: 1 },
      { value: 'Returned', count: 1 },
    ]);
    expect(joinedColumnValues(result, true, { column: 'a.status', q: 'ret' }).values).toEqual([{ value: 'Returned', count: 1 }]);
    expect(() => joinedColumnValues(result, false, { column: 'a.email' })).toThrow();
    expect(() => joinedColumnValues(result, true, { column: 'a.total' })).toThrow();
  });
});
