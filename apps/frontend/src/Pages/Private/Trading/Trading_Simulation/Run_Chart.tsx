import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { INDICATORS, createIndicator, createTerminal } from 'openchartscandle/candlestick';
import type {
  Bar,
  Datafeed,
  Indicator,
  Marker,
  Params,
  Terminal,
  Theme,
  TimeRange,
  Trade,
  TradeColors,
  TradeDisplay,
  Timeframe as Chart_Timeframe,
} from 'openchartscandle/candlestick';
import 'openchartscandle/style.css';
import { useTheme } from '../../../../Contexts/ThemeContext';
import { useSimulationChart } from '../../../../Hooks/Trading/useSimulationChart';
import type { Chart_Trade } from '../../../../Hooks/Trading/useSimulationChart';
import { CHART_TIMEFRAMES, fetchCandleBlock } from '../../../../Hooks/Trading/marketCandles';
import type { Simulation_Run, Timeframe } from '../../../../Hooks/Trading/useSimulation';
import { entriesOf, fromRun, hasShift, hasSmoothing, isProfile } from '../Trading_Simulator/simulationForm';
import type { Indicator_Form } from '../Trading_Simulator/simulationForm';
import { formatPct } from '../Trading_Simulator/format';
import Chart_Indicators from './Chart_Indicators';
import type { Simulation_Indicator_Row } from './Chart_Indicators';
import Chart_Settings from './Chart_Settings';
import type { Chart_Display } from './Chart_Settings';
import { NO_FILTER, filterTrades } from './tradeFilter';
import type { Trade_Filter_Value } from './tradeFilter';
import Trade_Picker from './Trade_Picker';
import './Run_Chart.scss';

// O tempo gráfico da simulação no formato da biblioteca
const TIMEFRAME_ID: Record<Timeframe, string> = {
  '1m': '1',
  '3m': '3',
  '5m': '5',
  '15m': '15',
  '30m': '30',
  '1h': '60',
  '4h': '240',
  '1d': '1D',
};

// Os desenhos ficam no browser, um conjunto por mercado
const STORAGE_KEY = 'intristock-chart';
// O que se vê de cada trade também fica no browser, igual para todas as simulações
const DISPLAY_KEY = 'intristock-chart-trade-display';
const DEFAULT_DISPLAY: Chart_Display = { entries: true, exits: true, lines: true, arrowsOnly: false };

// Os indicadores livres (os que se acrescentam no gráfico) e as linhas da
// simulação que se tiraram ficam no browser, à parte para cada simulação: mexer
// numa não muda as outras
const FREE_INDICATORS_KEY = 'intristock-chart-indicators';
const HIDDEN_LINES_KEY = 'intristock-chart-hidden';
// Quantas cores há para as linhas (tokens trading-chart-indicator-N)
const INDICATOR_COLORS = 6;

// Um trade com mais velas do que isto não cabe no ecrã: vai-se à entrada
const MAX_TRADE_BARS = 600;

// O card vai de onde começa até ao fundo da janela, menos esta margem
const BOTTOM_GAP = 16;
// Numa janela baixa (ou no telemóvel) não encolhe mais do que isto: a página faz scroll
const MIN_HEIGHT = 380;

// Onde fica o topo do elemento com a página no início: soma o scroll da janela e
// o de cada contentor por cima dele
const pageTop = (element: HTMLElement) => {
  let top = element.getBoundingClientRect().top + window.scrollY;
  for (let parent = element.parentElement; parent; parent = parent.parentElement) top += parent.scrollTop;
  return top;
};

const readDisplay = (): Chart_Display => {
  try {
    const stored = JSON.parse(localStorage.getItem(DISPLAY_KEY) ?? 'null') as Partial<Chart_Display> | null;
    return { ...DEFAULT_DISPLAY, ...stored };
  } catch {
    return DEFAULT_DISPLAY;
  }
};

interface Saved_Indicator {
  type: string;
  params: Params;
  visible: boolean;
}

const readList = <T,>(key: string): T[] => {
  try {
    const stored = JSON.parse(localStorage.getItem(key) ?? '[]') as unknown;
    return Array.isArray(stored) ? (stored as T[]) : [];
  } catch {
    return [];
  }
};

const saveList = (key: string, items: unknown[]) => {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch {
    // Sem storage: valem só até fechar a página
  }
};

const readFreeIndicators = (runId: string) => readList<Saved_Indicator>(`${FREE_INDICATORS_KEY}.${runId}`);
const saveFreeIndicators = (runId: string, indicators: Saved_Indicator[]) =>
  saveList(`${FREE_INDICATORS_KEY}.${runId}`, indicators);
