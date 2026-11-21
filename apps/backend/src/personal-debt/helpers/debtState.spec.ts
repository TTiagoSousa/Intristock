import { debtState } from './debtState';
import { syncDebtStatus } from './syncDebtStatus';

type Movement = {
  kind: string;
  date: string;
  amount: number;
  principalPart?: number | null;
  interestPart?: number | null;
  feesPart?: number | null;
};

// Uma dívida só com o que o debtState lê (os valores da base chegam como Decimal/string)
const debt = (
  openingBalance: number,
  openingDate: string,
  movements: Movement[],
  status = 'active',
) =>
  ({
    id: 'debt-1',
    status,
    openingBalance: String(openingBalance),
    openingDate: new Date(`${openingDate}T00:00:00.000Z`),
    movements: movements.map((movement, index) => ({
      id: `m${index}`,
      kind: movement.kind,
      date: new Date(`${movement.date}T00:00:00.000Z`),
      amount: String(movement.amount),
      principalPart: movement.principalPart === undefined || movement.principalPart === null ? null : String(movement.principalPart),
      interestPart: movement.interestPart == null ? null : String(movement.interestPart),
      feesPart: movement.feesPart == null ? null : String(movement.feesPart),
    })),
  }) as never;

describe('debtState', () => {
  it('o saldo é a abertura menos o capital pago mais os aumentos', () => {
    const state = debtState(
      debt(10000, '2026-01-01', [
        { kind: 'installment', date: '2026-02-05', amount: 500, principalPart: 450, interestPart: 40, feesPart: 10 },
        { kind: 'extra', date: '2026-03-01', amount: 1000 },
        { kind: 'charge', date: '2026-03-10', amount: 200 },
      ]),
    );
    expect(state).toEqual({
      balance: 8750,
      paid: 1500,
      paidPrincipal: 1450,
      interestPaid: 40,
      feesPaid: 10,
      charged: 200,
      lastPayment: '2026-03-01',
    });
  });

  it('sem o capital à parte, o valor todo é capital', () => {
    const state = debtState(debt(300, '2026-01-01', [{ kind: 'extra', date: '2026-01-15', amount: 120 }]));
    expect(state.balance).toBe(180);
    expect(state.paidPrincipal).toBe(120);
  });

  it('ignora os movimentos antes da abertura (já estão no valor de abertura)', () => {
    const state = debtState(
      debt(1000, '2026-06-01', [
        { kind: 'installment', date: '2026-05-01', amount: 100, principalPart: 100 },
        { kind: 'installment', date: '2026-06-01', amount: 100, principalPart: 100 },
      ]),
    );
    expect(state.balance).toBe(900);
    expect(state.lastPayment).toBe('2026-06-01');
  });

  it('com `until` só conta até esse dia', () => {
    const state = debtState(
      debt(1000, '2026-01-01', [
        { kind: 'installment', date: '2026-02-01', amount: 100, principalPart: 100 },
        { kind: 'installment', date: '2026-03-01', amount: 100, principalPart: 100 },
      ]),
      '2026-02-15',
    );
    expect(state.balance).toBe(900);
    expect(state.lastPayment).toBe('2026-02-01');
  });

  it('arredonda aos cêntimos: uma dívida paga em decimais chega a 0', () => {
    // 0.1 + 0.2 em vírgula flutuante não é 0.3
    const state = debtState(
      debt(0.3, '2026-01-01', [
        { kind: 'extra', date: '2026-01-02', amount: 0.1 },
        { kind: 'extra', date: '2026-01-03', amount: 0.2 },
      ]),
    );
    expect(state.balance).toBe(0);
    expect(state.paid).toBe(0.3);
  });

  it('o saldo nunca fica negativo', () => {
    const state = debtState(debt(100, '2026-01-01', [{ kind: 'extra', date: '2026-01-02', amount: 150 }]));
    expect(state.balance).toBe(0);
    expect(state.paidPrincipal).toBe(150);
  });
});

describe('syncDebtStatus', () => {
  const repositoryFor = (found: unknown) => ({
    findDebt: jest.fn().mockResolvedValue(found),
    updateDebt: jest.fn().mockResolvedValue(undefined),
  });

  it('uma ativa sem nada por pagar passa a paga (paid_off)', async () => {
    const repository = repositoryFor(debt(100, '2026-01-01', [{ kind: 'extra', date: '2026-01-02', amount: 100 }]));
    await syncDebtStatus('user', 'debt-1', repository as never);
    expect(repository.updateDebt).toHaveBeenCalledWith('debt-1', { status: 'paid_off' });
  });

  it('uma paga volta a ativa se o saldo voltar', async () => {
    const repository = repositoryFor(
      debt(100, '2026-01-01', [
        { kind: 'extra', date: '2026-01-02', amount: 100 },
        { kind: 'charge', date: '2026-01-03', amount: 50 },
      ], 'paid_off'),
    );
    await syncDebtStatus('user', 'debt-1', repository as never);
    expect(repository.updateDebt).toHaveBeenCalledWith('debt-1', { status: 'active' });
  });

  it('uma fechada à mão fica fechada', async () => {
    const repository = repositoryFor(debt(100, '2026-01-01', [], 'closed'));
    await syncDebtStatus('user', 'debt-1', repository as never);
    expect(repository.updateDebt).not.toHaveBeenCalled();
  });

  it('uma ativa com saldo não muda', async () => {
    const repository = repositoryFor(debt(100, '2026-01-01', [{ kind: 'extra', date: '2026-01-02', amount: 10 }]));
    await syncDebtStatus('user', 'debt-1', repository as never);
    expect(repository.updateDebt).not.toHaveBeenCalled();
  });
});
