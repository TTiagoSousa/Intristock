import { allocateSeconds } from './allocateSeconds';
import { entryPayValue } from './entryPayValue';
import { entryBillable, entryRate, entryValue } from './entryValue';

type EntryInput = {
  id?: string;
  seconds?: number;
  billable?: boolean;
  paidSeconds?: number;
  payoutSeconds?: number;
  clientRate?: number | null;
  billing?: string;
  noClient?: boolean;
  projectRate?: number | null;
  projectBillable?: boolean;
  noProject?: boolean;
  personRate?: number | null;
  payRate?: number | null;
  payWithholdingPct?: number | null;
  noPerson?: boolean;
};

const entry = (input: EntryInput = {}) =>
  ({
    id: input.id ?? 'e1',
    connectionId: 'c1',
    start: new Date('2026-11-01T09:00:00Z'),
    end: new Date('2026-11-01T11:00:00Z'),
    seconds: input.seconds ?? 7200,
    description: null,
    billable: input.billable ?? true,
    clientId: 'cl1',
    personId: 'p1',
    client: input.noClient
      ? null
      : { id: 'cl1', name: 'Cliente', hourlyRate: input.clientRate ?? null, billing: input.billing ?? 'invoice', withholdingPct: null },
    project: input.noProject
      ? null
      : { id: 'pr1', name: 'Projeto', color: null, billableRate: input.projectRate ?? null, isBillable: input.projectBillable ?? true },
    person: input.noPerson
      ? null
      : {
          id: 'p1',
          name: 'Ana',
          billableRate: input.personRate ?? null,
          memberId: null,
          userId: null,
          payRate: input.payRate ?? null,
          payWithholdingPct: input.payWithholdingPct ?? null,
        },
    paidSeconds: input.paidSeconds ?? 0,
    payoutSeconds: input.payoutSeconds ?? 0,
  }) as never;

describe('entryRate', () => {
  it('o do cliente → o do projeto → o da pessoa', () => {
    expect(entryRate(entry({ clientRate: 50, projectRate: 40, personRate: 30 }))).toBe(50);
    expect(entryRate(entry({ projectRate: 40, personRate: 30 }))).toBe(40);
    expect(entryRate(entry({ personRate: 30 }))).toBe(30);
    expect(entryRate(entry())).toBeNull();
  });
});

describe('entryBillable', () => {
  it('faturável, num projeto faturável e de um cliente que se cobra', () => {
    expect(entryBillable(entry())).toBe(true);
    expect(entryBillable(entry({ noProject: true, noClient: true }))).toBe(true);
    expect(entryBillable(entry({ billable: false }))).toBe(false);
    expect(entryBillable(entry({ projectBillable: false }))).toBe(false);
    expect(entryBillable(entry({ billing: 'none' }))).toBe(false);
  });
});

describe('entryValue', () => {
  it('o valor, o pago e o por pagar pelas horas', () => {
    // 2 h a 45 €/h, 1 h 30 min paga
    expect(entryValue(entry({ clientRate: 45, paidSeconds: 5400 }))).toEqual({
      rate: 45,
      seconds: 7200,
      paidSeconds: 5400,
      unpaidSeconds: 1800,
      amount: 90,
      paidAmount: 67.5,
      unpaidAmount: 22.5,
    });
  });

  it('arredonda aos cêntimos', () => {
    // 1000 s a 33,33 €/h = 9,258333…
    expect(entryValue(entry({ seconds: 1000, clientRate: 33.33 })).amount).toBe(9.26);
  });

  it('os não faturáveis valem 0 mas as horas contam', () => {
    const value = entryValue(entry({ billable: false, clientRate: 45 }));
    expect(value.rate).toBe(0);
    expect(value.amount).toBe(0);
    expect(value.seconds).toBe(7200);
    expect(value.unpaidSeconds).toBe(7200);
  });

  it('o pago nunca passa das horas do registo', () => {
    const value = entryValue(entry({ clientRate: 10, paidSeconds: 99999 }));
    expect(value.paidSeconds).toBe(7200);
    expect(value.unpaidSeconds).toBe(0);
    expect(value.unpaidAmount).toBe(0);
  });
});

describe('entryPayValue', () => {
  it('o payRate da pessoa, com a retenção dela', () => {
    expect(entryPayValue(entry({ clientRate: 60, payRate: 20, payWithholdingPct: 25, payoutSeconds: 3600 }))).toEqual({
      rate: 20,
      paidSeconds: 3600,
      unpaidSeconds: 3600,
      unpaidAmount: 20,
      withholdingPct: 25,
      unpaidNet: 15,
    });
  });

  it('sem payRate, o valor das horas (o preço do cliente)', () => {
    const value = entryPayValue(entry({ clientRate: 60 }));
    expect(value.rate).toBe(60);
    expect(value.unpaidAmount).toBe(120);
    expect(value.withholdingPct).toBeNull();
    expect(value.unpaidNet).toBe(120);
  });

  it('sem payRate, um não faturável vale 0; com payRate paga-se na mesma', () => {
    expect(entryPayValue(entry({ billable: false, clientRate: 60 })).unpaidAmount).toBe(0);
    expect(entryPayValue(entry({ billable: false, clientRate: 60, payRate: 15 })).unpaidAmount).toBe(30);
  });

  it('o pago à pessoa é à parte do pago pelo cliente', () => {
    const value = entryPayValue(entry({ clientRate: 60, paidSeconds: 7200, payoutSeconds: 0 }));
    expect(value.unpaidSeconds).toBe(7200);
  });
});

describe('allocateSeconds', () => {
  it('paga os mais antigos primeiro; o último fica pago em parte; sobra o adiantado', () => {
    const entries = [
      entry({ id: 'a', seconds: 3600 }),
      entry({ id: 'b', seconds: 3600, paidSeconds: 1800 }),
      entry({ id: 'c', seconds: 3600 }),
    ];
    expect(allocateSeconds(entries, 6000)).toEqual({
      allocations: [
        { entryId: 'a', seconds: 3600 },
        { entryId: 'b', seconds: 1800 },
        { entryId: 'c', seconds: 600 },
      ],
      left: 0,
    });
  });

  it('o que passa das horas por pagar fica adiantado', () => {
    const result = allocateSeconds([entry({ id: 'a', seconds: 3600 })], 5000);
    expect(result.allocations).toEqual([{ entryId: 'a', seconds: 3600 }]);
    expect(result.left).toBe(1400);
  });

  it('salta os não faturáveis e os já pagos', () => {
    const result = allocateSeconds(
      [
        entry({ id: 'free', billable: false }),
        entry({ id: 'none', billing: 'none' }),
        entry({ id: 'paid', seconds: 3600, paidSeconds: 3600 }),
        entry({ id: 'open', seconds: 3600 }),
      ],
      1000,
    );
    expect(result).toEqual({ allocations: [{ entryId: 'open', seconds: 1000 }], left: 0 });
  });

  it('sem segundos não aloca nada', () => {
    expect(allocateSeconds([entry()], 0)).toEqual({ allocations: [], left: 0 });
  });
});
