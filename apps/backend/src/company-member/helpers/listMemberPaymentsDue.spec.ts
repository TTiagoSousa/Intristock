import { listMemberPaymentsDue } from './listMemberPaymentsDue';

const utc = (day: string) => new Date(`${day}T00:00:00.000Z`);
const EUR = { id: 'eur', shortCode: 'EUR', symbol: '€', rate: 0.92 };

type PayInput = {
  id?: string;
  kind?: 'salary' | 'freelance';
  grossAmount?: number;
  withholdingPct?: number | null;
  paymentsPerYear?: number;
  payDay?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  dueDate?: string | null;
  name?: string;
};

const pay = (input: PayInput) =>
  ({
    id: input.id ?? 'pay-1',
    kind: input.kind ?? 'salary',
    grossAmount: String(input.grossAmount ?? 1000),
    withholdingPct: input.withholdingPct === undefined || input.withholdingPct === null ? null : String(input.withholdingPct),
    paymentsPerYear: input.paymentsPerYear ?? 12,
    payDay: input.payDay === undefined ? 25 : input.payDay,
    startDate: input.startDate === undefined ? utc('2026-01-01') : input.startDate && utc(input.startDate),
    endDate: input.endDate ? utc(input.endDate) : null,
    dueDate: input.dueDate ? utc(input.dueDate) : null,
    description: null,
    member: {
      id: `member-${input.id ?? 'pay-1'}`,
      name: input.name ?? 'Ana',
      user: null,
      currency: null,
      bankAccountId: null,
    },
  }) as never;

const run = (pays: unknown[], from: string, until: string, today = '2026-11-21', paid = new Set<string>()) =>
  listMemberPaymentsDue(pays as never, paid, utc(from), utc(until), utc(today), EUR);

describe('listMemberPaymentsDue', () => {
  it('12 vezes: um salário por mês, no dia dele', () => {
    const due = run([pay({ paymentsPerYear: 12 })], '2026-01-01', '2026-12-31');
    expect(due).toHaveLength(12);
    expect(due.every((entry) => entry.part === 'salary')).toBe(true);
    expect(due[0]).toMatchObject({ period: '2026-01', date: '2026-01-25', grossAmount: 1000, currency: EUR });
  });

  it('14 vezes: o subsídio de férias em junho e o de Natal em dezembro', () => {
    const due = run([pay({ paymentsPerYear: 14 })], '2026-01-01', '2026-12-31');
    expect(due).toHaveLength(14);
    const extras = due.filter((entry) => entry.part !== 'salary');
    expect(extras.map((entry) => [entry.period, entry.part, entry.date])).toEqual([
      ['2026-06:holiday', 'holiday', '2026-06-25'],
      ['2026-12:christmas', 'christmas', '2026-12-25'],
    ]);
  });

  it('nos meses curtos paga no último dia', () => {
    const due = run([pay({ payDay: 31 })], '2026-01-01', '2026-04-30');
    expect(due.map((entry) => entry.date)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
    // 2028 é bissexto
    const leap = run([pay({ payDay: 30, startDate: '2028-01-01' })], '2028-02-01', '2028-02-29');
    expect(leap.map((entry) => entry.date)).toEqual(['2028-02-29']);
  });

  it('corta no `until`: o salário do último mês depois dele não entra', () => {
    const due = run([pay({ payDay: 25 })], '2026-10-01', '2026-11-20');
    expect(due.map((entry) => entry.period)).toEqual(['2026-10']);
  });

  it('respeita o início e o fim do salário', () => {
    const due = run([pay({ startDate: '2026-03-26', endDate: '2026-06-24', paymentsPerYear: 14 })], '2026-01-01', '2026-12-31');
    // março começa depois do dia 25; junho acaba antes do dia 25 (sem o subsídio)
    expect(due.map((entry) => entry.period)).toEqual(['2026-04', '2026-05']);
  });

  it('tira os períodos já pagos e marca os em atraso', () => {
    const due = run(
      [pay({ paymentsPerYear: 14 })],
      '2026-05-01',
      '2026-07-31',
      '2026-06-26',
      new Set(['pay-1|2026-06']),
    );
    expect(due.map((entry) => [entry.period, entry.overdue])).toEqual([
      ['2026-05', true],
      ['2026-06:holiday', true],
      ['2026-07', false],
    ]);
  });

  it('um recibo verde é um pagamento único, com o líquido sem a retenção', () => {
    const due = run(
      [pay({ id: 'free', kind: 'freelance', grossAmount: 1234.56, withholdingPct: 25, dueDate: '2026-12-10', startDate: null, payDay: null })],
      '2026-11-01',
      '2026-12-31',
    );
    expect(due).toHaveLength(1);
    expect(due[0]).toMatchObject({ period: 'once', part: 'freelance', date: '2026-12-10', grossAmount: 1234.56, netAmount: 925.92, withholdingPct: 25 });
  });

  it('o recibo verde depois do `until`, ou já pago, não entra', () => {
    const late = pay({ id: 'late', kind: 'freelance', dueDate: '2027-01-10', startDate: null });
    const done = pay({ id: 'done', kind: 'freelance', dueDate: '2026-11-10', startDate: null });
    expect(run([late, done], '2026-11-01', '2026-12-31', '2026-11-21', new Set(['done|once']))).toEqual([]);
  });

  it('ordena pelo dia e depois pelo nome', () => {
    const due = run(
      [pay({ id: 'b', name: 'Bruno', payDay: 10 }), pay({ id: 'a', name: 'Ana', payDay: 10 }), pay({ id: 'c', name: 'Carla', payDay: 5 })],
      '2026-11-01',
      '2026-11-30',
    );
    expect(due.map((entry) => entry.memberName)).toEqual(['Carla', 'Ana', 'Bruno']);
  });
});
