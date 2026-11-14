import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSimulationReport } from '../../../../Hooks/Trading/useSimulation';
import type { Report_Block, Simulation_Run } from '../../../../Hooks/Trading/useSimulation';
import { entryLabel } from '../Trading_Simulator/labels';
import { entriesOf } from '../Trading_Simulator/simulationForm';
import Factsheet_Exit_Hour_Table from './Factsheet_Exit_Hour_Table';
import Factsheet_Calendar from './Factsheet_Calendar';
import Factsheet_Calendar_Days from './Factsheet_Calendar_Days';
import Factsheet_Card from './Factsheet_Card';
import { Factsheet_Conclusions } from './Factsheet_Verdict';
import Factsheet_Day_Hour_Grid from './Factsheet_Day_Hour_Grid';
import type { Day_Hour_Cell } from './Factsheet_Day_Hour_Grid';
import Factsheet_Duration_Weekday from './Factsheet_Duration_Weekday';
import Factsheet_Entry_Blocks from './Factsheet_Entry_Blocks';
import Factsheet_Entry_Hours from './Factsheet_Entry_Hours';
import Factsheet_Entry_Name from './Factsheet_Entry_Name';
import Factsheet_Group_Bars from './Factsheet_Group_Bars';
import type { Group_Bars_Series } from './Factsheet_Group_Bars';
import Factsheet_Heading from './Factsheet_Heading';
import Factsheet_Hour_Bars from './Factsheet_Hour_Bars';
import Factsheet_Hour_Filters from './Factsheet_Hour_Filters';
import Factsheet_Hour_Sample from './Factsheet_Hour_Sample';
import Factsheet_Hour_Stack from './Factsheet_Hour_Stack';
import type { Hour_Stack_Series } from './Factsheet_Hour_Stack';
import type { Hour_Bars_Part } from './Factsheet_Hour_Bars';
import Factsheet_Hour_Table from './Factsheet_Hour_Table';
import Factsheet_Panel from './Factsheet_Panel';
import Factsheet_Passage from './Factsheet_Passage';
import Factsheet_Session_Moments from './Factsheet_Session_Moments';
import Factsheet_Weekday_Table from './Factsheet_Weekday_Table';
import { Factsheet_Session_Edges, Factsheet_Work_Hours, Factsheet_World_Sessions } from './Factsheet_World_Sessions';
import { entryColor, exitColorToken, hourLabel, moneyUnit, useFactsheetFormat } from './factsheetFormat';
import './Run_Summary.scss';

interface Run_Hours_Props {
  run: Simulation_Run;
}

const HOUR_BLOCKS: Report_Block[] = [
  'hourCards',
  'hourEntries',
  'hourStops',
  'hourPnl',
  'hourTable',
  'exitHours',
  'exitHourStops',
  'exitHourWins',
  'exitHourEntries',
  'weekdayCards',
  'weekdayEntries',
  'weekdayStops',
  'weekdayPnl',
  'weekdayTable',
  'weekdayEntryStops',
  'weekdayEntryWins',
  'weekdayEntryPnl',
  'weekdayHourTrades',
  'weekdayHourStops',
  'weekdayHourWinRate',
  'weekdayHourPnl',
  'calendarCards',
  'calendarDaily',
  'calendarStopDays',
  'calendarBestDays',
  'calendarMonthDay',
  'calendarWeeks',
  'entryHourProfiles',
  'entryHourBlocks',
  'positionDuration',
  'positionHours',
  'sessionMoments',
  'fundingHours',
  'durationByWeekday',
  'hourFilters',
  'hourFilterWorst',
  'hourFilterBest',
  'gapCards',
  'gapDaily',
  'passageGroups',
  'sessionRules',
  'worldSessions',
  'workHours',
  'sessionEdges',
  'verdicts',
];

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

// 5.5: até quantas semanas o nº de stops vai por cima de cada uma
const WEEK_LABELS_MAX = 80;

// "2026-04-13" → "13/04/2026"
const dateLabel = (date: string) => date.split('-').reverse().join('/');

// As cores dos quadros da 5.4 (tokens; `null` = a cor de base): as contagens do
// vazio à cor, o win rate e o P&L de laranja a azul, com a base no meio
const GRID_COUNT_COLORS = [null, 'cell-positive'];
const GRID_STOP_COLORS = [null, 'exit-stop'];
const GRID_SPLIT_COLORS = ['cell-negative', null, 'cell-positive'];

// A última hora da madrugada na legenda (a 5.2 conta das 0h às 7h, `NIGHT_HOURS`)
const NIGHT_END = 7;

// Os motivos de saída com o nome do estudo (os outros usam o da lista de trades)
const EXIT_HOUR_NAMES = ['stop_loss', 'trailing_stop', 'break_even', 'take_profit', 'signal', 'time'];

// O fuso do texto que vem do estudo (o de Portugal, com a mudança de hora)
const LISBON = 'Europe/Lisbon';

/**
 * O ecrã 5 de uma simulação, os Horários: as horas de entrada (5.1) — os 6
 * cartões, os trades de cada hora por entrada, lado a lado os stops e o P&L por
 * hora e a tabela por hora — e as horas de saída (5.2) — as saídas de cada hora
 * por motivo, lado a lado os stops e as saídas a ganhar por hora de saída e a
 * tabela entrada → hora de saída — e os dias da semana (5.3), tudo em coluna:
 * os 6 cartões, as entradas por dia, os stops pela entrada e pela saída, o P&L,
 * a tabela e, com uma legenda partilhada, os stops, ganhos e P&L de cada entrada
 * por dia — e o dia da semana × hora (5.4), quatro mapas de calor com o mesmo
 * quadriculado —, o calendário (5.5), cada entrada por hora (5.6) e o tempo em
 * posição (5.7), os filtros de horário sugeridos (5.8), as sessões, fins de
 * semana e gaps (5.9) e as sessões mundiais (5.10). Tudo na hora local da
 * simulação (as sessões em UTC), já calculado pelo simulador.
 */
