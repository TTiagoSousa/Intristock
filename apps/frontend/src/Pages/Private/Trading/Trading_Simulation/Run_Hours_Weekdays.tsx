import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { entryLabel } from '../Trading_Simulator/labels';
import Factsheet_Card from './Factsheet_Card';
import Factsheet_Entry_Name from './Factsheet_Entry_Name';
import Factsheet_Group_Bars from './Factsheet_Group_Bars';
import type { Group_Bars_Series } from './Factsheet_Group_Bars';
import Factsheet_Heading from './Factsheet_Heading';
import Factsheet_Hour_Bars from './Factsheet_Hour_Bars';
import Factsheet_Hour_Stack from './Factsheet_Hour_Stack';
import type { Hour_Stack_Series } from './Factsheet_Hour_Stack';
import Factsheet_Panel from './Factsheet_Panel';
import Factsheet_Weekday_Table from './Factsheet_Weekday_Table';
import Run_Hours_Pending from './Run_Hours_Pending';
import { entryColor } from './factsheetFormat';
import { LISBON, WEEKDAYS, fadedNote, pnlPart, useHourLegends, type Hours_Section_Props } from './runHours';

// 5.3 — Dias da semana, tudo em coluna: os 6 cartões, as entradas por dia, os stops pela entrada e
// pela saída, o P&L, a tabela e, com uma legenda partilhada, os stops, ganhos e P&L de cada entrada
// por dia
const Run_Hours_Weekdays = ({ run, report, loading, entries, unit, f }: Hours_Section_Props) => {
  const { t } = useTranslation();
  const legends = useHourLegends(t);
  const dayCards = report?.weekdayCards;
  const dayEntries = report?.weekdayEntries;
  const dayStops = report?.weekdayStops;
  const dayPnl = report?.weekdayPnl;
  const dayTable = report?.weekdayTable;
  const dayEntryStops = report?.weekdayEntryStops;
  const dayEntryWins = report?.weekdayEntryWins;
  const dayEntryPnl = report?.weekdayEntryPnl;
  const withFaded = (note: string, min?: number) => fadedNote(t, note, min);
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

  return (
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
        <Run_Hours_Pending loading={loading} status={run.status} />
      )}
    </section>
  );
};

export default Run_Hours_Weekdays;
