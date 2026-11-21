import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Factsheet_Exit_Hour_Table from './Factsheet_Exit_Hour_Table';
import Factsheet_Heading from './Factsheet_Heading';
import Factsheet_Hour_Bars from './Factsheet_Hour_Bars';
import Factsheet_Hour_Stack from './Factsheet_Hour_Stack';
import type { Hour_Stack_Series } from './Factsheet_Hour_Stack';
import Run_Hours_Pending from './Run_Hours_Pending';
import { exitColorToken, hourLabel } from './factsheetFormat';
import { useHourLegends, type Hours_Section_Props } from './runHours';

// Os motivos de saída com o nome do estudo (os outros usam o da lista de trades)
const EXIT_HOUR_NAMES = ['stop_loss', 'trailing_stop', 'break_even', 'take_profit', 'signal', 'time'];

// 5.2 — Horas de saída: as saídas de cada hora por motivo, os stops e as saídas a ganhar por hora
// de saída e a tabela entrada → hora de saída
const Run_Hours_Exit = ({ run, report, loading, entries, f }: Hours_Section_Props) => {
  const { t } = useTranslation();
  const legends = useHourLegends(t);
  const exits = report?.exitHours;
  const exitStops = report?.exitHourStops;
  const exitWins = report?.exitHourWins;
  const exitEntries = report?.exitHourEntries;

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
  }, [exitStops, exitWins, f.language]);
  const night = new Set(exitStops?.nightHours ?? []);

  return (
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
        <Run_Hours_Pending loading={loading} status={run.status} />
      )}
    </section>
  );
};

export default Run_Hours_Exit;
