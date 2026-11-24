import { describe, expect, it } from 'vitest';
import { callbackState, cardTitle, daysInStage, dayLabel, dropIndex, dropPosition, filterCards, fromLocalInput, initialsOf, relativeTime, toLocalInput } from './leadHelpers';
import type { Lead_Card } from '../../../../Hooks/Companies/useCompanyLeads';

describe('leadHelpers', () => {
  it('o título é a coluna escolhida ou, sem ela, a linha', () => {
    expect(cardTitle({ rowKey: '#1500' }, 'name', { name: 'Ana Silva' })).toBe('Ana Silva');
    expect(cardTitle({ rowKey: '#1500' }, 'name', { name: '  ' })).toBe('#1500');
    expect(cardTitle({ rowKey: '#1500|0080530' }, null, {})).toBe('#1500 · 0080530');
    expect(cardTitle({ rowKey: '|0080530' }, null, {})).toBe('0080530');
  });

  it('um cartão largado fica entre os vizinhos', () => {
    const column = [{ position: 1 }, { position: 2 }, { position: 1_000_000 }];
    expect(dropPosition(column, 0)).toBe(0);
    expect(dropPosition(column, 1)).toBe(1.5);
    expect(dropPosition(column, 2)).toBe(500_001);
    expect(dropPosition(column, 3)).toBe(1_000_001);
    expect(dropPosition([], 0)).toBe(1);
  });

  it('cai antes do primeiro cartão cujo meio está abaixo do rato', () => {
    expect(dropIndex([100, 200, 300], 50)).toBe(0);
    expect(dropIndex([100, 200, 300], 150)).toBe(1);
    expect(dropIndex([100, 200, 300], 350)).toBe(3);
    expect(dropIndex([], 10)).toBe(0);
  });
});

describe('comentários', () => {
  it('as iniciais são a primeira e a última palavra', () => {
    expect(initialsOf('Tiago')).toBe('T');
    expect(initialsOf('ana maria silva')).toBe('AS');
    expect(initialsOf(null)).toBe('?');
  });

  it('o tempo diz-se como se fala, e a data passada uma semana', () => {
    const now = new Date('2026-11-23T14:30:00');
    expect(relativeTime('2026-11-23T14:29:50', now, 'pt-PT')).toBe('agora');
    expect(relativeTime('2026-11-23T14:21:00', now, 'pt-PT')).toContain('9');
    expect(relativeTime('2026-11-23T11:30:00', now, 'pt-PT')).toContain('3');
    expect(relativeTime('2026-11-22T14:30:00', now, 'pt-PT')).toBe('ontem');
    expect(relativeTime('2026-11-01T10:00:00', now, 'pt-PT')).toMatch(/1/);
  });
});

describe('o quadro: filtros, voltar a ligar e dias na coluna', () => {
  const now = new Date('2026-11-23T12:00:00');
  const card = (rowKey: string, extra: Partial<Lead_Card> = {}): Lead_Card => ({
    rowKey,
    leadId: null,
    stageId: 's',
    position: 1,
    outOfFilter: false,
    missing: false,
    archived: false,
    byRule: null,
    values: { name: rowKey, phone: '+351 912 345 678', city: 'Évora' },
    comments: 0,
    updatedAt: null,
    assignedToId: null,
    callbackAt: null,
    callbackNote: null,
    attempts: 0,
    lastOutcome: null,
    stageEnteredAt: null,
    ...extra,
  });

  it('o voltar a ligar: em atraso, hoje ou noutro dia', () => {
    expect(callbackState(null, now)).toBeNull();
    expect(callbackState(new Date('2026-11-23T11:00:00').toISOString(), now)).toBe('overdue');
    expect(callbackState(new Date('2026-11-23T18:00:00').toISOString(), now)).toBe('today');
    expect(callbackState(new Date('2026-11-24T09:00:00').toISOString(), now)).toBe('later');
  });

  it('os dias na coluna', () => {
    expect(daysInStage(card('a'), now)).toBe(0);
    expect(daysInStage(card('a', { stageEnteredAt: new Date('2026-11-20T11:00:00').toISOString() }), now)).toBe(3);
  });

  it('a pesquisa (sem acentos, pelo telefone só com números) e os filtros rápidos', () => {
    const cards = [
      card('#1', { assignedToId: 'me' }),
      card('#2', { assignedToId: 'other', callbackAt: new Date('2026-11-23T10:00:00').toISOString() }),
      card('#3', { stageEnteredAt: new Date('2026-11-15T10:00:00').toISOString(), values: { name: '#3', phone: '+351 900 111 222', city: 'Porto' } }),
    ];
    const run = (query: string, quick: Parameters<typeof filterCards>[1]['quick'], staleDays = 3) =>
      filterCards(cards, { query, quick, staleDays, me: 'me', now }).map((c) => c.rowKey);
    expect(run('evora', 'all')).toEqual(['#1', '#2']);
    expect(run('900111', 'all')).toEqual(['#3']);
    expect(run('', 'mine')).toEqual(['#1']);
    expect(run('', 'unassigned')).toEqual(['#3']);
    expect(run('', 'callbacks')).toEqual(['#2']);
    expect(run('', 'stale', 7)).toEqual(['#3']);
  });

  it('a data do campo datetime-local vai e volta na hora local', () => {
    const at = new Date('2026-11-23T15:30:00');
    expect(toLocalInput(at)).toBe('2026-11-23T15:30');
    expect(fromLocalInput('2026-11-23T15:30')).toBe(at.toISOString());
    expect(fromLocalInput('')).toBeNull();
  });

  it('o dia na conversa: hoje, ontem ou a data', () => {
    expect(dayLabel(new Date('2026-11-23T09:00:00').toISOString(), now, 'pt-PT')).toBe('hoje');
    expect(dayLabel(new Date('2026-11-22T09:00:00').toISOString(), now, 'pt-PT')).toBe('ontem');
  });
});
