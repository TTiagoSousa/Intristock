import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { entryLabel } from '../Trading_Simulator/labels';
import Factsheet_Card from './Factsheet_Card';
import Factsheet_Heading from './Factsheet_Heading';
import Factsheet_Hour_Bars from './Factsheet_Hour_Bars';
import Factsheet_Hour_Stack from './Factsheet_Hour_Stack';
import type { Hour_Stack_Series } from './Factsheet_Hour_Stack';
import Factsheet_Hour_Table from './Factsheet_Hour_Table';
import Run_Hours_Pending from './Run_Hours_Pending';
import { entryColor, hourLabel } from './factsheetFormat';
import { LISBON, fadedNote, pnlPart, useHourLegends, type Hours_Section_Props } from './runHours';

// 5.1 — Horas de entrada: os 6 cartões, os trades de cada hora por entrada, os stops e o P&L por
// hora e a tabela
const Run_Hours_Entry = ({ run, report, loading, entries, unit, f }: Hours_Section_Props) => {
  const { t } = useTranslation();
  const legends = useHourLegends(t);
  const cards = report?.hourCards;
  const byEntry = report?.hourEntries;
  const stops = report?.hourStops;
  const pnl = report?.hourPnl;
  const table = report?.hourTable;
  const withFaded = (note: string, min?: number) => fadedNote(t, note, min);

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
  const bars = useMemo(() => {
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
    };
    // f depende só da língua
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stops, pnl, f.language]);

  const zone = cards?.timezone ?? LISBON;
  const info =
    zone === LISBON
      ? t('trading.factsheetHoursInfo')
      : zone === 'UTC'
        ? t('trading.factsheetHoursInfoUtc')
        : t('trading.factsheetHoursInfoZone', { zone });

  return (
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
        <Run_Hours_Pending loading={loading} status={run.status} />
      )}
    </section>
  );
};

export default Run_Hours_Entry;
