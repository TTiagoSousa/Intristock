import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Factsheet_Card from './Factsheet_Card';
import Factsheet_Heading from './Factsheet_Heading';
import Factsheet_Hour_Bars from './Factsheet_Hour_Bars';
import Factsheet_Passage from './Factsheet_Passage';
import Run_Hours_Pending from './Run_Hours_Pending';
import { dateLabel, pnlPart, useHourLegends, type Hours_Section_Props } from './runHours';

// 5.9 — Sessões, fins de semana e gaps (em UTC)
const Run_Hours_Gaps = ({ run, report, loading, unit, f }: Hours_Section_Props) => {
  const { t } = useTranslation();
  const legends = useHourLegends(t);
  const gapCards = report?.gapCards;
  const gapDaily = report?.gapDaily;
  const passageGroups = report?.passageGroups;
  const sessionRules = report?.sessionRules;

  // 5.9 — a variação da primeira hora de cada dia UTC (subida a azul, descida a laranja)
  const gapBars = useMemo(() => {
    if (!gapDaily) return null;
    return {
      categories: gapDaily.days.map(([date]) => dateLabel(date)),
      values: gapDaily.days.map(([, pct]) => pct),
      labels: gapDaily.days.map(() => ''),
    };
  }, [gapDaily]);

  return (
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
        <Run_Hours_Pending loading={loading} status={run.status} />
      )}
    </section>
  );
};

export default Run_Hours_Gaps;
