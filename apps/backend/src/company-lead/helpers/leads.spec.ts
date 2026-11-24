import { assertLeadRule, compileRules, pickRule, type RuleLike } from './leadRules';
import { summarizeLeads } from './summarizeLeads';
import { assertBoardSettings } from './assertBoardSettings';
import { buildBoard } from './buildBoard';
import { UNTOUCHED_POSITION } from './leadTypes';

const stages = [
  { id: 'entry', name: 'Por ligar', position: 0, isEntry: true },
  { id: 'first', name: '1.ª chamada', position: 1, isEntry: false },
  { id: 'no', name: 'Não atendeu', position: 2, isEntry: false },
];
const at = new Date('2026-11-23T10:00:00Z');
const lead = (rowKey: string, stageId: string, position: number, extra: { archivedAt?: Date; comments?: number } = {}) => ({
  id: `lead-${rowKey}`,
  rowKey,
  stageId,
  position,
  archivedAt: extra.archivedAt ?? null,
  updatedAt: at,
  comments: extra.comments ?? 0,
});
const row = (ref: string, status = 'In the office') => ({ ref, values: { ref, status, phone: '+351912345678', city: 'Porto' } });

describe('buildBoard', () => {
  it('as linhas novas entram na coluna de entrada pela ordem da origem, depois das mexidas', () => {
    const board = buildBoard({
      stages,
      leads: [lead('#3', 'entry', 1.5, { comments: 2 })],
      rows: [row('#1'), row('#2'), row('#3')],
      extra: [],
      truncated: false,
      keep: ['ref', 'phone'],
    });
    expect(board.cards.map((c) => [c.rowKey, c.stageId, c.position])).toEqual([
      ['#3', 'entry', 1.5],
      ['#1', 'entry', UNTOUCHED_POSITION],
      ['#2', 'entry', UNTOUCHED_POSITION + 1],
    ]);
    expect(board.cards[0]).toMatchObject({ leadId: 'lead-#3', comments: 2, values: { ref: '#3', phone: '+351912345678' } });
    expect(board.cards[1].values).toEqual({ ref: '#1', phone: '+351912345678' });
    expect(board.stages.map((s) => s.count)).toEqual([3, 0, 0]);
  });

  it('uma lead que deixa de passar o filtro sai do quadro (conta em left); com showLeft vem marcada', () => {
    const base = {
      stages,
      leads: [
        lead('#1', 'first', 1),
        lead('#2', 'no', 1),
        lead('#4', 'entry', 1),
        lead('#5', 'first', 2, { archivedAt: at }),
        lead('#6', 'no', 2),
      ],
      rows: [row('#1')],
      extra: [row('#2', 'Delivered'), row('#4', 'Delivered')],
      truncated: false,
      keep: ['status'],
    };
    const board = buildBoard(base);
    expect(board.cards.map((c) => c.rowKey)).toEqual(['#1']);
    expect(board).toMatchObject({ left: 3, archived: 1 });
    expect(board.stages.map((s) => s.count)).toEqual([0, 1, 0]);

    const all = buildBoard({ ...base, showLeft: true });
    expect(all.cards.map((c) => [c.rowKey, c.stageId, c.outOfFilter, c.missing])).toEqual([
      ['#1', 'first', false, false],
      ['#2', 'no', true, false],
      ['#4', 'entry', true, false],
      ['#6', 'no', true, true],
    ]);
    expect(all.cards[1].values).toEqual({ status: 'Delivered' });
    expect(all.stages.map((s) => s.count)).toEqual([0, 1, 0]);
  });

  it('com a lista cortada, uma lead de fora não se marca (pode passar)', () => {
    const board = buildBoard({ stages, leads: [lead('#9', 'first', 1)], rows: [row('#1')], extra: [row('#9')], truncated: true, keep: [] });
    expect(board.cards.find((c) => c.rowKey === '#9')).toMatchObject({ outOfFilter: false, missing: false });
  });
});

describe('assertBoardSettings', () => {
  const columns = [
    { key: 'status', label: 'Estado', type: 'text' as const, personal: false },
    { key: 'tel', label: 'Telefone', type: 'phone' as const, personal: true },
  ];

  it('valida os filtros e as colunas contra a origem', () => {
    const settings = assertBoardSettings(
      {
        filters: [{ column: 'status', op: 'in', values: ['In the office'] }, { column: 'tel', op: 'notEmpty' }],
        phoneColumn: 'tel',
        titleColumn: 'status',
        cardColumns: ['status', 'status'],
        search: '  ',
      },
      columns,
      'table',
    );
    expect(settings).toMatchObject({ phoneColumn: 'tel', titleColumn: 'status', cardColumns: ['status'], search: null, only: null });
    expect(() => assertBoardSettings({ phoneColumn: 'nope' }, columns, 'table')).toThrow();
    expect(() => assertBoardSettings({ filters: [{ column: 'nope', op: 'empty' }] }, columns, 'table')).toThrow();
    expect(() => assertBoardSettings({ only: 'matched' }, columns, 'table')).toThrow();
    expect(assertBoardSettings({ only: 'matched' }, columns, 'view').only).toBe('matched');
    expect(() => assertBoardSettings({ cardColumns: ['status', 'tel', 'a', 'b', 'c', 'd', 'e'] }, columns, 'table')).toThrow();
  });
});

