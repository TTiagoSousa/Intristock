import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client/client';
import { countMonthsInRange } from 'src/market-data/helpers/countMonthsInRange';
import { PrismaSimulationRepository } from '../repositories/prisma/prisma-simulation-repository';
import {
  ConditionDto,
  CreateSimulationDto,
  EntryRuleDto,
  OperandDto,
  ScheduleDto,
  isGroup,
} from '../dto/create-simulation.dto';
import { hasStop } from './assertStrategy';
import { assertStrategy } from './assertStrategy';
import { computeWarmupMs } from './computeWarmupMs';
import { earliestCandle } from './earliestCandle';
import { setProfileTicks } from './setProfileTicks';
import { assertNoProfile } from './assertNoProfile';
import { assertRunQueue } from './assertRunQueue';

const DAY_MS = 24 * 60 * 60 * 1000;

// Um lado de uma condição em JSON simples (a média do RSI, se a tiver)
const operandJson = ({ smoothing, ...operand }: OperandDto) => ({
  ...operand,
  ...(smoothing ? { smoothing: { ...smoothing } } : {}),
});

// Uma condição (ou um grupo delas) em JSON simples; "nas últimas N velas" vai em `within`
const toJson = (condition: ConditionDto): Prisma.InputJsonObject => ({
  ...(isGroup(condition)
    ? {
        conditions: (condition.conditions ?? []).map(toJson),
        match: condition.match ?? 'all',
      }
    : conditionJson(condition)),
  ...(condition.within ? { within: { ...condition.within } } : {}),
});

const conditionJson = (condition: ConditionDto) => ({
  left: operandJson(condition.left),
  operator: condition.operator,
  right: operandJson(condition.right),
  ...(condition.operator === 'between' && condition.rightTo
    ? { rightTo: operandJson(condition.rightTo) }
    : {}),
  ...(condition.rightPct ? { rightPct: condition.rightPct } : {}),
});

// O stop: a %, a mínima/máxima das últimas N velas ou um nível (com a folga), e
// o take profit em % ou em R
const stopJson = (entry: EntryRuleDto) => {
  const mode = entry.stopLossMode ?? 'pct';
  return {
    stopLossMode: mode,
    stopLossPct: mode === 'pct' ? (entry.stopLossPct ?? null) : null,
    stopLossBars: mode === 'swing' ? (entry.stopLossBars ?? null) : null,
    stopLossLevel:
      mode === 'level' && entry.stopLossLevel
        ? { ...entry.stopLossLevel }
        : null,
    stopLossBufferPct:
      mode !== 'pct' ? (entry.stopLossBufferPct ?? null) : null,
    takeProfitPct: entry.takeProfitR ? null : (entry.takeProfitPct ?? null),
    takeProfitR: hasStop(entry) ? (entry.takeProfitR ?? null) : null,
    partialExits: (entry.partialExits ?? []).map((part) => ({
      name: cleanName(part.name),
      closePct: part.closePct,
      pct: part.r ? null : (part.pct ?? null),
      r: part.r ?? null,
      moveStop: part.moveStop ?? false,
    })),
  };
};

// A preparação, os ajustes do stop, os reforços e as condições da conta, só com
// os campos de cada caso
const rulesJson = (entry: EntryRuleDto) => ({
  setup: entry.setup
    ? {
        conditions: entry.setup.conditions.map(toJson),
        match: entry.setup.match ?? 'all',
        bars: entry.setup.bars,
        cancel: entry.setup.cancel?.length
          ? entry.setup.cancel.map(toJson)
          : null,
        cancelMatch: entry.setup.cancelMatch ?? 'all',
      }
    : null,
  context: (entry.context ?? []).map((rule) => ({
    kind: rule.kind,
    scope: rule.scope ?? 'all',
    ...(rule.kind === 'lastTrade'
      ? { result: rule.result }
      : { operator: rule.operator, value: rule.value }),
  })),
  stopRules: (entry.stopRules ?? []).map((rule) => ({
    trigger: rule.trigger,
    r: rule.trigger === 'profit' ? (rule.r ?? null) : null,
    pct: rule.trigger === 'profit' && !rule.r ? (rule.pct ?? null) : null,
    conditions:
      rule.trigger === 'conditions' ? (rule.conditions ?? []).map(toJson) : [],
    match: rule.match ?? 'all',
    to: rule.to,
    bars: rule.to === 'swing' ? (rule.bars ?? null) : null,
    level: rule.to === 'level' && rule.level ? { ...rule.level } : null,
    trailPct: rule.to === 'trail' ? (rule.trailPct ?? null) : null,
    bufferPct:
      rule.to === 'swing' || rule.to === 'level'
        ? (rule.bufferPct ?? null)
        : null,
  })),
  scaleIns: (entry.scaleIns ?? []).map((add) => ({
    name: cleanName(add.name),
    trigger: add.trigger,
    r: add.trigger === 'profit' ? (add.r ?? null) : null,
    pct: add.trigger === 'profit' && !add.r ? (add.pct ?? null) : null,
    conditions:
      add.trigger === 'conditions' ? (add.conditions ?? []).map(toJson) : [],
    match: add.match ?? 'all',
    sizePct: add.sizePct,
    moveStop: add.moveStop ?? false,
  })),
});

