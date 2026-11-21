import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { currentMonth, localDay, localMonth, localToday } from './dates';

// O fuso de Portugal: no verão é UTC+1, por isso entre a meia-noite e a uma da
// manhã o dia local já é o seguinte e o UTC ainda é a véspera
beforeAll(() => {
  // (o `process` do Node sem os tipos dele: o tsconfig da app não os tem)
  (globalThis as unknown as { process: { env: Record<string, string> } }).process.env.TZ = 'Europe/Lisbon';
});

afterEach(() => {
  vi.useRealTimers();
});

describe('localToday', () => {
  it('dá o dia local depois da meia-noite do verão, quando em UTC ainda é a véspera', () => {
    vi.useFakeTimers();
    // 00:30 de 15 de julho em Lisboa = 23:30 de 14 de julho em UTC
    vi.setSystemTime(new Date('2026-07-14T23:30:00Z'));
    expect(new Date().toISOString().slice(0, 10)).toBe('2026-07-14');
    expect(localToday()).toBe('2026-07-15');
  });

  it('antes da meia-noite local fica no mesmo dia', () => {
    vi.useFakeTimers();
    // 23:59 de 14 de julho em Lisboa
    vi.setSystemTime(new Date('2026-07-14T22:59:00Z'));
    expect(localToday()).toBe('2026-07-14');
  });

  it('no inverno (UTC+0) o dia local é o de UTC', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-10T00:30:00Z'));
    expect(localToday()).toBe('2026-01-10');
  });
});

describe('localDay / localMonth / currentMonth', () => {
  it('põe zeros à esquerda', () => {
    expect(localDay(new Date(2026, 0, 5, 12))).toBe('2026-01-05');
    expect(localMonth(new Date(2026, 8, 1, 12))).toBe('2026-09');
  });

  it('o mês atual muda à meia-noite local do último dia do mês', () => {
    vi.useFakeTimers();
    // 00:15 de 1 de agosto em Lisboa = 23:15 de 31 de julho em UTC
    vi.setSystemTime(new Date('2026-07-31T23:15:00Z'));
    expect(currentMonth()).toBe('2026-08');
  });
});
