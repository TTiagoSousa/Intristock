import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Factsheet_Calendar from './Factsheet_Calendar';
import Factsheet_Calendar_Days from './Factsheet_Calendar_Days';
import Factsheet_Card from './Factsheet_Card';
import Factsheet_Heading from './Factsheet_Heading';
import Factsheet_Hour_Bars from './Factsheet_Hour_Bars';
import Run_Hours_Pending from './Run_Hours_Pending';
import { dateLabel, pnlPart, useHourLegends, type Hours_Section_Props } from './runHours';

// 5.5: até quantas semanas o nº de stops vai por cima de cada uma
const WEEK_LABELS_MAX = 80;

// 5.5 — O calendário: os 6 cartões, cada dia, os dias com mais stops e os melhores, o dia do mês e
// as semanas
const Run_Hours_Calendar = ({ run, report, loading, entries, unit, f }: Hours_Section_Props) => {
  const { t } = useTranslation();
  const legends = useHourLegends(t);
  const calCards = report?.calendarCards;
  const calDaily = report?.calendarDaily;
  const calStops = report?.calendarStopDays;
  const calBest = report?.calendarBestDays;
  const calMonth = report?.calendarMonthDay;
  const calWeeks = report?.calendarWeeks;
  // 5.5 o dia de um cartão: a data e os stops e trades fechados nele (sem nenhum, a posição aberta mexeu)
  const dayDetail = (day: { date: string; trades: number; stops: number }) =>
    day.trades
      ? t('trading.fsCalendarDayDetail', { date: dateLabel(day.date), stops: f.number(day.stops), trades: f.number(day.trades) })
      : t('trading.fsCalendarDayOpen', { date: dateLabel(day.date) });

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

  return (
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
        <Run_Hours_Pending loading={loading} status={run.status} />
      )}
    </section>
  );
};

export default Run_Hours_Calendar;
