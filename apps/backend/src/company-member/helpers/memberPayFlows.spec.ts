import { saveMemberPay } from './saveMemberPay';
import { respondPayProposal } from 'src/company-invitation/helpers/respondPayProposal';
import { confirmMemberPayment } from 'src/company-invitation/helpers/confirmMemberPayment';
import { findMyInvitations } from 'src/company-invitation/helpers/findMyInvitations';

jest.mock('./assertMemberAccess', () => ({
  assertMemberAccess: jest.fn(() =>
    Promise.resolve({ company: { id: 'c1', createdById: 'owner' }, member: { id: 'm1', userId: 'worker' } }),
  ),
}));

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const accepted = {
  id: 'pay1',
  memberId: 'm1',
  kind: 'salary',
  status: 'accepted',
  contractId: null,
  description: 'Base',
  grossAmount: 1000,
  withholdingPct: null,
  payDay: 25,
  paymentsPerYear: 14,
  startDate: d('2026-01-01'),
  endDate: null,
  dueDate: null,
  _count: { payments: 3 },
};

const memberRepo = (extra: Record<string, unknown> = {}) => ({
  findPay: jest.fn(() => Promise.resolve(accepted)),
  findLastPaidPeriod: jest.fn(() => Promise.resolve('2026-10')),
  findPendingReplacement: jest.fn(() => Promise.resolve(null)),
  createPay: jest.fn((_member: string, _kind: string, data: Record<string, unknown>) => Promise.resolve({ id: 'pay2', ...data })),
  updatePay: jest.fn((id: string, data: Record<string, unknown>) => Promise.resolve({ id, ...data })),
  countPayIncomes: jest.fn(() => Promise.resolve(0)),
  findContract: jest.fn(),
  ...extra,
});

const save = (repo: ReturnType<typeof memberRepo>, dto: Record<string, unknown>) =>
  saveMemberPay('owner', 'c1', 'm1', 'pay1', dto as never, {} as never, repo as never);

describe('mudar um salário já aceite', () => {
  it('não mexe no aceite: cria uma proposta que o substitui, a começar depois do último mês pago', async () => {
    const repo = memberRepo();
    const result = (await save(repo, { grossAmount: 1200, startDate: '2026-06-01' })) as Record<string, unknown>;
    expect(repo.updatePay).not.toHaveBeenCalled();
    expect(repo.createPay).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      status: 'proposed',
      replacesId: 'pay1',
      grossAmount: 1200,
      payDay: 25,
      paymentsPerYear: 14,
      description: 'Base',
      proposedById: 'owner',
    });
    expect((result.startDate as Date).toISOString().slice(0, 10)).toBe('2026-11-01');
  });

  it('pôr só a data de fim também vai como proposta, e uma mudança por responder atualiza-se em vez de duplicar', async () => {
    const repo = memberRepo({ findPendingReplacement: jest.fn(() => Promise.resolve({ id: 'pending' })) });
    const result = (await save(repo, { endDate: '2026-12-31' })) as Record<string, unknown>;
    expect(repo.createPay).not.toHaveBeenCalled();
    expect(repo.updatePay).toHaveBeenCalledWith('pending', expect.objectContaining({ replacesId: 'pay1', respondedAt: null }));
    expect((result.endDate as Date).toISOString().slice(0, 10)).toBe('2026-12-31');
  });

  it('não deixa acabar antes do que já está pago', async () => {
    await expect(save(memberRepo(), { endDate: '2026-09-30' })).rejects.toThrow('já está pago até 2026-10');
  });

  it('a descrição sozinha muda no próprio salário (não pede acordo)', async () => {
    const repo = memberRepo();
    await save(repo, { description: 'Novo nome' });
    expect(repo.createPay).not.toHaveBeenCalled();
    expect(repo.updatePay).toHaveBeenCalledWith('pay1', expect.not.objectContaining({ status: 'proposed' }));
  });

  it('um recibo verde já pago não muda de termos', async () => {
    const repo = memberRepo({ findPay: jest.fn(() => Promise.resolve({ ...accepted, kind: 'freelance', dueDate: d('2026-05-01'), _count: { payments: 1 } })) });
    await expect(save(repo, { grossAmount: 50 })).rejects.toThrow('já foi pago');
  });
});

