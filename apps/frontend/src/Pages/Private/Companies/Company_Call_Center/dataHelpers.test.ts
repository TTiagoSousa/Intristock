import { describe, expect, it } from 'vitest';
import { cleanMapping, columnKeyOf, formatCell, moveItem, suggestMapping } from './dataHelpers';

describe('columnKeyOf', () => {
  it('tira acentos e símbolos', () => {
    expect(columnKeyOf('Nº de referência', [])).toBe('n_de_referencia');
    expect(columnKeyOf('Ref. number', [])).toBe('ref_number');
  });

  it('não repete keys', () => {
    expect(columnKeyOf('Cidade', ['cidade'])).toBe('cidade_2');
    expect(columnKeyOf('Cidade', ['cidade', 'cidade_2'])).toBe('cidade_3');
  });

  it('um nome só com símbolos fica coluna', () => {
    expect(columnKeyOf('###', [])).toBe('coluna');
  });
});

describe('suggestMapping', () => {
  const columns = [
    { key: 'ref', label: 'Referência', sourceHeader: 'Ref. number' },
    { key: 'status', label: 'Estado', sourceHeader: 'Status' },
    { key: 'city', label: 'City' },
  ];

  it('usa a importação anterior, depois o cabeçalho de origem e o nome', () => {
    const mapping = suggestMapping(['Ref. number', 'Status', 'city', 'Weight'], columns, { Status: 'city' });
    expect(mapping).toEqual({ Status: 'city', 'Ref. number': 'ref', city: '', Weight: '' });
  });

  it('ignora uma ligação anterior a uma coluna que já não existe', () => {
    expect(suggestMapping(['Status'], columns, { Status: 'gone' })).toEqual({ Status: 'status' });
  });

  it('cleanMapping deixa só as ligadas', () => {
    expect(cleanMapping({ a: 'x', b: '' })).toEqual({ a: 'x' });
  });
});

describe('formatCell', () => {
  it('vazio é um traço', () => {
    expect(formatCell(null, 'text', 'pt-PT')).toBe('—');
    expect(formatCell('', 'text', 'pt-PT')).toBe('—');
  });

  it('dinheiro com duas casas', () => {
    expect(formatCell(6.1, 'money', 'en-GB')).toBe('6.10');
  });
});

describe('moveItem', () => {
  it('troca com o vizinho e não sai da lista', () => {
    expect(moveItem([1, 2, 3], 0, 1)).toEqual([2, 1, 3]);
    expect(moveItem([1, 2, 3], 0, -1)).toEqual([1, 2, 3]);
  });
});
