import { BadRequestException } from '@nestjs/common';
import {
  ConditionDto,
  CreateSimulationDto,
  EntryRuleDto,
  ExitPriceDto,
  OperandDto,
  isCount,
  isGroup,
  isProfilePrice,
  isSeries,
} from '../dto/create-simulation.dto';

// '0930-1600' ou '0900-1130,1230-1530' com horas e minutos que existem (24:00 só no fim)
const validRanges = (text: string) =>
  text.split(',').every((part) => {
    const [a, b] = part.replace(/:/g, '').split('-');
    const minutes = (hhmm: string) =>
      Number(hhmm.slice(2)) < 60
        ? Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(2))
        : NaN;
    return minutes(a) <= 1439 && minutes(b) <= 1440;
  });

// As partes do dia de cada bolsa (as da trading-chart); a do mercado é a de cripto
const EXCHANGE_PARTS: Record<string, string[]> = {
  '': ['regular'],
  CRYPTO: ['regular'],
  NYSE: ['overnight', 'pre', 'regular', 'post'],
  CME: ['overnight', 'regular', 'post'],
  B3: ['pre', 'regular', 'post'],
  EURONEXT: ['pre', 'regular', 'post'],
  XETRA: ['pre', 'regular', 'post'],
  LSE: ['pre', 'regular', 'post'],
  TSE: ['regular'],
  HKEX: ['pre', 'regular', 'post'],
  FOREX: ['regular'],
};

/**
 * Um valor do perfil de volume: o virgem só existe nos níveis (POC, VAH, VAL),
 * o horário próprio precisa das horas, só uma parte do dia que a bolsa não tem
 * nunca dá perfis e, nas velas diárias (cada vela é uma sessão), em
 * desenvolvimento nunca há velas fechadas da sessão.
 */
const checkProfile = (
  operand: OperandDto | ExitPriceDto,
  where: string,
  timeframe: string,
) => {
  if (operand.kind !== 'profile') return;
  const session = operand.session ?? 'each';
  if (
    ['pre', 'post', 'overnight'].includes(session) &&
    !(EXCHANGE_PARTS[operand.exchange ?? ''] ?? []).includes(session)
  ) {
    throw new BadRequestException(
      `${where}: esta bolsa não tem essa parte do dia (o perfil nunca teria sessões)`,
    );
  }
  if (timeframe === '1d' && operand.profile === 'developing') {
    throw new BadRequestException(
      `${where}: nas velas diárias cada vela é uma sessão, por isso o perfil em desenvolvimento não existe`,
    );
  }
  if (operand.profile === 'naked' && !isProfilePrice(operand.profileLevel)) {
    throw new BadRequestException(
      `${where}: o nível virgem é do POC, do VAH ou do VAL`,
    );
  }
  if (operand.session === 'custom') {
    if (!operand.customSession || !validRanges(operand.customSession)) {
      throw new BadRequestException(
        `${where}: o horário da sessão é como 0930-1600 (ou 0900-1130,1230-1530)`,
      );
    }
  }
};

// Se a entrada tem stop: a % ou um dos outros modos (a mínima/máxima, um nível)
export const hasStop = (entry: EntryRuleDto) =>
  (entry.stopLossMode ?? 'pct') === 'pct' ? !!entry.stopLossPct : true;

/**
 * Regras que o class-validator não apanha sozinho.
 *
 * A principal é não ver o futuro: a decisão é tomada na abertura da vela -1,
 * por isso dessa vela só se pode usar a abertura. O fecho, a máxima e a mínima
 * da -1 (e uma média que os inclua) só se conhecem quando ela fecha. Vale para
 * as condições e para os preços de entrada e de saída.
 */