describe('automações', () => {
  const columns = [
    { key: 'status', label: 'Estado', type: 'text' as const, personal: false },
    { key: 'tel', label: 'Telefone', type: 'phone' as const, personal: true },
  ];
  const rule = (id: string, extra: Partial<RuleLike> = {}): RuleLike => ({
    id,
    name: id,
    conditions: [{ column: 'status', op: 'in', values: ['Delivered'] }],
    fromStageIds: [],
    action: 'move',
    stageId: 'done',
    enabled: true,
    ...extra,
  });
  const leadAt = (stageId: string, applied: string[] = []) => ({ stageId, appliedRuleIds: applied, archivedAt: null });

  it('a primeira que bate, uma vez por lead, só nas colunas dela', () => {
    const rules = compileRules(
      [
        rule('off', { enabled: false }),
        rule('noStage', { stageId: null }),
        rule('broken', { conditions: [{ column: 'gone', op: 'empty' }] }),
        rule('fromNo', { fromStageIds: ['no'] }),
        rule('any'),
      ],
      columns,
    );
    expect(rules.map((r) => r.id)).toEqual(['fromNo', 'any']);
    expect(pickRule(leadAt('no'), { status: 'delivered ' }, rules)?.id).toBe('fromNo');
    expect(pickRule(leadAt('first'), { status: 'Delivered' }, rules)?.id).toBe('any');
    expect(pickRule(leadAt('first', ['any']), { status: 'Delivered' }, rules)).toBeNull();
    expect(pickRule(leadAt('done'), { status: 'Delivered' }, rules)).toBeNull();
    expect(pickRule(leadAt('first'), { status: 'In the office' }, rules)).toBeNull();
    expect(pickRule({ ...leadAt('first'), archivedAt: new Date() }, { status: 'Delivered' }, rules)).toBeNull();
  });

  it('valida o nome, as condições, as colunas e a ação', () => {
    const stages = new Set(['entry', 'done']);
    const ok = { name: ' Entregue ', conditions: [{ column: 'status', op: 'in', values: ['Delivered'] }], action: 'move', stageId: 'done' };
    expect(assertLeadRule(ok, columns, stages)).toMatchObject({ name: 'Entregue', stageId: 'done', fromStageIds: [] });
    expect(assertLeadRule({ ...ok, action: 'archive' }, columns, stages).stageId).toBeNull();
    expect(() => assertLeadRule({ ...ok, name: ' ' }, columns, stages)).toThrow();
    expect(() => assertLeadRule({ ...ok, conditions: [] }, columns, stages)).toThrow();
    expect(() => assertLeadRule({ ...ok, stageId: 'other' }, columns, stages)).toThrow();
    expect(() => assertLeadRule({ ...ok, fromStageIds: ['other'] }, columns, stages)).toThrow();
    expect(() => assertLeadRule({ ...ok, action: 'call' }, columns, stages)).toThrow();
  });

  it('uma lead que a automação pôs numa coluna fica à vista fora do filtro', () => {
    const board = buildBoard({
      stages: [...stages, { id: 'done', name: 'Já entregue', position: 3, isEntry: false }],
      leads: [{ ...lead('#7', 'done', 1), movedByRuleId: 'r1' }, lead('#8', 'no', 1)],
      rows: [],
      extra: [row('#7', 'Delivered'), row('#8', 'Delivered')],
      truncated: false,
      keep: ['status'],
      ruleNames: new Map([['r1', 'Entregue']]),
    });
    expect(board.cards.map((c) => [c.rowKey, c.byRule, c.outOfFilter])).toEqual([['#7', 'Entregue', true]]);
    expect(board.left).toBe(1);
    expect(board.stages.find((s) => s.id === 'done')?.count).toBe(1);
  });
});

