import { transactionInstant } from './transactionInstant';

describe('transactionInstant', () => {
  it('sem hora, só o dia', () => {
    expect(transactionInstant('2026-11-26', null)).toBeNull();
    expect(transactionInstant('2026-11-26', undefined)).toBeNull();
  });

  it('a hora que se escreveu, em UTC (também de um fuso à frente ou atrás do UTC)', () => {
    expect(transactionInstant('2026-11-26', '2026-11-26T14:32:00.000Z')?.toISOString()).toBe('2026-11-26T14:32:00.000Z');
    // 00:30 em Lisboa no verão é 23:30 UTC da véspera; 23:00 em Nova Iorque é 04:00 UTC do dia seguinte
    expect(transactionInstant('2026-07-01', '2026-06-30T23:30:00.000Z')).not.toBeNull();
    expect(transactionInstant('2026-11-26', '2026-11-27T04:00:00.000Z')).not.toBeNull();
  });

  it('recusa uma hora noutro dia ou que não é uma data', () => {
    expect(() => transactionInstant('2026-11-26', '2026-11-20T10:00:00.000Z')).toThrow('não bate');
    expect(() => transactionInstant('2026-11-26', 'ontem')).toThrow('não é válida');
  });
});