export function assertStrategy(
  dto: CreateSimulationDto,
  instrumentType: string,
) {
  const usesFuture = (operand: OperandDto | ExitPriceDto) =>
    isSeries(operand.kind) && operand.offset === -1 && operand.field !== 'open';

  // Um grupo junta condições (uma camada só: dentro dele não há grupos)
  const checkConditions = (
    conditions: ConditionDto[],
    name: string,
    nested = false,
  ): void =>
    conditions.forEach((condition, index) => {
      const where = `${name}, condição ${index + 1}`;
      if (isGroup(condition)) {
        if (nested) {
          throw new BadRequestException(
            `${where}: dentro de um grupo não há outros grupos`,
          );
        }
        checkConditions(condition.conditions ?? [], `${where} (grupo)`, true);
        return;
      }
      // Em "entre" há o outro limite; nos outros operadores fica de fora
      const between = condition.operator === 'between';
      if (between && !condition.rightTo) {
        throw new BadRequestException(
          `${where}: "entre" precisa dos dois limites`,
        );
      }
      const right =
        between && condition.rightTo
          ? [condition.right, condition.rightTo]
          : [condition.right];

      [condition.left, ...right].forEach((operand) =>
        checkProfile(operand, where, dto.timeframe),
      );
      if ([condition.left, ...right].some(usesFuture)) {
        throw new BadRequestException(
          `${where}: da vela -1 (a atual) só se conhece a abertura`,
        );
      }
      if (
        [condition.left, ...right].some(
          (operand) => operand.smoothing && operand.kind !== 'rsi',
        )
      ) {
        throw new BadRequestException(`${where}: só o RSI tem média`);
      }
      if (
        condition.left.kind === 'number' &&
        right.every((operand) => operand.kind === 'number')
      ) {
        throw new BadRequestException(
          `${where}: compara pelo menos um preço ou um indicador`,
        );
      }
    });

  // Um preço de entrada ou saída é um preço: o volume, o RSI (de 0 a 100), as
  // contagens de velas verdes/vermelhas e o delta e o volume da linha do perfil não servem
  const checkPrice = (price: ExitPriceDto | undefined, what: string) => {
    if (price) checkProfile(price, what, dto.timeframe);
    if (price?.kind === 'profile' && !isProfilePrice(price.profileLevel)) {
      throw new BadRequestException(
        `${what} não pode ser o delta nem o volume da linha do perfil`,
      );
    }
    if (price?.field === 'volume' && isSeries(price.kind)) {
      throw new BadRequestException(`${what} não pode ser o volume`);
    }
    if (price?.kind === 'rsi') {
      throw new BadRequestException(`${what} não pode ser o RSI`);
    }
    if (price && isCount(price.kind)) {
      throw new BadRequestException(
        `${what} não pode ser uma contagem de velas`,
      );
    }
  };

  const futures = instrumentType !== 'spot';
  if (!futures && dto.leverage && dto.leverage > 1) {
    throw new BadRequestException('No spot não há alavancagem');
  }
  if (!futures && dto.funding && dto.funding.mode !== 'none') {
    throw new BadRequestException('O funding só existe nos futuros');
  }
  if (dto.funding?.mode === 'historical' && instrumentType !== 'perpetual') {
    throw new BadRequestException(
      'O funding da Binance só existe nos perpétuos; usa uma taxa fixa',
    );
  }
  if (dto.sizing?.mode === 'percent' && (dto.sizing.value ?? 0) > 100) {
    throw new BadRequestException('A % do capital não pode passar de 100');
  }
  dto.entries.forEach((entry, index) => {
    const sizing = entry.sizing ?? dto.sizing;
    const name = `Entrada ${index + 1}`;
    if (sizing?.mode === 'risk' && !hasStop(entry)) {
      throw new BadRequestException(
        `${name}: com risco fixo, precisa de stop loss (o risco mede-se até ele)`,
      );
    }
    if (sizing?.mode === 'percent' && (sizing.value ?? 0) > 100) {
      throw new BadRequestException(
        `${name}: a % do capital não pode passar de 100`,
      );
    }
    if (!futures && entry.leverage && entry.leverage > 1) {
      throw new BadRequestException(`${name}: no spot não há alavancagem`);
    }
  });
  if (
    dto.timezone &&
    dto.timezone !== 'UTC' &&
    !Intl.supportedValuesOf('timeZone').includes(dto.timezone)
  ) {
    throw new BadRequestException('Fuso horário desconhecido');
  }
  (dto.excludedPeriods ?? []).forEach((period, index) => {
    if (period.from.slice(0, 10) > period.to.slice(0, 10)) {
      throw new BadRequestException(
        `Período excluído ${index + 1}: o início tem de ser antes do fim`,
      );
    }
  });
  (dto.blockedTimes ?? []).forEach((rule, index) => {
    if (!rule.days.length && !(rule.from && rule.to)) {
      throw new BadRequestException(
        `Horário bloqueado ${index + 1}: escolhe dias, horas ou os dois`,
      );
    }
  });

  dto.entries.forEach((entry, index) => {
    const name = `Entrada ${index + 1}`;
    if ((entry.maxPositions ?? 1) > (dto.maxPositions ?? 1)) {
      throw new BadRequestException(
        `${name}: a pirâmide não pode passar do máximo de posições abertas`,
      );
    }
    const exits = entry.exits ?? [];

    checkConditions(entry.conditions, name);
    checkPrice(entry.price, `${name}: o preço de entrada`);
    checkStop(entry, name, dto.timeframe);
    checkRules(entry, name, checkConditions, checkPrice, usesFuture);
    if (entry.price && usesFuture(entry.price)) {
      throw new BadRequestException(
        `${name}: o preço de entrada não pode ser da vela -1, além da abertura`,
      );
    }
    exits.forEach((exit, exitIndex) => {
      const exitName = `${name}, saída ${exitIndex + 1}`;
      checkConditions(exit.conditions, exitName);
      checkPrice(exit.price, `${exitName}: o preço de saída`);
      if (usesFuture(exit.price)) {
        throw new BadRequestException(
          `${exitName}: o preço de saída não pode ser da vela -1, além da abertura`,
        );
      }
    });

    if (
      !hasStop(entry) &&
      !entry.takeProfitPct &&
      !entry.takeProfitR &&
      !entry.trailingStopPct &&
      !entry.maxBars &&
      !entry.stopRules?.length &&
      !exits.length
    ) {
      throw new BadRequestException(
        `${name}: define o stop loss, o take profit, um trailing, uma saída por tempo ou uma saída, senão o trade nunca fecha`,
      );
    }

    if (entry.side === 'short') {
      if (instrumentType === 'spot') {
        throw new BadRequestException(
          `${name}: no spot só se compra; vender a descoberto só em perpétuos e futuros`,
        );
      }
      if (entry.takeProfitPct && entry.takeProfitPct >= 100) {
        throw new BadRequestException(
          `${name}: numa venda o take profit tem de ser inferior a 100%`,
        );
      }
      if ((entry.partialExits ?? []).some((part) => (part.pct ?? 0) >= 100)) {
        throw new BadRequestException(
          `${name}: numa venda uma saída parcial tem de ser inferior a 100%`,
        );
      }
    }
  });

  const firm = dto.propFirm;
  if (firm && !firm.dailyLossPct && !firm.maxLossPct && !firm.profitTargetPct) {
    throw new BadRequestException(
      'Desafio de prop firm: define a perda diária, a perda máxima ou o objetivo de lucro',
    );
  }
}