const readHiddenLines = (runId: string) => readList<string>(`${HIDDEN_LINES_KEY}.${runId}`);
const saveHiddenLines = (runId: string, ids: string[]) => saveList(`${HIDDEN_LINES_KEY}.${runId}`, ids);

// A biblioteca guarda o último tempo gráfico, o fuso e os indicadores, e esses
// ganham às opções. Cada simulação abre no tempo gráfico e no fuso dela, com os
// indicadores livres dela (os da simulação entram depois, à parte)
const openOn = (timeframe: string, runId: string) => {
  try {
    const key = `${STORAGE_KEY}.state`;
    const state = JSON.parse(localStorage.getItem(key) ?? '{}') as Record<string, unknown>;
    delete state.timezone;
    localStorage.setItem(key, JSON.stringify({ ...state, tf: timeframe, indicators: readFreeIndicators(runId) }));
  } catch {
    // Sem storage: valem as opções
  }
};

const saveDisplay = (display: Chart_Display) => {
  try {
    localStorage.setItem(DISPLAY_KEY, JSON.stringify(display));
  } catch {
    // Sem storage (janela privada): vale só até fechar a página
  }
};

// As casas decimais do preço, do passo da corretora ("0.01000000" → 2)
const precisionOf = (tickSize: string | undefined) => {
  const step = Number(tickSize);
  if (!step || step >= 1) return 2;
  return Math.min(8, Math.max(0, Math.round(-Math.log10(step))));
};

const seconds = (iso: string) => Date.parse(iso) / 1000;

/**
 * O canvas não lê variáveis CSS: as cores do gráfico saem dos tokens
 * trading-chart-* já resolvidos para o tema que está à vista.
 */
const tokenReader = (element: HTMLElement) => {
  const style = getComputedStyle(element);
  return (name: string) => style.getPropertyValue(`--trading-chart-${name}`).trim();
};

const readTheme = (element: HTMLElement): Partial<Theme> => {
  const token = tokenReader(element);
  const up = token('up');
  const down = token('down');
  return {
    bg: token('background'),
    appBg: token('app-background'),
    grid: token('grid'),
    border: token('border'),
    text: token('text'),
    textStrong: token('text-strong'),
    muted: token('muted'),
    up,
    down,
    wickUp: up,
    wickDown: down,
    borderUp: up,
    borderDown: down,
    candleBorder: false,
    line: token('accent'),
    accent: token('accent'),
    crosshair: token('crosshair'),
    crosshairLabel: token('crosshair-label'),
    selection: token('selection'),
    handleFill: token('background'),
    font: getComputedStyle(document.body).fontFamily,
  };
};

// A cor N das linhas dos indicadores (dá a volta depois da última)
const indicatorColor = (element: HTMLElement, index: number) =>
  tokenReader(element)(`indicator-${(index % INDICATOR_COLORS) + 1}`);

// O tempo gráfico de um indicador da simulação: o dele ou o da simulação
const timeframeOf = (indicator: Indicator_Form, run: Simulation_Run): Timeframe => indicator.timeframe || run.timeframe;

// Os indicadores que a biblioteca calcula (os mesmos tipos do simulador)
const isChartKind = (kind: string) => INDICATORS.some((entry) => entry.type === kind);

// Os níveis do perfil de volume que a estratégia usa, por fonte (para ligar as linhas deles)
interface Profile_Uses {
  developing: Set<string>;
  session: Set<string>;
  naked: Set<string>;
}

const profileUses = (strategy: Simulation_Run['strategy'], id: string): Profile_Uses => {
  const uses: Profile_Uses = { developing: new Set(), session: new Set(), naked: new Set() };
  const walk = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== 'object') return;
    const item = node as Record<string, unknown>;
    if (item.kind === 'profile' && item.indicator === id) {
      uses[(item.profile as keyof Profile_Uses) ?? 'session']?.add(String(item.profileLevel ?? 'poc'));
    }
    Object.values(item).forEach(walk);
  };
  walk(strategy.entries);
  return uses;
};

// As cores do perfil, dos tokens trading-chart-profile-*
const profileColors = (element: HTMLElement): Params => {
  const token = tokenReader(element);
  const line = token('profile-va-line');
  return {
    upColor: token('profile-up'),
    downColor: token('profile-down'),
    vaUpColor: token('profile-va-up'),
    vaDownColor: token('profile-va-down'),
    pocColor: token('profile-poc'),
    vahColor: line,
    valColor: line,
    devPocColor: token('profile-dev-poc'),
    devVaColor: token('profile-dev-va'),
    boxColor: token('profile-box'),
    valuesColor: token('profile-values'),
  };
};

