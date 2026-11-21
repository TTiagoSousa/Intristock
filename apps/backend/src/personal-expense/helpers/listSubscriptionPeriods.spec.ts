import { listSubscriptionPeriods } from './listSubscriptionPeriods';

const utc = (day: string) => new Date(`${day}T00:00:00.000Z`);
const days = (periods: { period: string; date: Date }[]) =>
  periods.map(({ period, date }) => [period, date.toISOString().slice(0, 10)]);

const plan = (input: Partial<{ recurring: boolean; intervalMonths: number; billingDay: number | null; startDate: string; endDate: string | null }>) => ({
  recurring: input.recurring ?? true,
  intervalMonths: input.intervalMonths ?? 1,
  billingDay: input.billingDay === undefined ? null : input.billingDay,
  startDate: utc(input.startDate ?? '2026-01-15'),
  endDate: input.endDate ? utc(input.endDate) : null,
});

describe('listSubscriptionPeriods', () => {
  it('mensal: no dia do início, todos os meses', () => {
    expect(days(listSubscriptionPeriods(plan({}), utc('2026-01-01'), utc('2026-04-30')))).toEqual([
      ['2026-01', '2026-01-15'],
      ['2026-02', '2026-02-15'],
      ['2026-03', '2026-03-15'],
      ['2026-04', '2026-04-15'],
    ]);
  });

  it('o billingDay no último dia dos meses curtos', () => {
    const periods = listSubscriptionPeriods(plan({ startDate: '2026-01-01', billingDay: 31 }), utc('2026-01-01'), utc('2026-04-30'));
    expect(days(periods)).toEqual([
      ['2026-01', '2026-01-31'],
      ['2026-02', '2026-02-28'],
      ['2026-03', '2026-03-31'],
      ['2026-04', '2026-04-30'],
    ]);
  });

  it('no primeiro mês nunca antes do início', () => {
    const periods = listSubscriptionPeriods(plan({ startDate: '2026-01-20', billingDay: 5 }), utc('2026-01-01'), utc('2026-03-31'));
    expect(days(periods)).toEqual([
      ['2026-01', '2026-01-20'],
      ['2026-02', '2026-02-05'],
      ['2026-03', '2026-03-05'],
    ]);
  });

  it('de N em N meses, a contar do mês do início', () => {
    const periods = listSubscriptionPeriods(plan({ startDate: '2026-02-10', intervalMonths: 3 }), utc('2026-01-01'), utc('2027-03-31'));
    expect(periods.map((p) => p.period)).toEqual(['2026-02', '2026-05', '2026-08', '2026-11', '2027-02']);
  });

  it('anual que passa de ano', () => {
    const periods = listSubscriptionPeriods(plan({ startDate: '2025-12-31', intervalMonths: 12 }), utc('2025-01-01'), utc('2028-12-31'));
    expect(days(periods)).toEqual([
      ['2025-12', '2025-12-31'],
      ['2026-12', '2026-12-31'],
      ['2027-12', '2027-12-31'],
      ['2028-12', '2028-12-31'],
    ]);
  });

  it('só os de `from` a `until` (inclusive) e até ao endDate', () => {
    const periods = listSubscriptionPeriods(plan({ endDate: '2026-05-15' }), utc('2026-03-15'), utc('2026-12-31'));
    expect(periods.map((p) => p.period)).toEqual(['2026-03', '2026-04', '2026-05']);
  });

  it('um só pagamento (once), no dia do início, se estiver no intervalo', () => {
    const once = plan({ recurring: false, startDate: '2026-06-01', endDate: '2027-05-31' });
    expect(days(listSubscriptionPeriods(once, utc('2026-01-01'), utc('2026-12-31')))).toEqual([['once', '2026-06-01']]);
    expect(listSubscriptionPeriods(once, utc('2026-07-01'), utc('2026-12-31'))).toEqual([]);
  });

  it('intervalMonths 0 vale como 1 (não fica num ciclo sem fim)', () => {
    const periods = listSubscriptionPeriods(plan({ intervalMonths: 0 }), utc('2026-01-01'), utc('2026-03-31'));
    expect(periods.map((p) => p.period)).toEqual(['2026-01', '2026-02', '2026-03']);
  });
});