/**
 * O stop noutro modo (a mínima/máxima das últimas velas, um nível), o take em R
 * e as saídas parciais: o que precisam uns dos outros.
 */
function checkStop(entry: EntryRuleDto, name: string, timeframe: string) {
  const mode = entry.stopLossMode ?? 'pct';
  if (mode === 'swing' && !entry.stopLossBars) {
    throw new BadRequestException(
      `${name}: diz de quantas velas é a mínima/máxima do stop`,
    );
  }
  if (mode === 'level') {
    const level = entry.stopLossLevel;
    if (!level || level.kind === 'market') {
      throw new BadRequestException(`${name}: escolhe o nível do stop`);
    }
    checkProfile(level, `${name}: o stop`, timeframe);
    if (
      level.kind === 'rsi' ||
      (isSeries(level.kind) && level.field === 'volume') ||
      isCount(level.kind) ||
      (level.kind === 'profile' && !isProfilePrice(level.profileLevel))
    ) {
      throw new BadRequestException(
        `${name}: o stop é um preço (não o volume, o RSI, uma contagem nem o delta do perfil)`,
      );
    }
    if (isSeries(level.kind) && level.offset === -1 && level.field !== 'open') {
      throw new BadRequestException(
        `${name}: o stop não pode ser da vela -1, além da abertura`,
      );
    }
  }
  if (entry.takeProfitR && entry.takeProfitPct) {
    throw new BadRequestException(
      `${name}: o take profit é em % ou em R, não nos dois`,
    );
  }
  if (entry.takeProfitR && !hasStop(entry)) {
    throw new BadRequestException(
      `${name}: o take profit em R precisa de stop (o R é a distância até ele)`,
    );
  }

  const partials = entry.partialExits ?? [];
  partials.forEach((part, index) => {
    const where = `${name}, saída parcial ${index + 1}`;
    if (!part.pct === !part.r) {
      throw new BadRequestException(`${where}: diz a % ou o R (só um)`);
    }
    if (part.r && !hasStop(entry)) {
      throw new BadRequestException(`${where}: em R precisa de stop`);
    }
  });
  if (partials.reduce((sum, part) => sum + part.closePct, 0) >= 100) {
    throw new BadRequestException(
      `${name}: as saídas parciais têm de deixar parte da posição (menos de 100% no total)`,
    );
  }
}