/**
 * O perfil de volume como a estratégia o fez: as mesmas opções (a sessão, a
 * bolsa, as linhas, a % da área de valor) e as linhas que ela usa ligadas — o
 * VAH e o VAL, prolongados à direita até uma vela lhes tocar quando a estratégia
 * os lê de uma sessão acabada ou virgens (é aí que os usa), e o POC e a área de
 * valor em desenvolvimento. Desenha-se nas velas à vista: no tempo gráfico da
 * simulação são as mesmas do simulador.
 */
const profileParams = (indicator: Indicator_Form, uses: Profile_Uses, element: HTMLElement): Params => {
  const used = (level: string) => uses.developing.has(level) || uses.session.has(level) || uses.naked.has(level);
  const away = (level: string) => uses.session.has(level) || uses.naked.has(level);
  return {
    session: indicator.session,
    customSession: indicator.customSession.trim(),
    exchange: indicator.exchange,
    rowsLayout: indicator.rowsLayout,
    rowSize: Number(indicator.rowSize),
    volume: indicator.volume,
    vaPct: Number(indicator.vaPct),
    showPoc: true,
    showVah: used('vah'),
    showVal: used('val'),
    extendPoc: true,
    extendVah: away('vah'),
    extendVal: away('val'),
    showDevPoc: uses.developing.has('poc'),
    showDevVa: uses.developing.has('vah') || uses.developing.has('val'),
    ...profileColors(element),
  };
};

// Os valores de uma linha da simulação na biblioteca: os do perfil de volume ou,
// nos outros, o período, a fonte e o tempo gráfico, a cor e o que o tipo tem a mais
const simulationParams = (indicator: Indicator_Form, index: number, run: Simulation_Run, element: HTMLElement): Params =>
  isProfile(indicator.kind)
    ? profileParams(indicator, profileUses(run.strategy, indicator.id), element)
    : {
        length: Number(indicator.period),
        source: indicator.field,
        timeframe: TIMEFRAME_ID[timeframeOf(indicator, run)],
        color: indicatorColor(element, index),
        ...chartExtras(indicator, element),
      };

// O nome que a biblioteca dá à linha (a cor não conta para ele)
const libraryTitle = (indicator: Indicator_Form, run: Simulation_Run) => {
  const params: Params = isProfile(indicator.kind)
    ? {
        session: indicator.session,
        rowsLayout: indicator.rowsLayout,
        rowSize: Number(indicator.rowSize),
        volume: indicator.volume,
        vaPct: Number(indicator.vaPct),
      }
    : {
        length: Number(indicator.period),
        source: indicator.field,
        // Só o próprio tempo gráfico: o da simulação não leva o " · 1h"
        ...(indicator.timeframe && indicator.timeframe !== run.timeframe
          ? { timeframe: TIMEFRAME_ID[indicator.timeframe] }
          : {}),
        ...(hasShift(indicator.kind) ? { offset: Number(indicator.shift) || 0 } : {}),
        ...(hasSmoothing(indicator.kind) && indicator.smoothing
          ? { maType: indicator.smoothing, maLength: Number(indicator.smoothingPeriod) }
          : {}),
      };
  return createIndicator(indicator.kind, params)?.title() ?? indicator.kind.toUpperCase();
};

// O que cada tipo tem a mais: nas médias o deslocamento (as mesmas velas para a
// direita, como no simulador); no RSI a média dele, a segunda linha do painel
const chartExtras = (indicator: Indicator_Form, element: HTMLElement): Params => {
  if (hasShift(indicator.kind)) return { offset: Number(indicator.shift) || 0 };
  if (hasSmoothing(indicator.kind) && indicator.smoothing) {
    return {
      maType: indicator.smoothing,
      maLength: Number(indicator.smoothingPeriod),
      maColor: tokenReader(element)('rsi-average'),
    };
  }
  return {};
};

// Entrada: compra ou venda; saída: lucro ou perda
const readTradeColors = (element: HTMLElement): TradeColors => {
  const token = tokenReader(element);
  return {
    long: token('long'),
    short: token('short'),
    profit: token('profit'),
    loss: token('loss'),
  };
};

// O que a biblioteca desenha: só com as setas, nada dela (as setas são marcadores)
const libraryDisplay = (display: Chart_Display): TradeDisplay =>
  display.arrowsOnly
    ? { entries: false, exits: false, lines: false }
    : { entries: display.entries, exits: display.exits, lines: display.lines };

