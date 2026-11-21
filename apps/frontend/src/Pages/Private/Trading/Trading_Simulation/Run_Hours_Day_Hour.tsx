import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Factsheet_Day_Hour_Grid from './Factsheet_Day_Hour_Grid';
import type { Day_Hour_Cell } from './Factsheet_Day_Hour_Grid';
import Factsheet_Heading from './Factsheet_Heading';
import Run_Hours_Pending from './Run_Hours_Pending';
import { hourLabel } from './factsheetFormat';
import { WEEKDAYS, fadedNote, weekdayName, type Hours_Section_Props } from './runHours';

// As cores dos quadros da 5.4 (tokens; `null` = a cor de base): as contagens do
// vazio à cor, o win rate e o P&L de laranja a azul, com a base no meio
const GRID_COUNT_COLORS = [null, 'cell-positive'];
const GRID_STOP_COLORS = [null, 'exit-stop'];
const GRID_SPLIT_COLORS = ['cell-negative', null, 'cell-positive'];

// 5.4 — Dia da semana × hora: quatro mapas de calor com o mesmo quadriculado
const Run_Hours_Day_Hour = ({ run, report, loading, f }: Hours_Section_Props) => {
  const { t } = useTranslation();
  const gridTrades = report?.weekdayHourTrades;
  const gridStops = report?.weekdayHourStops;
  const gridWinRate = report?.weekdayHourWinRate;
  const gridPnl = report?.weekdayHourPnl;
  const withFaded = (note: string, min?: number) => fadedNote(t, note, min);
  const dayName = (day: number) => weekdayName(t, day);

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
  const cellTitle = (day: number, hour: number) => `<strong>${dayName(day)} · ${hourLabel(hour)}</strong>`;

  return (
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
        <Run_Hours_Pending loading={loading} status={run.status} />
      )}
    </section>
  );
};

export default Run_Hours_Day_Hour;