// Um horário sem regras é o mesmo que nenhum
const scheduleOf = (schedule?: ScheduleDto) =>
  schedule?.rules.length
    ? {
        mode: schedule.mode,
        rules: schedule.rules.map((rule) => ({ ...rule })),
      }
    : null;

// Um nome em branco é o mesmo que nenhum
const cleanName = (name?: string | null) => name?.trim() || null;

/**
 * Põe uma simulação na fila, com o download das velas de que precisa.
 *
 * O download começa umas velas antes do início, para as médias já estarem
 * calculadas na primeira vela simulada. Os meses que já estão no ClickHouse o
 * downloader salta-os; quando acaba, o simulador pega na simulação.
 */
export async function createSimulation(
  userId: string,
  dto: CreateSimulationDto,
  repository: PrismaSimulationRepository,
) {
  const instrument = await repository.findInstrumentById(dto.instrumentId);
  if (!instrument) throw new NotFoundException('Ativo não encontrado');

  assertNoProfile({ indicators: dto.indicators, entries: dto.entries });
  assertStrategy(dto, instrument.type);
  // O perfil de volume com o tick deste mercado (os ticks por linha)
  setProfileTicks(dto.entries, instrument.metadata);

  const fromDate = new Date(`${dto.from.slice(0, 10)}T00:00:00.000Z`);
  const toDate = new Date(
    Math.min(
      new Date(`${dto.to.slice(0, 10)}T00:00:00.000Z`).getTime() + DAY_MS,
      Date.now(),
    ),
  );

  const earliest = earliestCandle(instrument.source);
  if (fromDate.getTime() < earliest) {
    throw new BadRequestException(
      `A data de início não pode ser anterior a ${new Date(earliest).getUTCFullYear()}`,
    );
  }
  if (fromDate >= toDate) {
    throw new BadRequestException(
      'A data de início tem de ser anterior à de fim',
    );
  }

  await assertRunQueue(userId, 1, repository);

  const warmupMs = computeWarmupMs(dto.entries, dto.timeframe);
  const futures = instrument.type !== 'spot';
  const dataFromDate = new Date(
    Math.max(fromDate.getTime() - warmupMs, earliest),
  );

  const run = await repository.createRun({
    userId,
    instrumentId: instrument.id,
    timeframe: dto.timeframe,
    fromDate,
    toDate,
    strategy: {
      // 3: cada entrada com as suas saídas. A 2 tinha stop, take profit e
      // condições de saída gerais; a 1 uma só entrada
      version: 3,
      initialCapital: dto.initialCapital,
      feePct: dto.feePct,
      feeMode: dto.feeMode ?? 'both',
      feeEntryPct: dto.feeEntryPct ?? dto.feePct,
      feeExitPct: dto.feeExitPct ?? dto.feePct,
      slippagePct: dto.slippagePct ?? 0,
      compounding: dto.compounding ?? true,
      // Sem valor ou sem período, não há depósitos
      depositAmount: dto.depositEvery ? (dto.depositAmount ?? 0) : 0,
      depositEvery: dto.depositAmount ? (dto.depositEvery ?? null) : null,
      depositIncrease:
        dto.depositAmount && dto.depositIncrease?.amount
          ? { ...dto.depositIncrease }
          : null,
      tradingGuards: (dto.tradingGuards ?? []).map((guard) => ({
        event: guard.event,
        value: guard.value,
        window: guard.window ? { ...guard.window } : null,
        pause: { ...guard.pause },
      })),
      executionPrice: dto.executionPrice ?? 'open',
      sizing: dto.sizing ? { ...dto.sizing } : { mode: 'all' },
      sizingRules: (dto.sizingRules ?? []).map((rule) => ({ ...rule })),
      // Sem alavancagem (spot) não há liquidação nem funding
      ...(futures
        ? {
            leverage: dto.leverage ?? 1,
            marginMode: dto.marginMode ?? 'isolated',
            maintenanceMarginPct: dto.maintenanceMarginPct ?? 0.5,
            funding: dto.funding ? { ...dto.funding } : { mode: 'none' },
          }
        : {}),
      quantityStep: dto.quantityStep ?? 0,
      minQuantity: dto.minQuantity ?? 0,
      minNotional: dto.minNotional ?? 0,
      maxPositions: dto.maxPositions ?? 1,
      opposite: dto.opposite ?? 'ignore',
      cooldownBars: dto.cooldownBars ?? 0,
      cooldownAfter: dto.cooldownAfter ?? 'any',
      dailyLimits: { ...dto.dailyLimits },
      timezone: dto.timezone ?? 'UTC',
      blockedTimes: (dto.blockedTimes ?? []).map((rule) => ({ ...rule })),
      excludedPeriods: (dto.excludedPeriods ?? []).map((period) => ({
        from: period.from.slice(0, 10),
        to: period.to.slice(0, 10),
      })),
      outOfSamplePct: dto.outOfSamplePct ?? null,
      propFirm: dto.propFirm
        ? {
            dailyLossPct: dto.propFirm.dailyLossPct ?? null,
            maxLossPct: dto.propFirm.maxLossPct ?? null,
            maxLossMode: dto.propFirm.maxLossMode ?? 'static',
            profitTargetPct: dto.propFirm.profitTargetPct ?? null,
            minTradingDays: dto.propFirm.minTradingDays ?? 0,
            days: dto.propFirm.days ?? 30,
          }
        : null,
      indicators: (dto.indicators ?? []).map(({ smoothing, ...indicator }) => ({
        ...indicator,
        name: cleanName(indicator.name),
        smoothing: smoothing ? { ...smoothing } : null,
      })),
      entries: dto.entries.map((entry) => ({
        name: cleanName(entry.name),
        side: entry.side,
        conditions: entry.conditions.map(toJson),
        match: entry.match ?? 'all',
        price: entry.price ? { ...entry.price } : { kind: 'market' },
        ...stopJson(entry),
        ...rulesJson(entry),
        stopLossName: cleanName(entry.stopLossName),
        takeProfitName: cleanName(entry.takeProfitName),
        orderBars: entry.orderBars ?? 1,
        orderTrack: entry.orderTrack ?? false,
        orderCancel: entry.orderCancel ?? false,
        maxPositions: entry.maxPositions ?? 1,
        sizing: entry.sizing ? { ...entry.sizing } : null,
        // A alavancagem só nos futuros
        leverage: futures ? (entry.leverage ?? null) : null,
        schedule: scheduleOf(entry.schedule),
        stopLossSchedule: scheduleOf(entry.stopLossSchedule),
        takeProfitSchedule: scheduleOf(entry.takeProfitSchedule),
        trailingStopPct: entry.trailingStopPct ?? null,
        breakEvenPct: entry.breakEvenPct ?? null,
        maxBars: entry.maxBars ?? null,
        exits: (entry.exits ?? []).map((exit) => ({
          name: cleanName(exit.name),
          conditions: exit.conditions.map(toJson),
          match: exit.match ?? 'all',
          price: { ...exit.price },
          schedule: scheduleOf(exit.schedule),
        })),
      })),
    },
    dataFromDate,
    monthsTotal: countMonthsInRange(dataFromDate, toDate),
  });

  await repository.notify('market_data_download', run.downloadId);
  await repository.notify('simulation_run', run.id);
  return run;
}