describe('condições sobre a lead e atribuir', () => {
  const now = new Date('2026-11-23T12:00:00Z');
  const rule = (extra: Partial<RuleLike>): RuleLike => ({
    id: 'r',
    name: 'R',
    conditions: [],
    fromStageIds: [],
    action: 'archive',
    stageId: null,
    enabled: true,
    ...extra,
  });
  const base = { stageId: 'no', appliedRuleIds: [], archivedAt: null };

  it('as tentativas, os dias na coluna e o voltar a ligar', () => {
    const [compiled] = compileRules(
      [rule({ leadConditions: [{ field: 'attempts', op: 'gte', value: 3 }, { field: 'daysInStage', op: 'gte', value: 2 }] })],
      [],
    );
    expect(pickRule({ ...base, attempts: 3, stageEnteredAt: new Date('2026-11-21T11:00:00Z') }, {}, [compiled], now)).toBe(compiled);
    expect(pickRule({ ...base, attempts: 2, stageEnteredAt: new Date('2026-11-20T11:00:00Z') }, {}, [compiled], now)).toBeNull();
    expect(pickRule({ ...base, attempts: 5, stageEnteredAt: new Date('2026-11-22T11:00:00Z') }, {}, [compiled], now)).toBeNull();

    const [due] = compileRules([rule({ leadConditions: [{ field: 'callbackDue', op: 'yes' }] })], []);
    expect(pickRule({ ...base, callbackAt: new Date('2026-11-23T11:59:00Z') }, {}, [due], now)).toBe(due);
    expect(pickRule({ ...base, callbackAt: new Date('2026-11-23T12:30:00Z') }, {}, [due], now)).toBeNull();
  });

  it('atribuir não tira a lead a quem já a tem e precisa de operadores', () => {
    expect(compileRules([rule({ action: 'assign', leadConditions: [{ field: 'assigned', op: 'empty' }] })], [])).toEqual([]);
    const [assign] = compileRules([rule({ action: 'assign', assigneeIds: ['u1'], leadConditions: [{ field: 'attempts', op: 'gte', value: 0 }] })], []);
    expect(pickRule({ ...base, assignedToId: null }, {}, [assign], now)).toBe(assign);
    expect(pickRule({ ...base, assignedToId: 'u2' }, {}, [assign], now)).toBeNull();
  });

  it('valida a automação: uma condição de qualquer dos lados chega, e os operadores têm de trabalhar nas leads', () => {
    const stageIds = new Set(['no']);
    expect(assertLeadRule({ name: 'X', action: 'archive', leadConditions: [{ field: 'attempts', op: 'gte', value: 3 }] }, [], stageIds).leadConditions).toEqual([
      { field: 'attempts', op: 'gte', value: 3 },
    ]);
    expect(() => assertLeadRule({ name: 'X', action: 'archive' }, [], stageIds)).toThrow('pelo menos uma condição');
    expect(() => assertLeadRule({ name: 'X', action: 'archive', leadConditions: [{ field: 'attempts', op: 'gte', value: -1 }] }, [], stageIds)).toThrow();
    const assign = { name: 'X', action: 'assign', leadConditions: [{ field: 'assigned', op: 'empty' }] };
    expect(() => assertLeadRule({ ...assign, assigneeIds: ['u9'] }, [], stageIds, new Set(['u1']))).toThrow('não trabalha');
    expect(assertLeadRule({ ...assign, assigneeIds: ['u1', 'u1'] }, [], stageIds, new Set(['u1'])).assigneeIds).toEqual(['u1']);
  });
});

describe('summarizeLeads', () => {
  it('conta as chamadas por dia e por operador, e o tempo em cada coluna', () => {
    const from = new Date('2026-11-20T00:00:00Z');
    const to = new Date('2026-11-23T00:00:00Z');
    const call = (userId: string, answered: boolean, createdAt: string, leadId = 'l1') => ({
      boardId: 'b',
      leadId,
      userId,
      outcomeName: answered ? 'Atendeu' : 'Não atendeu',
      answered,
      createdAt: new Date(createdAt),
    });
    const summary = summarizeLeads({
      calls: [call('u1', true, '2026-11-20T10:00:00Z'), call('u1', false, '2026-11-20T11:00:00Z', 'l2'), call('u2', false, '2026-11-22T09:00:00Z')],
      moves: [
        { leadId: 'l1', fromStageId: 'entry', toStageId: 'first', createdAt: new Date('2026-11-21T00:00:00Z') },
        { leadId: 'l1', fromStageId: 'first', toStageId: 'no', createdAt: new Date('2026-11-22T12:00:00Z') },
      ],
      leads: [
        { id: 'l1', boardId: 'b', stageId: 'no', archivedAt: null, assignedToId: 'u1', callbackAt: new Date('2026-11-22T00:00:00Z'), stageEnteredAt: new Date('2026-11-22T12:00:00Z'), createdAt: new Date('2026-11-19T00:00:00Z') },
        { id: 'l2', boardId: 'b', stageId: 'entry', archivedAt: null, assignedToId: null, callbackAt: null, stageEnteredAt: new Date('2026-11-19T00:00:00Z'), createdAt: new Date('2026-11-19T00:00:00Z') },
      ],
      stages: stages.map((s) => ({ ...s, boardId: 'b' })),
      names: new Map([['u1', 'Ana']]),
      from,
      to,
      now: to,
      timeZone: 'UTC',
    });
    expect(summary.cards).toMatchObject({ calls: 3, answered: 1, leadsCalled: 2, open: 2, unassigned: 1, callbacksOverdue: 1 });
    expect(summary.byDay).toEqual([
      { day: '2026-11-20', calls: 2, answered: 1 },
      { day: '2026-11-21', calls: 0, answered: 0 },
      { day: '2026-11-22', calls: 1, answered: 0 },
    ]);
    expect(summary.byUser[0]).toMatchObject({ userId: 'u1', name: 'Ana', calls: 2, answered: 1, leads: 2 });
    const entry = summary.stages.find((s) => s.id === 'entry')!;
    const first = summary.stages.find((s) => s.id === 'first')!;
    expect(entry.avgDaysToLeave).toBe(2);
    expect(first.avgDaysToLeave).toBe(1.5);
    expect(first.entered).toBe(1);
    expect(entry.avgDaysNow).toBe(4);
  });
});