/**
 * Só as setas, sem etiquetas (a biblioteca põe sempre a etiqueta): na entrada a
 * seta para cima (compra) ou para baixo (venda), na cor do lado; na saída a
 * contrária, na cor do resultado. A ponta fica no preço, como nas da biblioteca.
 */
const readArrows = (element: HTMLElement, trades: Trade[], display: Chart_Display): Marker[] => {
  if (!display.arrowsOnly) return [];
  const colors = readTradeColors(element);
  const markers: Marker[] = [];
  for (const trade of trades) {
    const long = trade.side === 'long';
    if (display.entries) {
      markers.push({
        time: trade.entryTime,
        price: trade.entryPrice,
        shape: long ? 'arrowUp' : 'arrowDown',
        color: long ? colors.long : colors.short,
      });
    }
    if (display.exits && trade.exitTime !== undefined && trade.exitPrice !== undefined) {
      const profit = long ? trade.exitPrice >= trade.entryPrice : trade.exitPrice <= trade.entryPrice;
      markers.push({
        time: trade.exitTime,
        price: trade.exitPrice,
        shape: long ? 'arrowDown' : 'arrowUp',
        color: profit ? colors.profit : colors.loss,
      });
    }
  }
  return markers;
};

// Os reforços (círculo) e as saídas parciais (quadrado) de cada trade e, no trade
// marcado, cada passo do stop (ajustes e passagem à entrada), tudo calculado no simulador
const readRuleMarkers = (
  element: HTMLElement,
  trades: Chart_Trade[],
  selectedId: string | null,
  t: TFunction,
): Marker[] => {
  const token = tokenReader(element);
  const markers: Marker[] = [];
  for (const trade of trades) {
    for (const add of trade.adds ?? []) {
      markers.push({ time: add.time / 1000, price: add.price, shape: 'circle', color: token('add'), text: t('trading.chartAdd') });
    }
    for (const part of trade.partials ?? []) {
      markers.push({ time: part.time / 1000, price: part.price, shape: 'square', color: token('partial'), text: t('trading.chartPartial') });
    }
    if (String(trade.index) !== selectedId) continue;
    (trade.stopMoves ?? []).forEach((move, index) => {
      markers.push({
        time: move.time / 1000,
        price: move.level,
        shape: 'square',
        color: token('stop-move'),
        text: index === 0 ? t('trading.chartStopStart') : undefined,
      });
    });
  }
  return markers;
};

