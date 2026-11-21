import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Factsheet_Duration_Weekday from './Factsheet_Duration_Weekday';
import Factsheet_Heading from './Factsheet_Heading';
import Factsheet_Hour_Bars from './Factsheet_Hour_Bars';
import Factsheet_Session_Moments from './Factsheet_Session_Moments';
import Run_Hours_Pending from './Run_Hours_Pending';
import { hourLabel } from './factsheetFormat';
import { useHourLegends, zoneLabel, type Hours_Section_Props } from './runHours';

// 5.7 — O tempo em posição: a duração e as posições abertas por hora, os momentos das sessões e o
// funding, e a duração por dia
const Run_Hours_Position = ({ run, report, loading, unit, f }: Hours_Section_Props) => {
  const { t } = useTranslation();
  const legends = useHourLegends(t);
  const posDuration = report?.positionDuration;
  const posHours = report?.positionHours;
  const moments = report?.sessionMoments;
  const fundingHours = report?.fundingHours;
  const durationDay = report?.durationByWeekday;
  const zoneName = (name: string) => zoneLabel(t, name);

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

  return (
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
        <Run_Hours_Pending loading={loading} status={run.status} />
      )}
    </section>
  );
};

export default Run_Hours_Position;
