import { buildConverter, ConvertibleCurrency } from './buildConverter';

// Cotações de referência: unidades por 1 USD (o Currency.rate)
const USD: ConvertibleCurrency = { id: 'usd', shortCode: 'USD', rate: 1 };
const EUR: ConvertibleCurrency = { id: 'eur', shortCode: 'EUR', rate: 0.9 };
const GBP: ConvertibleCurrency = { id: 'gbp', shortCode: 'GBP', rate: 0.8 };

const hour = (iso: string) => new Date(iso);

type HourRow = { hour: Date; currencyId: string; rate: number };
type DayRow = { date: Date; baseCurrencyId: string; rate: number };

// Os repositórios a fingir: as linhas que a base teria
const repositories = (hourRows: HourRow[], dayRows: DayRow[], latest: Date | null) => {
  const hourRateRepository = {
    latestHour: jest.fn().mockResolvedValue(latest),
    findMany: jest.fn(async (hours: Date[], ids: string[]) =>
      hourRows.filter(
        (row) => hours.some((h) => h.getTime() === row.hour.getTime()) && ids.includes(row.currencyId),
      ),
    ),
    findBetween: jest.fn(async (from: Date, until: Date, ids: string[]) =>
      hourRows.filter((row) => row.hour >= from && row.hour < until && ids.includes(row.currencyId)),
    ),
  };
  const rateRepository = {
    findMany: jest.fn(async (days: Date[], ids: string[], _target: string) =>
      dayRows.filter(
        (row) => days.some((d) => d.getTime() === row.date.getTime()) && ids.includes(row.baseCurrencyId),
      ),
    ),
  };
  return { hourRateRepository, rateRepository };
};