// A vela de 1 minuto a decorrer, ao vivo (ms UTC)
export interface Live_Minute {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * O gráfico de um teste ao vivo: os trades dele (os abertos sem saída, com o P&L
 * ao preço atual), a vela do minuto a decorrer a chegar do simulador e o período
 * do teste (o aquecimento antes do início; sem fim, até agora).
 */
export interface Live_Chart_Feed {
  id: string;
  trades: Chart_Trade[];
  subscribe: (listener: (minute: Live_Minute) => void) => () => void;
  warmupFrom: string;
  from: string;
  to: string | null;
}

// As semanas da Binance começam à segunda (o dia 0 do Unix foi uma quinta)
const WEEK_SECONDS = 604_800;
const MONDAY_OFFSET = 345_600;
const bucketOf = (time: number, size: number) =>
  size === WEEK_SECONDS
    ? Math.floor((time - MONDAY_OFFSET) / size) * size + MONDAY_OFFSET
    : Math.floor(time / size) * size;

/**
 * A vela do tempo gráfico à vista feita dos minutos que chegam ao vivo (só para
 * desenhar): começa na última que veio do histórico (`seed`) e vai juntando a
 * máxima, a mínima, o fecho e o volume dos minutos; um minuto de um período novo
 * começa outra vela. O volume do minuto em que o histórico veio já estava em parte
 * nele: conta-se a partir do seguinte.
 */
const liveAggregator = (
  timeframe: Chart_Timeframe,
  seed: { bar: Bar; fetchedAt: number } | null,
  onBar: (bar: Bar) => void,
) => {
  const size = timeframe.seconds;
  let bar: Bar | null = seed ? { ...seed.bar } : null;
  let base: Bar | null = seed ? { ...seed.bar } : null;
  const seedMinute = seed ? Math.floor(seed.fetchedAt / 60_000) * 60 : 0;
  const minutes = new Map<number, Live_Minute>();
  return (minute: Live_Minute) => {
    const time = minute.time / 1000;
    const start = bucketOf(time, size);
    if (!bar || start > bar.time) {
      base = null;
      minutes.clear();
      bar = { time: start, open: minute.open, high: minute.high, low: minute.low, close: minute.close, volume: 0 };
    } else if (start < bar.time) {
      return;
    }
    minutes.set(time, minute);
    let high = base?.high ?? -Infinity;
    let low = base?.low ?? Infinity;
    let volume = base?.volume ?? 0;
    for (const [at, item] of minutes) {
      high = Math.max(high, item.high);
      low = Math.min(low, item.low);
      if (!base || at > seedMinute) volume += item.volume;
    }
    bar = { time: bar.time, open: bar.open, high, low, close: minute.close, volume };
    onBar({ ...bar });
  };
};

// O período simulado e, antes dele, as velas do aquecimento dos indicadores (ou
// os do teste ao vivo: o aquecimento e do início ao fim, sem fim até agora)
const readTimeRanges = (element: HTMLElement, run: Simulation_Run, t: TFunction, live?: Live_Chart_Feed | null): TimeRange[] => {
  const token = tokenReader(element);
  const ranges: TimeRange[] = [];
  const warmupFrom = live ? seconds(live.warmupFrom) : run.download.fromDate ? seconds(run.download.fromDate) : null;
  const from = seconds(live ? live.from : run.fromDate);
  if (warmupFrom !== null && warmupFrom < from) {
    ranges.push({
      id: 'warmup',
      from: warmupFrom,
      to: from,
      color: token('warmup'),
      label: t('trading.chartWarmup'),
      opacity: 0.1,
    });
  }
  ranges.push({
    id: 'period',
    from,
    to: live ? (live.to ? seconds(live.to) : Date.now() / 1000 + 86_400 * 365) : seconds(run.toDate),
    color: token('period'),
    label: t(live ? 'trading.liveChartPeriod' : 'trading.chartPeriod'),
    opacity: 0.05,
    border: true,
    lineStyle: 'dashed',
  });
  return ranges;
};

interface Run_Chart_Props {
  run: Simulation_Run;
  // No teste ao vivo: os trades e as velas a chegar vêm dele
  live?: Live_Chart_Feed | null;
}

/**
 * O gráfico de velas de uma simulação, a ocupar a área toda (do menu da
 * simulação ao fundo da janela), como no TradingView: as velas vêm aos blocos
 * (as mais recentes primeiro, as mais antigas ao arrastar para a esquerda), em
 * qualquer tempo gráfico, e abre no fim do período, já marcado (e o
 * aquecimento antes dele). As entradas e as saídas são as da simulação em
 * qualquer tempo gráfico. No cabeçalho, o seletor dos trades leva o gráfico até
 * um trade, mesmo que as velas dele ainda não tenham vindo.
 */
const Run_Chart = ({ run, live = null }: Run_Chart_Props) => {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const simulation = useSimulationChart(live ? null : run.id);
  const liveTrades = live?.trades;
  const chart = useMemo(() => (liveTrades ? { trades: liveTrades } : simulation.chart), [liveTrades, simulation.chart]);
  const failed = live ? false : simulation.failed;
  const liveRef = useRef(live);
  useEffect(() => {
    liveRef.current = live;
  }, [live]);
  const liveId = live?.id ?? null;
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [display, setDisplay] = useState(readDisplay);
  // Só os trades com esta entrada e esta saída, no gráfico e no seletor
  const [filter, setFilter] = useState<Trade_Filter_Value>(NO_FILTER);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [candlesFailed, setCandlesFailed] = useState(false);
  // Os indicadores da simulação no gráfico
  const [shownIds, setShownIds] = useState<string[]>([]);
  // A cor de cada um no tema à vista (para o menu)
  const [lineColors, setLineColors] = useState<string[]>([]);
  // As linhas da simulação que estão no gráfico, por id do indicador
  const simulationLinesRef = useRef(new Map<string, Indicator>());
  // Os que se desligaram (no menu ou na legenda)
  const hiddenRef = useRef(new Set<string>());

  const language = i18n.language;
  const { instrument } = run;
  const symbol = `${instrument.asset.ticker ?? instrument.symbol}/${instrument.quote}`;

  const changeDisplay = (next: Chart_Display) => {
    setDisplay(next);
    saveDisplay(next);
  };

  const entries = useMemo(() => entriesOf(run.strategy), [run.strategy]);

  // Os indicadores da estratégia (com as médias soltas das simulações antigas).
  // Ficam de fora o tipo que a biblioteca não tem (a média ponderada das
  // antigas) e as médias do volume (a biblioteca desenha-as na escala do preço,
  // que deixava as velas espalmadas). O RSI vai para um painel dele, com a
  // média por cima se a tiver
  const indicators = useMemo(
    () =>
      fromRun(run).indicators.filter(
        (item) => isChartKind(item.kind) && (item.kind === 'rsi' || item.field !== 'volume'),
      ),
    [run],
  );
  const indicatorsRef = useRef(indicators);
  useEffect(() => {
    indicatorsRef.current = indicators;
  }, [indicators]);

  /**
   * Põe no gráfico as linhas da simulação que não foram desligadas e tira as
   * outras. Cada uma é calculada no tempo gráfico dela (o do indicador ou o da
   * simulação), em qualquer tempo gráfico do gráfico: a biblioteca vai buscar
   * essas velas e, num maior, desenha em degraus com a última vela fechada,
   * como a simulação decidiu.
   */
  const syncSimulationLines = useCallback(() => {
    const terminal = terminalRef.current;
    const container = containerRef.current;
    if (!terminal || !container) return;
    const lines = simulationLinesRef.current;
    indicatorsRef.current.forEach((indicator, index) => {
      const wanted = !hiddenRef.current.has(indicator.id);
      const line = lines.get(indicator.id);
      if (wanted && !line) {
        const created = createIndicator(indicator.kind, simulationParams(indicator, index, run, container));
        if (!created) return;
        // Na legenda fica o nome da biblioteca ("MA 50 close", "SVP HD Cada 24 Alta/Baixa 70")
        lines.set(indicator.id, created);
        terminal.chart.addIndicator(created);
      } else if (!wanted && line) {
        lines.delete(indicator.id);
        terminal.chart.removeIndicator(line);
      }
    });
    setShownIds([...lines.keys()]);
  }, [run]);

  // A altura vai direta ao estilo do card (não é estado): mede-se ao abrir e
  // sempre que a janela muda de tamanho. Ao vivo há mais por baixo (os números e os
  // registos): o gráfico vai até ao fundo da janela e o resto vê-se com scroll
  const isLive = Boolean(live);
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const fit = () => {
      let height = Math.max(MIN_HEIGHT, window.innerHeight - pageTop(card) - BOTTOM_GAP);
      card.style.height = `${height}px`;
      if (isLive) return;
      // A margem de baixo do contentor da página ainda faria scroll: tira-se
      const overflow = document.documentElement.scrollHeight - window.innerHeight;
      if (overflow > 0 && height > MIN_HEIGHT) {
        height = Math.max(MIN_HEIGHT, height - overflow);
        card.style.height = `${height}px`;
      }
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [isLive]);

  const filteredTrades = useMemo(() => (chart ? filterTrades(chart.trades, filter) : []), [chart, filter]);

  // Na entrada Long ou Short (o texto da biblioteca, sem label); na saída o
  // resultado, com a vírgula da língua
  const trades = useMemo<Trade[]>(
    () =>
      filteredTrades.map((trade) =>
        // Um trade aberto (ao vivo) vai sem saída: a biblioteca mostra o P&L ao último preço
        trade.exitTime
          ? {
              id: String(trade.index),
              side: trade.side,
              entryTime: seconds(trade.entryTime),
              entryPrice: trade.entryPrice,
              exitTime: seconds(trade.exitTime),
              exitPrice: trade.exitPrice,
              // Sem qty: a biblioteca punha-a na etiqueta com todas as casas decimais
              exitLabel: formatPct(trade.pnlPct, language),
            }
          : { id: String(trade.index), side: trade.side, entryTime: seconds(trade.entryTime), entryPrice: trade.entryPrice },
      ),
    [filteredTrades, language],
  );

  // O terminal nasce uma vez por simulação e começa logo a pedir as velas, sem
  // esperar pelos trades. O spot e o perpétuo têm o mesmo par: o ".P" (como no
  // TradingView) separa os desenhos de cada um
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chartSymbol = instrument.type === 'spot' ? symbol : `${symbol}.P`;
    // Ao vivo: a última vela que veio do histórico em cada tempo gráfico, de onde
    // a vela a decorrer continua
    const latest = new Map<string, { bar: Bar; fetchedAt: number }>();
    const datafeed: Datafeed = {
      getSymbols: () => [
        {
          symbol: chartSymbol,
          name: symbol,
          exchange: instrument.source.toUpperCase(),
          currency: instrument.quote,
          precision: precisionOf(instrument.metadata?.tickSize),
        },
      ],
      getBars: async (_symbol, timeframe, request) => {
        const block = await fetchCandleBlock(instrument.id, timeframe, request);
        const newest = block.bars[block.bars.length - 1];
        if (newest && request.to * 1000 >= Date.now() - timeframe.seconds * 1000) {
          latest.set(timeframe.id, { bar: newest, fetchedAt: Date.now() });
        }
        return block;
      },
      // Numa simulação o período já acabou: nada a chegar. Ao vivo, a vela a
      // decorrer vem dos minutos que o simulador manda
      subscribeBars: (_symbol, timeframe, onBar) => {
        const feed = liveRef.current;
        if (!feed) return () => {};
        return feed.subscribe(liveAggregator(timeframe, latest.get(timeframe.id) ?? null, onBar));
      },
    };

    openOn(TIMEFRAME_ID[run.timeframe], run.id);
    const lines = new Map<string, Indicator>();
    simulationLinesRef.current = lines;
    hiddenRef.current = new Set(readHiddenLines(run.id));
    const terminal = createTerminal(container, {
      datafeed,
      symbol: chartSymbol,
      timeframe: TIMEFRAME_ID[run.timeframe],
      timeframes: CHART_TIMEFRAMES,
      // Abre no fim do período, com a simulação à esquerda (ao vivo, agora)
      initialTime: liveRef.current ? Date.now() / 1000 : seconds(run.toDate) - 1,
      // As horas do eixo no fuso da simulação, o das regras de horário
      timezone: run.strategy.timezone ?? 'UTC',
      minimal: true,
      leftToolbar: true,
      // A legenda dos valores (e de cada indicador: definições, ocultar, tirar)
      legend: true,
      indicatorPicker: false,
      storageKey: STORAGE_KEY,
      theme: readTheme(container),
      tradeColors: readTradeColors(container),
      tradeDisplay: libraryDisplay(readDisplay()),
    });
    terminalRef.current = terminal;
    terminal.chart.setTimeRanges(readTimeRanges(container, run, t, liveRef.current));

    // Um trade marcado no gráfico (clique ou seletor) fica marcado no seletor
    const offSelected = terminal.chart.tradeSelected.on((trade) => setSelectedId(trade?.id ?? null));
    // A biblioteca não mostra erros: um bloco que falhou aparece no card
    const offError = terminal.error.on(() => setCandlesFailed(true));
    const offLoading = terminal.loadingChanged.on((busy) => {
      if (busy) setCandlesFailed(false);
    });

    // Os livres ficam guardados a cada mudança; uma linha da simulação tirada
    // na legenda passa a desligada
    const offIndicators = terminal.chart.indicatorsChanged.on(() => {
      const onChart = terminal.chart.indicators;
      let removed = false;
      for (const [id, line] of lines) {
        if (onChart.includes(line)) continue;
        lines.delete(id);
        hiddenRef.current.add(id);
        removed = true;
      }
      if (removed) {
        setShownIds([...lines.keys()]);
        saveHiddenLines(run.id, [...hiddenRef.current]);
      }
      const simulation = new Set(lines.values());
      saveFreeIndicators(run.id, onChart.filter((item) => !simulation.has(item)).map((item) => item.toJSON()));
    });
    void terminal.ready.then(() => {
      if (terminalRef.current === terminal) syncSimulationLines();
    });

    return () => {
      offSelected();
      offError();
      offLoading();
      offIndicators();
      terminal.destroy();
      terminalRef.current = null;
    };
    // O run é o mesmo enquanto o id for o mesmo (vem do seed da página); ao vivo,
    // outro teste faz outro gráfico
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run.id, liveId]);

  // Os trades (os do filtro) entram quando chegam e as primeiras velas já
  // vieram, e de novo ao mudar o filtro, a língua, o que se vê ou o tema (as
  // cores das setas). Na frame seguinte, pelo tema: ver o efeito de baixo
  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;
    let cancelled = false;
    let frame = 0;
    void terminal.ready.then(() => {
      if (cancelled) return;
      frame = requestAnimationFrame(() => {
        const container = containerRef.current;
        if (!container) return;
        terminal.chart.setTrades(trades);
        terminal.chart.setTradeDisplay(libraryDisplay(display));
        terminal.chart.setMarkers([
          ...readArrows(container, trades, display),
          ...readRuleMarkers(container, filteredTrades, selectedId, t),
        ]);
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [trades, filteredTrades, selectedId, display, theme, t]);

  // Trocar de tema na app pinta o gráfico outra vez (e as etiquetas das zonas
  // mudam com a língua). Na frame seguinte: este efeito corre antes do que
  // muda o data-theme do <html> (o do ThemeProvider)
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const container = containerRef.current;
      const terminal = terminalRef.current;
      if (!container || !terminal) return;
      terminal.applyTheme(readTheme(container));
      terminal.chart.applyOptions({ tradeColors: readTradeColors(container) });
      // As linhas da simulação seguem o tema; as livres ficam com a cor que têm
      // No menu, o perfil de volume com a cor do POC
      setLineColors(
        indicatorsRef.current.map((indicator, index) =>
          isProfile(indicator.kind) ? tokenReader(container)('profile-poc') : indicatorColor(container, index),
        ),
      );
      indicatorsRef.current.forEach((indicator, index) => {
        const line = simulationLinesRef.current.get(indicator.id);
        if (!line) return;
        if (isProfile(indicator.kind)) {
          Object.assign(line.params, profileColors(container));
          terminal.chart.updateIndicator(line);
          return;
        }
        line.params.color = indicatorColor(container, index);
        if (line.params.maColor !== undefined) line.params.maColor = tokenReader(container)('rsi-average');
        terminal.chart.updateIndicator(line);
      });
      terminal.chart.setTimeRanges(readTimeRanges(container, run, t, liveRef.current));
    });
    return () => cancelAnimationFrame(frame);
  }, [theme, run, t, liveId]);

  // Leva o gráfico até ao trade inteiro e marca-o (as velas que faltam vêm
  // antes). Um trade longo no tempo gráfico à vista (meses em 1h) não cabe:
  // fica a entrada ao centro
  const goToTrade = (trade: Chart_Trade) => {
    const terminal = terminalRef.current;
    if (!terminal) return;
    // Um aberto (ao vivo) vai até agora
    const end = trade.exitTime ? seconds(trade.exitTime) : Date.now() / 1000;
    const bars = (end - seconds(trade.entryTime)) / terminal.timeframe.seconds;
    void terminal.chart.goToTrade(String(trade.index), bars > MAX_TRADE_BARS || !trade.exitTime ? 'entry' : 'both');
  };

  const simulationRows = useMemo<Simulation_Indicator_Row[]>(
    () =>
      indicators.map((indicator, index) => ({
        id: indicator.id,
        // O nome da biblioteca, o mesmo da legenda ("MA 50 close", "SVP HD Cada 24 Alta/Baixa 70")
        label: libraryTitle(indicator, run),
        color: lineColors[index] ?? '',
        shown: shownIds.includes(indicator.id),
      })),
    [indicators, run, shownIds, lineColors],
  );

  const toggleSimulationLine = (id: string) => {
    if (simulationLinesRef.current.has(id)) hiddenRef.current.add(id);
    else hiddenRef.current.delete(id);
    saveHiddenLines(run.id, [...hiddenRef.current]);
    syncSimulationLines();
  };

  // Um indicador livre, com os valores por omissão da biblioteca (mudam-se na
  // legenda, também o tempo gráfico)
  const addFreeIndicator = (kind: string) => {
    const terminal = terminalRef.current;
    const container = containerRef.current;
    if (!terminal || !container) return;
    const created = createIndicator(kind, { color: indicatorColor(container, terminal.chart.indicators.length) });
    if (created) terminal.chart.addIndicator(created);
  };

  const retry = () => {
    setCandlesFailed(false);
    terminalRef.current?.reload();
  };

  return (
    <div className="Page_Card Run_Chart" ref={cardRef}>
      <div className="Card_Header">
        <div className="Card_Header_Text">
          <span className="Card_Title">{symbol}</span>
          <span className="Card_Subtitle">
            {chart
              ? `${live ? `${t('trading.liveBadge')} · ` : ''}${t(`trading.tf_${run.timeframe}`)} · ${t('trading.chartTrades', { count: chart.trades.length })}`
              : ' '}
          </span>
        </div>

        <div className="Card_Header_Action Run_Chart_Actions">
          {chart && chart.trades.length > 0 && (
            <Trade_Picker
              trades={chart.trades}
              entries={entries}
              filter={filter}
              onFilterChange={setFilter}
              selectedId={selectedId}
              onSelect={goToTrade}
            />
          )}
          <Chart_Indicators
            simulation={simulationRows}
            onToggle={toggleSimulationLine}
            onAdd={addFreeIndicator}
          />
          <Chart_Settings display={display} onChange={changeDisplay} />
        </div>
      </div>

      <div className="Run_Chart_Body">
        <div className="Run_Chart_Canvas" ref={containerRef} />
        {(failed || candlesFailed) && (
          <div className="Run_Chart_Message">
            <span>{t(candlesFailed ? 'trading.chartFailed' : 'trading.chartTradesFailed')}</span>
            {candlesFailed && (
              <button type="button" className="Run_Chart_Retry" onClick={retry}>
                {t('trading.chartRetry')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Run_Chart;