describe('aceitar a mudança', () => {
  const notifications = { closeActions: jest.fn(() => Promise.resolve(1)), send: jest.fn(() => Promise.resolve(1)) };
  const proposal = (startDate: string) => ({
    id: 'pay2',
    kind: 'salary',
    status: 'proposed',
    grossAmount: 1200,
    proposedById: 'owner',
    startDate: d(startDate),
    replaces: { id: 'pay1', grossAmount: 1000, startDate: d('2026-01-01'), endDate: null },
    member: { id: 'm1', userId: 'worker', currency: null, user: { fullName: 'W' }, company: { id: 'c1', name: 'C', slug: 'c', createdById: 'owner', currency: { shortCode: 'EUR' } } },
  });
  const repo = (pay: unknown) => ({
    findPay: jest.fn(() => Promise.resolve(pay)),
    answerPay: jest.fn(() => Promise.resolve(true)),
    findManagerUserIds: jest.fn(() => Promise.resolve([])),
  });

  it('o antigo fecha na véspera do início da nova', async () => {
    const r = repo(proposal('2026-11-01'));
    await respondPayProposal('worker', 'pay2', true, undefined, r as never, notifications as never);
    expect(r.answerPay).toHaveBeenCalledWith('pay2', expect.objectContaining({ status: 'accepted' }), { id: 'pay1', endDate: d('2026-10-31') });
  });

  it('a que começa quando o antigo começava (nada pago) cancela-o todo', async () => {
    const r = repo(proposal('2026-01-01'));
    await respondPayProposal('worker', 'pay2', true, undefined, r as never, notifications as never);
    expect(r.answerPay).toHaveBeenCalledWith('pay2', expect.anything(), { id: 'pay1', cancel: true });
  });

  it('recusada, o antigo fica como estava', async () => {
    const r = repo(proposal('2026-11-01'));
    await respondPayProposal('worker', 'pay2', false, 'Não', r as never, notifications as never);
    expect(r.answerPay).toHaveBeenCalledWith('pay2', expect.objectContaining({ status: 'declined' }), null);
  });
});

describe('confirmar um pagamento que já está nos ganhos', () => {
  const payment = { id: 'p1', status: 'completed', amount: 900, memberPayId: 'pay1', memberPayPeriod: '2026-10', member: { userId: 'worker' }, company: { id: 'c1', name: 'C', slug: 'c' }, currency: { shortCode: 'EUR' } };
  const repo = { findMemberPayment: jest.fn(() => Promise.resolve(payment)), findIncomeOfPayment: jest.fn(() => Promise.resolve({ id: 'inc1' })) };

  it('«Recebi» fecha o aviso sem erro e não cria outro ganho', async () => {
    const notifications = { closeActions: jest.fn(() => Promise.resolve(1)), send: jest.fn() };
    const result = await confirmMemberPayment('worker', 'company_payment', 'p1', true, repo as never, notifications as never, {} as never);
    expect(result).toEqual({ id: 'p1', received: true, incomeId: 'inc1' });
    expect(notifications.closeActions).toHaveBeenCalledWith('member_paid', 'paymentId', 'p1', 'done');
    expect(notifications.send).not.toHaveBeenCalled();
  });

  it('«Não recebi» recusa-se (o ganho existe)', async () => {
    const notifications = { closeActions: jest.fn(), send: jest.fn() };
    await expect(confirmMemberPayment('worker', 'company_payment', 'p1', false, repo as never, notifications as never, {} as never)).rejects.toThrow('já está nos teus ganhos');
    expect(notifications.closeActions).not.toHaveBeenCalled();
  });
});

describe('os pagamentos em Convites', () => {
  it('um «Não recebi» já não está por responder (nos pagamentos e nas horas)', async () => {
    const company = { id: 'c1', name: 'C', slug: 'c' };
    const repo = {
      findInvites: jest.fn(() => Promise.resolve([])),
      findProposals: jest.fn(() => Promise.resolve([])),
      findPaymentsToUser: jest.fn(() =>
        Promise.resolve([
          { payment: { id: 'p1', amount: 900, paymentDate: d('2026-11-01'), memberPayPeriod: '2026-10', company, currency: { shortCode: 'EUR' }, memberPay: null }, income: null },
          { payment: { id: 'p2', amount: 900, paymentDate: d('2026-11-02'), memberPayPeriod: '2026-11', company, currency: { shortCode: 'EUR' }, memberPay: null }, income: null },
        ]),
      ),
      findPayoutsToUser: jest.fn(() =>
        Promise.resolve([{ id: 'o1', company, currency: { shortCode: 'EUR' }, seconds: 3600, paidAt: d('2026-11-03'), netAmount: 10, personalIncome: null, confirmation: 'declined' }]),
      ),
      findDeclinedPaymentIds: jest.fn(() => Promise.resolve(new Set(['p1']))),
    };
    const result = await findMyInvitations('worker', repo as never);
    const byId = Object.fromEntries(result.payments.map((p) => [p.id, p.check]));
    expect(byId).toEqual({ p1: 'declined', p2: 'awaiting', o1: 'declined' });
  });
});