/**
 * A preparação, os ajustes do stop, os reforços e as condições da conta: as
 * condições de cada um (como as da entrada) e o que precisam uns dos outros.
 */
function checkRules(
  entry: EntryRuleDto,
  name: string,
  checkConditions: (conditions: ConditionDto[], name: string) => void,
  checkPrice: (price: ExitPriceDto | undefined, what: string) => void,
  usesFuture: (operand: OperandDto | ExitPriceDto) => boolean,
) {
  if (entry.setup) {
    checkConditions(entry.setup.conditions, `${name}, preparação`);
    checkConditions(entry.setup.cancel ?? [], `${name}, cancelar a preparação`);
  }

  (entry.stopRules ?? []).forEach((rule, index) => {
    const where = `${name}, ajuste do stop ${index + 1}`;
    if (rule.trigger === 'profit' && !rule.r === !rule.pct) {
      throw new BadRequestException(`${where}: diz a % ou o R (só um)`);
    }
    if (rule.trigger === 'profit' && rule.r && !hasStop(entry)) {
      throw new BadRequestException(`${where}: em R precisa de stop`);
    }
    if (rule.trigger === 'conditions') {
      checkConditions(rule.conditions ?? [], where);
    }
    if (rule.to === 'level') {
      if (!rule.level || rule.level.kind === 'market') {
        throw new BadRequestException(`${where}: escolhe o nível do stop`);
      }
      checkPrice(rule.level, `${where}: o nível`);
      if (usesFuture(rule.level)) {
        throw new BadRequestException(
          `${where}: o nível não pode ser da vela -1, além da abertura`,
        );
      }
    }
  });

  (entry.scaleIns ?? []).forEach((add, index) => {
    const where = `${name}, reforço ${index + 1}`;
    if (add.trigger === 'profit' && !add.r === !add.pct) {
      throw new BadRequestException(`${where}: diz a % ou o R (só um)`);
    }
    if (add.trigger === 'profit' && add.r && !hasStop(entry)) {
      throw new BadRequestException(`${where}: em R precisa de stop`);
    }
    if (add.trigger === 'conditions') {
      checkConditions(add.conditions ?? [], where);
    }
  });
}