describe('buildConverter', () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    jest.setSystemTime(new Date('2026-11-21T12:00:00Z'));
  });
  afterEach(() => jest.useRealTimers());

  it('sem moeda de destino ou na mesma moeda, o valor fica', async () => {
    const { hourRateRepository, rateRepository } = repositories([], [], null);
    const none = await buildConverter(null, [{ currency: EUR }], rateRepository as never, hourRateRepository as never, jest.fn());
    expect(none.convert(100, EUR)).toBe(100);
    const same = await buildConverter(EUR, [{ currency: EUR }], rateRepository as never, hourRateRepository as never, jest.fn());
    expect(same.convert(100, EUR, '2026-01-01')).toBe(100);
  });

  it('com a hora do registo, pelas cotações dessa hora (moeda → USD → destino)', async () => {
    const h = hour('2026-11-10T14:00:00Z');
    const { hourRateRepository, rateRepository } = repositories(
      [
        { hour: h, currencyId: 'eur', rate: 0.9 },
        { hour: h, currencyId: 'gbp', rate: 0.75 },
      ],
      [],
      null,
    );
    const enqueue = jest.fn();
    const converter = await buildConverter(
      GBP,
      [{ currency: EUR, day: '2026-11-10', hour: h }],
      rateRepository as never,
      hourRateRepository as never,
      enqueue,
    );
    expect(converter.convert(90, EUR, '2026-11-10', h)).toBeCloseTo(75, 10);
    expect(converter.estimated()).toBe(0);
    // a hora resolve: não se pede nada à API
    expect(enqueue).not.toHaveBeenCalled();
    expect(rateRepository.findMany).not.toHaveBeenCalled();
  });

  it('hoje e à frente vai pela hora mais recente', async () => {
    const latest = hour('2026-11-21T11:00:00Z');
    const { hourRateRepository, rateRepository } = repositories(
      [
        { hour: latest, currencyId: 'eur', rate: 0.8 },
        { hour: latest, currencyId: 'usd', rate: 1 },
      ],
      [],
      latest,
    );
    const converter = await buildConverter(
      USD,
      [{ currency: EUR, day: '2026-11-21' }, { currency: EUR, day: '2027-03-01' }, { currency: EUR }],
      rateRepository as never,
      hourRateRepository as never,
      jest.fn(),
    );
    expect(converter.convert(80, EUR, '2026-11-21')).toBeCloseTo(100, 10);
    expect(converter.convert(80, EUR, '2027-03-01')).toBeCloseTo(100, 10);
    expect(converter.convert(80, EUR)).toBeCloseTo(100, 10);
  });

  it('num dia passado sem hora própria, pela última hora guardada desse dia', async () => {
    const { hourRateRepository, rateRepository } = repositories(
      [
        { hour: hour('2026-11-05T00:00:00Z'), currencyId: 'eur', rate: 0.5 },
        { hour: hour('2026-11-05T00:00:00Z'), currencyId: 'usd', rate: 1 },
        { hour: hour('2026-11-05T23:00:00Z'), currencyId: 'eur', rate: 0.8 },
        { hour: hour('2026-11-05T23:00:00Z'), currencyId: 'usd', rate: 1 },
        // de outro dia: não conta
        { hour: hour('2026-11-06T01:00:00Z'), currencyId: 'eur', rate: 0.1 },
      ],
      [],
      null,
    );
    const converter = await buildConverter(USD, [{ currency: EUR, day: '2026-11-05' }], rateRepository as never, hourRateRepository as never, jest.fn());
    expect(converter.convert(8, EUR, '2026-11-05')).toBeCloseTo(10, 10);
  });

  it('sem horas, pela CurrencyRate do dia', async () => {
    const { hourRateRepository, rateRepository } = repositories(
      [],
      [{ date: new Date('2026-10-01T00:00:00.000Z'), baseCurrencyId: 'eur', rate: 1.1 }],
      null,
    );
    const enqueue = jest.fn();
    const converter = await buildConverter(USD, [{ currency: EUR, day: '2026-10-01' }], rateRepository as never, hourRateRepository as never, enqueue);
    expect(converter.convert(100, EUR, '2026-10-01')).toBeCloseTo(110, 10);
    expect(converter.estimated()).toBe(0);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('sem cotação do dia, pelo Currency.rate; conta-o e põe o dia na fila', async () => {
    const { hourRateRepository, rateRepository } = repositories([], [], null);
    const enqueue = jest.fn();
    const converter = await buildConverter(
      GBP,
      [{ currency: EUR, day: '2026-09-01' }, { currency: EUR, day: '2026-09-02' }],
      rateRepository as never,
      hourRateRepository as never,
      enqueue,
    );
    // 90 EUR = 100 USD = 80 GBP
    expect(converter.convert(90, EUR, '2026-09-01')).toBeCloseTo(80, 10);
    expect(converter.convert(90, EUR, '2026-09-02')).toBeCloseTo(80, 10);
    expect(converter.convert(90, EUR, '2026-09-02')).toBeCloseTo(80, 10);
    expect(converter.estimated()).toBe(2);
    expect(enqueue).toHaveBeenCalledTimes(1);
    // os mais recentes primeiro
    expect(enqueue.mock.calls[0][0]).toEqual([
      { day: '2026-09-02', target: { id: 'gbp', shortCode: 'GBP' }, currencies: [{ id: 'eur', shortCode: 'EUR' }] },
      { day: '2026-09-01', target: { id: 'gbp', shortCode: 'GBP' }, currencies: [{ id: 'eur', shortCode: 'EUR' }] },
    ]);
  });

  it('põe na fila no máximo 60 dias por leitura', async () => {
    const { hourRateRepository, rateRepository } = repositories([], [], null);
    const enqueue = jest.fn();
    const needs = Array.from({ length: 90 }, (_, index) => {
      const day = new Date(Date.UTC(2026, 0, 1 + index)).toISOString().slice(0, 10);
      return { currency: EUR, day };
    });
    await buildConverter(USD, needs, rateRepository as never, hourRateRepository as never, enqueue);
    const queued = enqueue.mock.calls[0][0] as { day: string }[];
    expect(queued).toHaveLength(60);
    expect(queued[0].day).toBe('2026-03-31');
  });
});