const Run_Hours = ({ run }: Run_Hours_Props) => {
  const { t } = useTranslation();
  const { report, loading } = useSimulationReport(run.id, HOUR_BLOCKS, run.status === 'done');
  const entries = entriesOf(run.strategy);
  const unit = moneyUnit(run.instrument.quote);
  const f = useFactsheetFormat(unit);
  const cards = report?.hourCards;
  const byEntry = report?.hourEntries;
  const stops = report?.hourStops;
  const pnl = report?.hourPnl;
  const table = report?.hourTable;
  const exits = report?.exitHours;
  const exitStops = report?.exitHourStops;
  const exitWins = report?.exitHourWins;
  const exitEntries = report?.exitHourEntries;
  const dayCards = report?.weekdayCards;
  const dayEntries = report?.weekdayEntries;
  const dayStops = report?.weekdayStops;
  const dayPnl = report?.weekdayPnl;
  const dayTable = report?.weekdayTable;
  const dayEntryStops = report?.weekdayEntryStops;
  const dayEntryWins = report?.weekdayEntryWins;
  const dayEntryPnl = report?.weekdayEntryPnl;
  const gridTrades = report?.weekdayHourTrades;
  const gridStops = report?.weekdayHourStops;
  const gridWinRate = report?.weekdayHourWinRate;
  const gridPnl = report?.weekdayHourPnl;
  // 5.5 o calendário, 5.6 cada entrada por hora e 5.7 o tempo em posição
  const calCards = report?.calendarCards;
  const calDaily = report?.calendarDaily;
  const calStops = report?.calendarStopDays;
  const calBest = report?.calendarBestDays;
  const calMonth = report?.calendarMonthDay;
  const calWeeks = report?.calendarWeeks;
  const profiles = report?.entryHourProfiles;
  const hourBlocks = report?.entryHourBlocks;
  const posDuration = report?.positionDuration;
  const posHours = report?.positionHours;
  const moments = report?.sessionMoments;
  const fundingHours = report?.fundingHours;
  const durationDay = report?.durationByWeekday;
  // 5.8 os filtros de horário, 5.9 sessões, fins de semana e gaps e 5.10 sessões mundiais
  const hourFilters = report?.hourFilters;
  const filterWorst = report?.hourFilterWorst;
  const filterBest = report?.hourFilterBest;
  const gapCards = report?.gapCards;
  const gapDaily = report?.gapDaily;
  const passageGroups = report?.passageGroups;
  const sessionRules = report?.sessionRules;
  const worldSessions = report?.worldSessions;
  const workHours = report?.workHours;
  const sessionEdges = report?.sessionEdges;
  // As entradas escondidas nos três gráficos por entrada da 5.3
  const [hiddenEntries, setHiddenEntries] = useState<Set<string>>(() => new Set());
  const setEntryHidden = (id: string, hidden: boolean) =>
    setHiddenEntries((current) => {
      // Sem mudança, o mesmo conjunto (os gráficos avisam também quando se lhes muda de fora)
      if (current.has(id) === hidden) return current;
      const next = new Set(current);
      if (hidden) next.add(id);
      else next.delete(id);
      return next;
    });

  // Os gráficos refazem-se só quando os dados mudam (cada série e rótulo memorizados)
  const entrySeries = useMemo<Hour_Stack_Series[]>(
    () =>
      (byEntry?.entries ?? []).map((entry) => ({
        id: String(entry.rule),
        name: entryLabel(entries, entry.rule, t),
        counts: entry.counts,
        colorToken: `entry-${entryColor(entry.rule)}`,
      })),
    [byEntry, entries, t],
  );
  const exitSeries = useMemo<Hour_Stack_Series[]>(
    () =>
      (exits?.reasons ?? []).map((part) => ({
        id: part.reason,
        name: t(EXIT_HOUR_NAMES.includes(part.reason) ? `trading.fsExitHourReason_${part.reason}` : `trading.exit_${part.reason}`),
        counts: part.counts,
        colorToken: exitColorToken(part.reason),
      })),
    [exits, t],
  );
  const bars = useMemo(() => {
    const count = (value: number) => (value ? f.number(value) : '');
    return {
      stops: {
        values: (stops?.hours ?? []).map(([, trades, value]) => (trades ? value : null)),
        labels: (stops?.hours ?? []).map(([, trades, , pct]) => (trades ? f.percent(pct, 0) : '')),
      },
      pnl: {
        values: (pnl?.hours ?? []).map(([, trades, value]) => (trades ? value : null)),
        labels: (pnl?.hours ?? []).map(([, trades, value]) => (trades ? f.number(Math.abs(value)) : '')),
        // Amostra pequena: menos de `minTrades` trades na hora
        faded: (pnl?.hours ?? []).map(([, trades]) => trades > 0 && trades < (pnl?.minTrades ?? 0)),
      },
      exitStops: {
        values: (exitStops?.hours ?? []).map(([, value]) => value || null),
        labels: (exitStops?.hours ?? []).map(([, value]) => count(value)),
      },
      exitWins: {
        values: (exitWins?.hours ?? []).map(([, value]) => value || null),
        labels: (exitWins?.hours ?? []).map(([, value]) => count(value)),
      },
    };
    // f depende só da língua
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stops, pnl, exitStops, exitWins, f.language]);
  const night = new Set(exitStops?.nightHours ?? []);

  // As cores de cada gráfico de barras, com o nome da legenda
  const legends = useMemo(() => {
    const range = `${hourLabel(0)}–${hourLabel(NIGHT_END)}`;
    const pnlParts: Hour_Bars_Part[] = [
      { id: 'gain', name: t('trading.fsBarsGain'), colorToken: 'chart-strategy' },
      { id: 'loss', name: t('trading.fsBarsLoss'), colorToken: 'chart-drawdown' },
    ];
    return {
      stops: [{ id: 'stops', name: t('trading.fsHourStopsSeries'), colorToken: 'exit-stop' }] as Hour_Bars_Part[],
      pnl: pnlParts,
      exitStops: [
        { id: 'day', name: t('trading.fsHourStopsSeries'), colorToken: 'exit-stop' },
        { id: 'night', name: t('trading.fsBarsNightStops', { range }), colorToken: 'hour-night-stop' },
      ] as Hour_Bars_Part[],
      wins: [{ id: 'wins', name: t('trading.fsExitHourWinsSeries'), colorToken: 'chart-strategy' }] as Hour_Bars_Part[],
      duration: [{ id: 'duration', name: t('trading.fsPositionDurationSeries'), colorToken: 'exit-other' }] as Hour_Bars_Part[],
      positions: [
        { id: 'day', name: t('trading.fsPositionDaySeries'), colorToken: 'exit-signal' },
        { id: 'night', name: t('trading.fsPositionNightSeries', { range }), colorToken: 'exit-time' },
      ] as Hour_Bars_Part[],
      gaps: [
        { id: 'gain', name: t('trading.fsGapUp'), colorToken: 'chart-strategy' },
        { id: 'loss', name: t('trading.fsGapDown'), colorToken: 'chart-drawdown' },
      ] as Hour_Bars_Part[],
    };
  }, [t]);
  const pnlPart = (_: number, value: number) => (value < 0 ? 'loss' : 'gain');

  // 5.3 — os dias (Seg a Dom) e as séries de cada gráfico
  const dayLabels = useMemo(() => WEEKDAYS.map((day) => t(`trading.fsWeekdayShort_${day}`)), [t]);
  const daySeries = useMemo<Hour_Stack_Series[]>(
    () =>
      (dayEntries?.entries ?? []).map((entry) => ({
        id: String(entry.rule),
        name: entryLabel(entries, entry.rule, t),
        counts: entry.counts,
        colorToken: `entry-${entryColor(entry.rule)}`,
      })),
    [dayEntries, entries, t],
  );
  const days = useMemo(() => {
    const count = (value: number) => (value ? f.number(value) : '');
    const counts = (list: { rule: number; counts: number[] }[] | undefined): Group_Bars_Series[] =>
      (list ?? []).map((entry) => ({
        id: String(entry.rule),
        name: entryLabel(entries, entry.rule, t),
        values: entry.counts.map((value) => value || null),
        labels: entry.counts.map(count),
        colorToken: `entry-${entryColor(entry.rule)}`,
      }));
    return {
      stops: [
        {
          id: 'entry',
          name: t('trading.fsWeekdayStopsEntry'),
          values: (dayStops?.days ?? []).map(([, value]) => value),
          labels: (dayStops?.days ?? []).map(([, value]) => f.number(value)),
          colorToken: 'exit-stop',
        },
        {
          id: 'exit',
          name: t('trading.fsWeekdayStopsExit'),
          values: (dayStops?.days ?? []).map(([, , value]) => value),
          labels: (dayStops?.days ?? []).map(([, , value]) => f.number(value)),
          colorToken: 'weekday-exit-stop',
        },
      ] as Group_Bars_Series[],
      pnl: {
        values: (dayPnl?.days ?? []).map(([, trades, value]) => (trades ? value : null)),
        labels: (dayPnl?.days ?? []).map(([, trades, value]) => (trades ? f.number(Math.abs(value)) : '')),
        faded: (dayPnl?.days ?? []).map(([, trades]) => trades > 0 && trades < (dayPnl?.minTrades ?? 0)),
      },
      entryStops: counts(dayEntryStops?.entries),
      entryWins: counts(dayEntryWins?.entries),
      entryPnl: (dayEntryPnl?.entries ?? []).map((entry) => {
        const traded = dayEntries?.entries.find((part) => part.rule === entry.rule)?.counts ?? [];
        return {
          id: String(entry.rule),
          name: entryLabel(entries, entry.rule, t),
          values: entry.pnl.map((value, day) => (traded[day] ? value : null)),
          labels: entry.pnl.map((value, day) => (traded[day] ? `${f.number(value)} ${unit}` : '')),
          colorToken: `entry-${entryColor(entry.rule)}`,
        };
      }),
    };
    // f depende só da língua
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayStops, dayPnl, dayEntries, dayEntryStops, dayEntryWins, dayEntryPnl, entries, t, unit, f.language]);
  const dayName = (day: number) => t(`trading.fsWeekday_${day}`);

  // 5.4 — os quatro quadros dia × hora: o valor e o texto de cada célula com trades
  const grids = useMemo(() => {
    if (!gridTrades || !gridStops || !gridWinRate || !gridPnl) return null;
    const build = (value: (day: number, hour: number) => Day_Hour_Cell | null) =>
      WEEKDAYS.map((day) => Array.from({ length: 24 }, (_, hour) => value(day, hour)));
    return {
      trades: {
        max: Math.max(1, gridTrades.max),
        cells: build((day, hour) => {
          const n = gridTrades.trades[day][hour];
          return n ? { value: n, text: f.number(n) } : null;
        }),
      },
      // Sem stops, a cor de base com "-"
      stops: {
        max: Math.max(1, gridStops.max),
        cells: build((day, hour) => {
          const s = gridStops.stops[day][hour];
          const few = gridStops.trades[day][hour] < (gridTrades.minTrades ?? 0);
          return s == null ? null : { value: s || null, text: s ? f.number(s) : '-', faded: few };
        }),
      },
      // Com poucos trades, a cor de base com "-"
      winRate: {
        cells: build((day, hour) => {
          if (!gridWinRate.trades[day][hour]) return null;
          const rate = gridWinRate.winRatePct[day][hour];
          return { value: rate, text: rate == null ? '-' : f.number(rate, 0) };
        }),
      },
      // A escala do P&L é simétrica à volta do 0, até ao limite que vem do simulador
      pnl: {
        max: Math.max(1, gridPnl.scale ?? 0),
        cells: build((day, hour) => {
          const avg = gridPnl.avgPnl[day][hour];
          const few = gridPnl.trades[day][hour] < (gridPnl.minTrades ?? 0);
          return avg == null ? null : { value: avg, text: f.number(avg, 0), faded: few };
        }),
      },
    };
    // f depende só da língua
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridTrades, gridStops, gridWinRate, gridPnl, f.language]);
  // A nota de um gráfico com a amostra pequena esbatida
  const withFaded = (note: string, min?: number) => (min ? `${note} · ${t('trading.fsSampleFaded', { min })}` : note);
  const cellTitle = (day: number, hour: number) => `<strong>${dayName(day)} · ${hourLabel(hour)}</strong>`;
  // 5.5 o dia de um cartão: a data e os stops e trades fechados nele (sem nenhum, a posição aberta mexeu)
  const dayDetail = (day: { date: string; trades: number; stops: number }) =>
    day.trades
      ? t('trading.fsCalendarDayDetail', { date: dateLabel(day.date), stops: f.number(day.stops), trades: f.number(day.trades) })
      : t('trading.fsCalendarDayOpen', { date: dateLabel(day.date) });
  // O nome do fuso na hora local da 5.7
  const zoneName = (name: string) => (name === LISBON ? t('trading.fsZoneLisbon') : name);

  // 5.5 — o dia do mês e as semanas (o número por cima de cada semana são os stops dela)
  const calendarBars = useMemo(() => {
    if (!calMonth || !calWeeks) return null;
    return {
      monthCategories: calMonth.pnl.map((_, day) => String(day + 1)),
      monthLabels: calMonth.pnl.map(() => ''),
      weekCategories: calWeeks.weeks.map(([start]) => dateLabel(start)),
      weekValues: calWeeks.weeks.map(([, pnl]) => pnl),
      // Com muitas semanas os números atropelam-se: ficam só no tooltip
      weekLabels: calWeeks.weeks.map(([, , stops]) =>
        stops && calWeeks.weeks.length <= WEEK_LABELS_MAX ? f.number(stops) : '',
      ),
    };
    // f depende só da língua
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calMonth, calWeeks, f.language]);

  // 5.9 — a variação da primeira hora de cada dia UTC (subida a azul, descida a laranja)
  const gapBars = useMemo(() => {
    if (!gapDaily) return null;
    return {
      categories: gapDaily.days.map(([date]) => dateLabel(date)),
      values: gapDaily.days.map(([, pct]) => pct),
      labels: gapDaily.days.map(() => ''),
    };
  }, [gapDaily]);

  // 5.7 — a duração por hora de entrada e as posições abertas por hora (a madrugada noutra cor)
  const positionBars = useMemo(() => {
    if (!posDuration || !posHours) return null;
    return {
      durationValues: posDuration.hours.map(([, , avg]) => avg),
      durationLabels: posDuration.hours.map(([, , avg]) => (avg == null ? '' : f.number(avg, 0))),
      openValues: posHours.open,
      openLabels: posHours.open.map((value) => (value == null ? '' : f.number(value, 2))),
      night: new Set(posHours.nightHours),
    };
    // f depende só da língua
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posDuration, posHours, f.language]);
  // O tooltip por entrada de um dia: o valor de cada entrada à vista
  const entryTooltip = (series: Group_Bars_Series[], format: (value: number) => string) => (day: number) =>
    `<strong>${dayName(day)}</strong>` +
    series
      .filter((part) => !hiddenEntries.has(part.id))
      .map((part) => `<br>${part.name}: <strong>${format(part.values[day] ?? 0)}</strong>`)
      .join('');
  const dayZone = dayCards?.timezone ?? LISBON;
  const dayInfo =
    dayZone === LISBON
      ? t('trading.factsheetWeekdaysInfo')
      : dayZone === 'UTC'
        ? t('trading.factsheetWeekdaysInfoUtc')
        : t('trading.factsheetWeekdaysInfoZone', { zone: dayZone });
  const part = (value: { trades: number; winRatePct: number | null; stopsPct: number | null }) =>
    t('trading.fsWeekdayCard_partDetail', {
      trades: f.number(value.trades),
      winRate: f.percent(value.winRatePct, 0),
      stops: f.percent(value.stopsPct, 0),
    });

  const zone = cards?.timezone ?? LISBON;
  const info =
    zone === LISBON
      ? t('trading.factsheetHoursInfo')
      : zone === 'UTC'
        ? t('trading.factsheetHoursInfoUtc')
        : t('trading.factsheetHoursInfoZone', { zone });

  return (
    <div className="Run_Summary">
      {report?.verdicts && (
        <section className="Factsheet_Section">
          <Factsheet_Conclusions findings={report.verdicts.screens.hours} entries={entries} unit={unit} />
        </section>
      )}
      <section className="Factsheet_Section">
        <Factsheet_Heading title={t('trading.factsheetHoursTitle')} info={info} />
        {cards && byEntry && stops && pnl ? (
          <>
            <div className="Factsheet_Cards">
              <Factsheet_Card
                label={t('trading.fsHourCard_busiest')}
                help={t('trading.fsHelp_hourBusiest')}
                explain="hoursBusiest"
                value={cards.busiest ? hourLabel(cards.busiest.hour) : '—'}
                detail={
                  cards.busiest
                    ? t('trading.fsHourCard_busiestDetail', {
                        trades: f.number(cards.busiest.trades),
                        pct: f.percent(cards.busiest.pct, 0),
                      })
                    : t('trading.fsHourCard_none')
                }
              />
              <Factsheet_Card
                label={t('trading.fsHourCard_stopsEntry')}
                help={t('trading.fsHelp_hourStopsEntry')}
                explain="hoursStopsEntry"
                value={cards.mostStopsEntry ? hourLabel(cards.mostStopsEntry.hour) : '—'}
                detail={
                  cards.mostStopsEntry
                    ? t('trading.fsHourCard_stopsEntryDetail', {
                        stops: f.number(cards.mostStopsEntry.stops),
                        trades: f.number(cards.mostStopsEntry.trades),
                      })
                    : t('trading.fsHourCard_noStops')
                }
              />
              <Factsheet_Card
                label={t('trading.fsHourCard_stopsExit')}
                help={t('trading.fsHelp_hourStopsExit')}
                explain="hoursStopsExit"
                value={cards.mostStopsExit ? hourLabel(cards.mostStopsExit.hour) : '—'}
                detail={
                  cards.mostStopsExit
                    ? t('trading.fsHourCard_stopsExitDetail', { stops: f.number(cards.mostStopsExit.stops) })
                    : t('trading.fsHourCard_noStops')
                }
              />
              <Factsheet_Card
                label={t('trading.fsHourCard_best')}
                help={t('trading.fsHelp_hourBest')}
                explain="hoursBest"
                value={cards.best ? hourLabel(cards.best.hour) : '—'}
                detail={
                  cards.best
                    ? t('trading.fsHourCard_bestDetail', { pnl: f.money(cards.best.pnl), winRate: f.percent(cards.best.winRate, 0) })
                    : t('trading.fsHourCard_none')
                }
                tone={cards.best ? f.tone(cards.best.pnl) : ''}
              />
              <Factsheet_Card
                label={t('trading.fsHourCard_worst')}
                help={t('trading.fsHelp_hourWorst')}
                explain="hoursWorst"
                value={cards.worst ? hourLabel(cards.worst.hour) : '—'}
                detail={
                  cards.worst
                    ? t('trading.fsHourCard_worstDetail', { pnl: f.money(cards.worst.pnl), stops: f.percent(cards.worst.stopsPct, 0) })
                    : t('trading.fsHourCard_none')
                }
                tone={cards.worst ? f.tone(cards.worst.pnl) : ''}
              />
              <Factsheet_Card
                label={t('trading.fsHourCard_empty')}
                help={t('trading.fsHelp_hourEmpty')}
                explain="hoursEmpty"
                value={f.number(cards.emptyHours.length)}
                detail={
                  cards.emptyHours.length
                    ? cards.emptyHours.map(hourLabel).join(', ')
                    : t('trading.fsHourCard_emptyNone')
                }
              />
            </div>
            <Factsheet_Hour_Stack
              title={t('trading.fsHourEntriesTitle')}
              explain="hoursEntries"
              note={t('trading.fsHourEntriesNote')}
              series={entrySeries}
            />
            <div className="Factsheet_Grid Two">
              <Factsheet_Hour_Bars
                title={t('trading.fsHourStopsTitle')}
                explain="hoursStopsChart"
                note={t('trading.fsHourStopsNote')}
                parts={legends.stops}
                values={bars.stops.values}
                labels={bars.stops.labels}
                positive
                tooltip={(hour) => {
                  const [, trades, value, pct] = stops.hours[hour];
                  return `<strong>${hourLabel(hour)}</strong><br>${t('trading.fsHourTrades')}: <strong>${f.number(trades)}</strong><br>${t('trading.fsHourStopsSeries')}: <strong>${f.number(value)}</strong> (${f.percent(pct, 0)})`;
                }}
              />
              <Factsheet_Hour_Bars
                title={t('trading.fsHourPnlTitle')}
                explain="hoursPnl"
                note={withFaded(t('trading.fsHourPnlNote', { unit: run.instrument.quote }), pnl.minTrades)}
                parts={legends.pnl}
                values={bars.pnl.values}
                labels={bars.pnl.labels}
                faded={bars.pnl.faded}
                partOf={pnlPart}
                tooltip={(hour) => {
                  const [, trades, value, winRate] = pnl.hours[hour];
                  return `<strong>${hourLabel(hour)}</strong><br>${t('trading.fsHourTrades')}: <strong>${f.number(trades)}</strong><br>${t('trading.fsHourPnlSeries')}: <strong>${f.money(value)}</strong><br>${t('trading.fsHourWinRate')}: <strong>${f.percent(winRate, 0)}</strong>`;
                }}
              />
            </div>
            {table && <Factsheet_Hour_Table table={table} entries={entries} unit={unit} />}
          </>
        ) : (
          <span className="Factsheet_Hint">
            {t(loading ? 'common.loading' : run.status === 'done' ? 'trading.factsheetMissing' : run.status === 'cancelled' ? 'trading.factsheetCancelled' : 'trading.factsheetPending')}
          </span>
        )}
      </section>

      <section className="Factsheet_Section">
        <Factsheet_Heading title={t('trading.factsheetExitHoursTitle')} info={t('trading.factsheetExitHoursInfo')} />
        {exits && exitStops && exitWins && exitEntries ? (
          <>
            <Factsheet_Hour_Stack
              title={t('trading.fsExitHoursTitle')}
              explain="hoursExitReasons"
              note={t('trading.fsExitHoursNote')}
              series={exitSeries}
            />
            <div className="Factsheet_Grid Two">
              <Factsheet_Hour_Bars
                title={t('trading.fsExitHourStopsTitle')}
                explain="hoursExitStops"
                note={t('trading.fsExitHourStopsNote')}
                parts={legends.exitStops}
                values={bars.exitStops.values}
                labels={bars.exitStops.labels}
                // A madrugada noutro tom: picos de stops com pouca liquidez
                partOf={(hour) => (night.has(hour) ? 'night' : 'day')}
                positive
                tooltip={(hour) =>
                  `<strong>${hourLabel(hour)}</strong><br>${t('trading.fsHourStopsSeries')}: <strong>${f.number(exitStops.hours[hour][1])}</strong>`
                }
              />
              <Factsheet_Hour_Bars
                title={t('trading.fsExitHourWinsTitle')}
                explain="hoursExitWins"
                note={t('trading.fsExitHourWinsNote')}
                parts={legends.wins}
                values={bars.exitWins.values}
                labels={bars.exitWins.labels}
                positive
                tooltip={(hour) => {
                  const [, wins, take, trailing, breakEven] = exitWins.hours[hour];
                  return `<strong>${hourLabel(hour)}</strong><br>${t('trading.fsExitHourWinsSeries')}: <strong>${f.number(wins)}</strong><br>${t('trading.fsExitHourReason_take_profit')}: <strong>${f.number(take)}</strong><br>${t('trading.fsExitHourReason_trailing_stop')}: <strong>${f.number(trailing)}</strong><br>${t('trading.fsExitHourReason_break_even')}: <strong>${f.number(breakEven)}</strong>`;
                }}
              />
            </div>
            <Factsheet_Exit_Hour_Table table={exitEntries} entries={entries} />
          </>
        ) : (
          <span className="Factsheet_Hint">
            {t(loading ? 'common.loading' : run.status === 'done' ? 'trading.factsheetMissing' : run.status === 'cancelled' ? 'trading.factsheetCancelled' : 'trading.factsheetPending')}
          </span>
        )}
      </section>

      <section className="Factsheet_Section">
        <Factsheet_Heading title={t('trading.factsheetWeekdaysTitle')} info={dayInfo} />
        {dayCards && dayEntries && dayStops && dayPnl && dayTable && dayEntryStops && dayEntryWins && dayEntryPnl ? (
          <>
            <div className="Factsheet_Cards">
              <Factsheet_Card
                label={t('trading.fsWeekdayCard_busiest')}
                help={t('trading.fsHelp_weekdayBusiest')}
                explain="hoursDayBusiest"
                value={dayCards.busiest ? dayName(dayCards.busiest.day) : '—'}
                detail={
                  dayCards.busiest
                    ? t('trading.fsWeekdayCard_busiestDetail', {
                        trades: f.number(dayCards.busiest.trades),
                        perDay: f.number(dayCards.busiest.perDay, 2),
                      })
                    : t('trading.fsHourCard_none')
                }
              />
              <Factsheet_Card
                label={t('trading.fsWeekdayCard_stops')}
                help={t('trading.fsHelp_weekdayStops')}
                explain="hoursDayStopRate"
                value={dayCards.mostStops ? dayName(dayCards.mostStops.day) : '—'}
                detail={
                  dayCards.mostStops
                    ? t('trading.fsWeekdayCard_stopsDetail', {
                        pct: f.percent(dayCards.mostStops.stopsPct, 0),
                        stops: f.number(dayCards.mostStops.stops),
                      })
                    : t('trading.fsHourCard_noStops')
                }
                tone={dayCards.mostStops ? 'Negative' : ''}
              />
              <Factsheet_Card
                label={t('trading.fsWeekdayCard_best')}
                help={t('trading.fsHelp_weekdayBest')}
                explain="hoursDayBest"
                value={dayCards.best ? dayName(dayCards.best.day) : '—'}
                detail={
                  dayCards.best
                    ? t('trading.fsWeekdayCard_pnlDetail', { pnl: f.money(dayCards.best.pnl), r: f.r(dayCards.best.avgR) })
                    : t('trading.fsHourCard_none')
                }
                tone={dayCards.best ? f.tone(dayCards.best.pnl) : ''}
              />
              <Factsheet_Card
                label={t('trading.fsWeekdayCard_worst')}
                help={t('trading.fsHelp_weekdayWorst')}
                explain="hoursDayWorst"
                value={dayCards.worst ? dayName(dayCards.worst.day) : '—'}
                detail={
                  dayCards.worst
                    ? t('trading.fsWeekdayCard_pnlDetail', { pnl: f.money(dayCards.worst.pnl), r: f.r(dayCards.worst.avgR) })
                    : t('trading.fsHourCard_none')
                }
                tone={dayCards.worst ? f.tone(dayCards.worst.pnl) : ''}
              />
              <Factsheet_Card
                label={t('trading.fsWeekdayCard_week')}
                help={t('trading.fsHelp_weekdayWeek')}
                explain="hoursDayWeek"
                value={dayCards.week.trades ? f.money(dayCards.week.pnl) : '—'}
                detail={dayCards.week.trades ? part(dayCards.week) : t('trading.fsHourCard_none')}
                tone={f.tone(dayCards.week.pnl)}
              />
              <Factsheet_Card
                label={t('trading.fsWeekdayCard_weekend')}
                help={t('trading.fsHelp_weekdayWeekend')}
                explain="hoursDayWeekend"
                value={dayCards.weekend.trades ? f.money(dayCards.weekend.pnl) : '—'}
                detail={dayCards.weekend.trades ? part(dayCards.weekend) : t('trading.fsHourCard_none')}
                tone={f.tone(dayCards.weekend.pnl)}
              />
            </div>
            <Factsheet_Hour_Stack
              title={t('trading.fsWeekdayEntriesTitle')}
              explain="hoursDayEntries"
              note={t('trading.fsWeekdayEntriesNote')}
              series={daySeries}
              categories={dayLabels}
              size="Weekday"
            />
            <Factsheet_Group_Bars
              title={t('trading.fsWeekdayStopsTitle')}
              explain="hoursDayStopsChart"
              note={t('trading.fsWeekdayStopsNote')}
              categories={dayLabels}
              series={days.stops}
              positive
              tooltip={(day) => {
                const [, opened, hit] = dayStops.days[day];
                return `<strong>${dayName(day)}</strong><br>${t('trading.fsWeekdayStopsEntry')}: <strong>${f.number(opened)}</strong><br>${t('trading.fsWeekdayStopsExit')}: <strong>${f.number(hit)}</strong>`;
              }}
            />
            <Factsheet_Hour_Bars
              title={t('trading.fsWeekdayPnlTitle')}
              explain="hoursDayPnl"
              note={withFaded(t('trading.fsWeekdayPnlNote', { unit: run.instrument.quote }), dayPnl.minTrades)}
              parts={legends.pnl}
              values={days.pnl.values}
              labels={days.pnl.labels}
              faded={days.pnl.faded}
              categories={dayLabels}
              size="Weekday"
              partOf={pnlPart}
              tooltip={(day) => {
                const [, trades, value, winRate, avgR] = dayPnl.days[day];
                return `<strong>${dayName(day)}</strong><br>${t('trading.fsHourTrades')}: <strong>${f.number(trades)}</strong><br>${t('trading.fsHourPnlSeries')}: <strong>${f.money(value)}</strong><br>${t('trading.fsHourWinRate')}: <strong>${f.percent(winRate, 0)}</strong><br>${t('trading.fsHourCol_avgR')}: <strong>${f.r(avgR)}</strong>`;
              }}
            />
            <Factsheet_Weekday_Table table={dayTable} entries={entries} unit={unit} />
            <Factsheet_Panel title={t('trading.fsWeekdayByEntryTitle')} explain="hoursDayLegend" note={t('trading.fsWeekdayByEntryNote')}>
              <div className="Factsheet_Weekday_Legend">
                {dayEntryStops.entries.map((entry) => {
                  const id = String(entry.rule);
                  return (
                    <button
                      key={id}
                      type="button"
                      className={hiddenEntries.has(id) ? 'Hidden' : ''}
                      aria-pressed={!hiddenEntries.has(id)}
                      onClick={() => setEntryHidden(id, !hiddenEntries.has(id))}
                    >
                      <Factsheet_Entry_Name entries={entries} rule={entry.rule} />
                    </button>
                  );
                })}
              </div>
            </Factsheet_Panel>
            <Factsheet_Group_Bars
              title={t('trading.fsWeekdayEntryStopsTitle')}
              explain="hoursDayEntryStops"
              note={t('trading.fsWeekdayEntryStopsNote')}
              categories={dayLabels}
              series={days.entryStops}
              hidden={hiddenEntries}
              onToggle={setEntryHidden}
              positive
              tooltip={entryTooltip(days.entryStops, (value) => f.number(value))}
            />
            <Factsheet_Group_Bars
              title={t('trading.fsWeekdayEntryWinsTitle')}
              explain="hoursDayEntryWins"
              note={t('trading.fsWeekdayEntryWinsNote')}
              categories={dayLabels}
              series={days.entryWins}
              hidden={hiddenEntries}
              onToggle={setEntryHidden}
              positive
              tooltip={entryTooltip(days.entryWins, (value) => f.number(value))}
            />
            <Factsheet_Group_Bars
              title={t('trading.fsWeekdayEntryPnlTitle')}
              explain="hoursDayEntryPnl"
              note={t('trading.fsWeekdayEntryPnlNote', { unit: run.instrument.quote })}
              categories={dayLabels}
              series={days.entryPnl}
              hidden={hiddenEntries}
              onToggle={setEntryHidden}
              tooltip={entryTooltip(days.entryPnl, (value) => f.money(value))}
            />
          </>
        ) : (
          <span className="Factsheet_Hint">
            {t(loading ? 'common.loading' : run.status === 'done' ? 'trading.factsheetMissing' : run.status === 'cancelled' ? 'trading.factsheetCancelled' : 'trading.factsheetPending')}
          </span>
        )}
      </section>

      <section className="Factsheet_Section">
        <Factsheet_Heading title={t('trading.factsheetDayHourTitle')} info={t('trading.factsheetDayHourInfo')} />
        {grids ? (
          <>
            <Factsheet_Day_Hour_Grid
              title={t('trading.fsDayHourTradesTitle')}
              explain="hoursGridTrades"
              note={t('trading.fsDayHourTradesNote')}
              cells={grids.trades.cells}
              min={0}
              max={grids.trades.max}
              colors={GRID_COUNT_COLORS}
              format={(value) => f.number(value, 0)}
              tooltip={(day, hour) => {
                const n = gridTrades?.trades[day][hour] ?? 0;
                return `${cellTitle(day, hour)}<br>${t('trading.fsDayHourTrades')}: <strong>${f.number(n)}</strong>`;
              }}
            />
            <Factsheet_Day_Hour_Grid
              title={t('trading.fsDayHourStopsTitle')}
              explain="hoursGridStops"
              note={withFaded(t('trading.fsDayHourStopsNote'), gridTrades?.minTrades)}
              cells={grids.stops.cells}
              min={0}
              max={grids.stops.max}
              colors={GRID_STOP_COLORS}
              format={(value) => f.number(value, 0)}
              tooltip={(day, hour) => {
                const n = gridStops?.trades[day][hour] ?? 0;
                const s = gridStops?.stops[day][hour] ?? 0;
                return `${cellTitle(day, hour)}<br>${t('trading.fsDayHourTrades')}: <strong>${f.number(n)}</strong><br>${t('trading.fsDayHourStops')}: <strong>${f.number(s)}</strong> (${f.percent(n ? (s / n) * 100 : null, 0)})`;
              }}
            />
            <Factsheet_Day_Hour_Grid
              title={t('trading.fsDayHourWinRateTitle')}
              explain="hoursGridWinRate"
              note={t('trading.fsDayHourWinRateNote', { min: gridWinRate?.minTrades ?? 3 })}
              cells={grids.winRate.cells}
              min={0}
              max={100}
              colors={GRID_SPLIT_COLORS}
              format={(value) => f.percent(value, 0)}
              tooltip={(day, hour) => {
                const n = gridWinRate?.trades[day][hour] ?? 0;
                const rate = gridWinRate?.winRatePct[day][hour] ?? null;
                const head = `${cellTitle(day, hour)}<br>${t('trading.fsDayHourTrades')}: <strong>${f.number(n)}</strong>`;
                if (rate == null) return `${head}<br>${t('trading.fsDayHourFew', { min: gridWinRate?.minTrades ?? 3 })}`;
                return `${head}<br>${t('trading.fsDayHourWins')}: <strong>${f.number(gridWinRate?.wins[day][hour] ?? 0)}</strong><br>${t('trading.fsDayHourWinRate')}: <strong>${f.percent(rate, 0)}</strong>`;
              }}
            />
            <Factsheet_Day_Hour_Grid
              title={t('trading.fsDayHourPnlTitle')}
              explain="hoursGridPnl"
              note={withFaded(t('trading.fsDayHourPnlNote', { unit: run.instrument.quote }), gridPnl?.minTrades)}
              cells={grids.pnl.cells}
              min={-grids.pnl.max}
              max={grids.pnl.max}
              colors={GRID_SPLIT_COLORS}
              format={(value) => f.money(value, 0)}
              tooltip={(day, hour) => {
                const n = gridPnl?.trades[day][hour] ?? 0;
                return `${cellTitle(day, hour)}<br>${t('trading.fsDayHourTrades')}: <strong>${f.number(n)}</strong><br>${t('trading.fsDayHourAvgPnl')}: <strong>${f.money(gridPnl?.avgPnl[day][hour] ?? 0, 2)}</strong><br>${t('trading.fsDayHourPnl')}: <strong>${f.money(gridPnl?.pnl[day][hour] ?? 0)}</strong>`;
              }}
            />
          </>
        ) : (
          <span className="Factsheet_Hint">
            {t(loading ? 'common.loading' : run.status === 'done' ? 'trading.factsheetMissing' : run.status === 'cancelled' ? 'trading.factsheetCancelled' : 'trading.factsheetPending')}
          </span>
        )}
      </section>

      <section className="Factsheet_Section">
        <Factsheet_Heading title={t('trading.factsheetCalendarTitle')} info={t('trading.factsheetCalendarInfo')} />
        {calCards && calDaily && calStops && calBest && calMonth && calWeeks && calendarBars ? (
          <>
            <div className="Factsheet_Cards">
              <Factsheet_Card
                label={t('trading.fsCalendarCard_tradeDays')}
                help={t('trading.fsHelp_calendarTradeDays')}
                explain="hoursCalTradeDays"
                value={t('trading.fsCalendarCard_tradeDaysValue', { days: f.number(calCards.tradeDays), total: f.number(calCards.days) })}
                detail={t('trading.fsCalendarCard_tradeDaysDetail', { pct: f.percent(calCards.tradeDaysPct, 0) })}
              />
              <Factsheet_Card
                label={t('trading.fsCalendarCard_split')}
                help={t('trading.fsHelp_calendarSplit')}
                explain="hoursCalSplit"
                value={`${f.number(calCards.positiveDays)} / ${f.number(calCards.negativeDays)}`}
                detail={t('trading.fsCalendarCard_splitDetail', { pct: f.percent(calCards.positivePct, 0) })}
              />
              <Factsheet_Card
                label={t('trading.fsCalendarCard_best')}
                help={t('trading.fsHelp_calendarBest')}
                explain="hoursCalBest"
                value={calCards.best ? f.money(calCards.best.pnl) : '—'}
                tone={calCards.best ? 'Positive' : ''}
                detail={calCards.best ? dayDetail(calCards.best) : t('trading.fsCalendarNoGains')}
              />
              <Factsheet_Card
                label={t('trading.fsCalendarCard_worst')}
                help={t('trading.fsHelp_calendarWorst')}
                explain="hoursCalWorst"
                value={calCards.worst ? f.money(calCards.worst.pnl) : '—'}
                tone={calCards.worst ? 'Negative' : ''}
                detail={calCards.worst ? dayDetail(calCards.worst) : t('trading.fsCalendarNoLosses')}
              />
              <Factsheet_Card
                label={t('trading.fsCalendarCard_winStreak')}
                help={t('trading.fsHelp_calendarWinStreak')}
                explain="hoursCalWinStreak"
                value={t('trading.fsCalendarDays', { count: calCards.winStreak })}
                tone={calCards.winStreak ? 'Positive' : ''}
                detail={t('trading.fsCalendarCard_winStreakDetail')}
              />
              <Factsheet_Card
                label={t('trading.fsCalendarCard_lossStreak')}
                help={t('trading.fsHelp_calendarLossStreak')}
                explain="hoursCalLossStreak"
                value={t('trading.fsCalendarDays', { count: calCards.lossStreak })}
                tone={calCards.lossStreak ? 'Negative' : ''}
                detail={t('trading.fsCalendarCard_lossStreakDetail', { days: f.number(calCards.stopDays) })}
              />
            </div>
            <Factsheet_Calendar daily={calDaily} unit={unit} />
            <div className="Factsheet_Grid Two">
              <Factsheet_Calendar_Days kind="stops" table={calStops} entries={entries} unit={unit} />
              <Factsheet_Calendar_Days kind="best" table={calBest} entries={entries} unit={unit} />
            </div>
            <div className="Factsheet_Grid Two">
              <Factsheet_Hour_Bars
                title={t('trading.fsMonthDayTitle')}
                explain="hoursMonthDay"
                note={t('trading.fsMonthDayNote')}
                parts={legends.pnl}
                values={calMonth.pnl}
                labels={calendarBars.monthLabels}
                categories={calendarBars.monthCategories}
                partOf={pnlPart}
                tooltip={(index) =>
                  `<strong>${t('trading.fsMonthDayTooltip', { day: index + 1 })}</strong><br>${t('trading.fsHourCol_pnl')}: <strong>${f.money(calMonth.pnl[index])}</strong>`
                }
                footer={
                  <>
                    <span>{t('trading.fsMonthDayFirst', { pnl: f.money(calMonth.first5) })}</span>
                    <span>{t('trading.fsMonthDayLast', { pnl: f.money(calMonth.last5) })}</span>
                  </>
                }
              />
              <Factsheet_Hour_Bars
                title={t('trading.fsWeeksTitle')}
                explain="hoursWeeks"
                note={t('trading.fsWeeksNote')}
                parts={legends.pnl}
                values={calendarBars.weekValues}
                labels={calendarBars.weekLabels}
                categories={calendarBars.weekCategories}
                partOf={pnlPart}
                axis={false}
                tooltip={(index) => {
                  const [start, pnl, stops] = calWeeks.weeks[index];
                  return `<strong>${t('trading.fsWeeksTooltip', { date: dateLabel(start) })}</strong><br>${t('trading.fsHourCol_pnl')}: <strong>${f.money(pnl)}</strong><br>${t('trading.fsHourCol_stops')}: <strong>${f.number(stops)}</strong>`;
                }}
                footer={
                  <>
                    <span>{calWeeks.first ? dateLabel(calWeeks.first) : ''}</span>
                    <span>{t('trading.fsWeeksPositive', { positive: f.number(calWeeks.positive), total: f.number(calWeeks.weeks.length) })}</span>
                    <span>{calWeeks.last ? dateLabel(calWeeks.last) : ''}</span>
                  </>
                }
              />
            </div>
          </>
        ) : (
          <span className="Factsheet_Hint">
            {t(loading ? 'common.loading' : run.status === 'done' ? 'trading.factsheetMissing' : run.status === 'cancelled' ? 'trading.factsheetCancelled' : 'trading.factsheetPending')}
          </span>
        )}
      </section>

      <section className="Factsheet_Section">
        <Factsheet_Heading
          title={t('trading.factsheetEntryHoursTitle')}
          tag={t('trading.factsheetEntryHoursTag')}
          info={t('trading.factsheetEntryHoursInfo')}
        />
        {profiles && hourBlocks ? (
          <>
            <div className="Factsheet_Grid Two">
              {profiles.entries.map((profile) => (
                <Factsheet_Entry_Hours key={profile.rule} profile={profile} entries={entries} unit={unit} />
              ))}
            </div>
            <Factsheet_Entry_Blocks table={hourBlocks} entries={entries} unit={unit} />
          </>
        ) : (
          <span className="Factsheet_Hint">
            {t(loading ? 'common.loading' : run.status === 'done' ? 'trading.factsheetMissing' : run.status === 'cancelled' ? 'trading.factsheetCancelled' : 'trading.factsheetPending')}
          </span>
        )}
      </section>

      <section className="Factsheet_Section">
        <Factsheet_Heading title={t('trading.factsheetPositionTitle')} info={t('trading.factsheetPositionInfo')} />
        {posDuration && posHours && moments && fundingHours && durationDay && positionBars ? (
          <>
            <div className="Factsheet_Grid Two">
              <Factsheet_Hour_Bars
                title={t('trading.fsPositionDurationTitle')}
                explain="hoursPosDuration"
                note={t('trading.fsPositionDurationNote', { timeframe: t(`trading.tf_${run.timeframe}`) })}
                parts={legends.duration}
                values={positionBars.durationValues}
                labels={positionBars.durationLabels}
                positive
                tooltip={(hour) => {
                  const [, trades, avg] = posDuration.hours[hour];
                  return `<strong>${hourLabel(hour)}</strong><br>${t('trading.fsHourCol_trades')}: <strong>${f.number(trades)}</strong><br>${t('trading.fsPositionDurationSeries')}: <strong>${f.number(avg, 1)}</strong>`;
                }}
              />
              <Factsheet_Hour_Bars
                title={t('trading.fsPositionHoursTitle')}
                explain="hoursPosOpen"
                note={t('trading.fsPositionHoursNote')}
                parts={legends.positions}
                values={positionBars.openValues}
                labels={positionBars.openLabels}
                partOf={(hour) => (positionBars.night.has(hour) ? 'night' : 'day')}
                positive
                tooltip={(hour) =>
                  `<strong>${hourLabel(hour)}</strong><br>${t('trading.fsPositionHoursValue')}: <strong>${f.number(posHours.open[hour], 2)}</strong>`
                }
              />
            </div>
            {/* As tabelas a toda a largura, uma por baixo da outra */}
            <Factsheet_Session_Moments moments={moments} funding={fundingHours} unit={unit} zoneName={zoneName(moments.timezone)} />
            <Factsheet_Duration_Weekday table={durationDay} />
          </>
        ) : (
          <span className="Factsheet_Hint">
            {t(loading ? 'common.loading' : run.status === 'done' ? 'trading.factsheetMissing' : run.status === 'cancelled' ? 'trading.factsheetCancelled' : 'trading.factsheetPending')}
          </span>
        )}
      </section>

      <section className="Factsheet_Section">
        <Factsheet_Heading
          title={t('trading.factsheetFiltersTitle')}
          tag={t('trading.factsheetFiltersTag')}
          info={t('trading.factsheetFiltersInfo')}
        />
        {hourFilters && filterWorst && filterBest ? (
          <>
            <Factsheet_Hour_Filters table={hourFilters} />
            <div className="Factsheet_Grid Two">
              <Factsheet_Hour_Sample kind="worst" table={filterWorst} unit={unit} />
              <Factsheet_Hour_Sample kind="best" table={filterBest} unit={unit} />
            </div>
          </>
        ) : (
          <span className="Factsheet_Hint">
            {t(loading ? 'common.loading' : run.status === 'done' ? 'trading.factsheetMissing' : run.status === 'cancelled' ? 'trading.factsheetCancelled' : 'trading.factsheetPending')}
          </span>
        )}
      </section>

      <section className="Factsheet_Section">
        <Factsheet_Heading title={t('trading.factsheetGapsTitle')} tag={t('trading.factsheetGapsTag')} info={t('trading.factsheetGapsInfo')} />
        {gapCards && gapDaily && passageGroups && sessionRules && gapBars ? (
          <>
            <div className="Factsheet_Cards">
              <Factsheet_Card
                label={t('trading.fsGapCard_days')}
                help={t('trading.fsHelp_gapDays')}
                explain="hoursGapDays"
                value={f.number(gapCards.days)}
                detail={t('trading.fsGapCard_daysDetail', { mondays: f.number(gapCards.mondays) })}
              />
              <Factsheet_Card
                label={t('trading.fsGapCard_mean')}
                help={t('trading.fsHelp_gapMean')}
                explain="hoursGapMean"
                value={f.percent(gapCards.meanAbsPct, 2)}
                detail={t('trading.fsGapCard_meanDetail')}
              />
              <Factsheet_Card
                label={t('trading.fsGapCard_biggest')}
                help={t('trading.fsHelp_gapBiggest')}
                explain="hoursGapBiggest"
                value={gapCards.biggest ? f.signedPercent(gapCards.biggest.pct, 2) : '—'}
                tone={gapCards.biggest ? f.tone(gapCards.biggest.pct) : ''}
                detail={gapCards.biggest ? t('trading.fsGapCard_biggestDetail', { date: dateLabel(gapCards.biggest.date) }) : '—'}
              />
              <Factsheet_Card
                label={t('trading.fsGapCard_crossing')}
                help={t('trading.fsHelp_gapCrossing')}
                explain="hoursGapCrossing"
                value={f.number(gapCards.crossing)}
                detail={t('trading.fsGapCard_crossingDetail', { pct: f.percent(gapCards.crossingPct, 0), weekend: f.number(gapCards.weekend) })}
              />
              <Factsheet_Card
                label={t('trading.fsGapCard_stops')}
                help={t('trading.fsHelp_gapStops')}
                explain="hoursGapStops"
                value={f.number(gapCards.gapStops)}
                tone={gapCards.gapStops ? 'Negative' : ''}
                detail={t('trading.fsGapCard_stopsDetail')}
              />
              <Factsheet_Card
                label={t('trading.fsGapCard_cost')}
                help={t('trading.fsHelp_gapCost')}
                explain="hoursGapCost"
                value={f.money(gapCards.gapCost ? -gapCards.gapCost : 0)}
                tone={gapCards.gapCost > 0 ? 'Negative' : ''}
                detail={t('trading.fsGapCard_costDetail')}
              />
            </div>
            <div className="Factsheet_Grid Two">
              <Factsheet_Hour_Bars
                title={t('trading.fsGapChartTitle')}
                explain="hoursGapDaily"
                note={t('trading.fsGapChartNote')}
                parts={legends.gaps}
                values={gapBars.values}
                labels={gapBars.labels}
                categories={gapBars.categories}
                partOf={pnlPart}
                axis={false}
                size="Gap_Daily"
                tooltip={(index) =>
                  `<strong>${gapBars.categories[index]} · 00h UTC</strong><br>${t('trading.fsGapTooltip')}: <strong>${f.signedPercent(gapBars.values[index], 2)}</strong>`
                }
                footer={
                  <>
                    <span>{f.signedPercent(gapDaily.maxAbsPct == null ? null : -gapDaily.maxAbsPct, 2)}</span>
                    <span>
                      {t('trading.fsGapChartFooter', {
                        days: f.number(gapDaily.days.length),
                        mean: f.percent(gapDaily.meanAbsPct, 2),
                        monday: f.percent(gapDaily.mondayMeanAbsPct, 2),
                      })}
                    </span>
                    <span>{f.signedPercent(gapDaily.maxAbsPct, 2)}</span>
                  </>
                }
              />
              <Factsheet_Passage groups={passageGroups} rules={sessionRules} unit={unit} />
            </div>
          </>
        ) : (
          <span className="Factsheet_Hint">
            {t(loading ? 'common.loading' : run.status === 'done' ? 'trading.factsheetMissing' : run.status === 'cancelled' ? 'trading.factsheetCancelled' : 'trading.factsheetPending')}
          </span>
        )}
      </section>

      <section className="Factsheet_Section">
        <Factsheet_Heading title={t('trading.factsheetWorldTitle')} info={t('trading.factsheetWorldInfo')} />
        {worldSessions && workHours && sessionEdges ? (
          <>
            <div className="Factsheet_Grid Two">
              <Factsheet_World_Sessions table={worldSessions} unit={unit} />
              <Factsheet_Work_Hours table={workHours} unit={unit} zoneName={zoneName(workHours.timezone)} />
            </div>
            <Factsheet_Session_Edges table={sessionEdges} unit={unit} />
          </>
        ) : (
          <span className="Factsheet_Hint">
            {t(loading ? 'common.loading' : run.status === 'done' ? 'trading.factsheetMissing' : run.status === 'cancelled' ? 'trading.factsheetCancelled' : 'trading.factsheetPending')}
          </span>
        )}
      </section>
    </div>

  );
};

export default Run_Hours;
