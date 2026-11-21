import { useSimulationReport } from '../../../../Hooks/Trading/useSimulation';
import type { Report_Block, Simulation_Run } from '../../../../Hooks/Trading/useSimulation';
import { entriesOf } from '../Trading_Simulator/simulationForm';
import { Factsheet_Conclusions } from './Factsheet_Verdict';
import Run_Hours_Calendar from './Run_Hours_Calendar';
import Run_Hours_Day_Hour from './Run_Hours_Day_Hour';
import Run_Hours_Entries from './Run_Hours_Entries';
import Run_Hours_Entry from './Run_Hours_Entry';
import Run_Hours_Exit from './Run_Hours_Exit';
import Run_Hours_Filters from './Run_Hours_Filters';
import Run_Hours_Gaps from './Run_Hours_Gaps';
import Run_Hours_Position from './Run_Hours_Position';
import Run_Hours_Weekdays from './Run_Hours_Weekdays';
import Run_Hours_World from './Run_Hours_World';
import { moneyUnit, useFactsheetFormat } from './factsheetFormat';
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
  const { report, loading } = useSimulationReport(run.id, HOUR_BLOCKS, run.status === 'done');
  const entries = entriesOf(run.strategy);
  const unit = moneyUnit(run.instrument.quote);
  const f = useFactsheetFormat(unit);
  // Cada secção (5.1 a 5.10) está num componente dela, com os blocos que lê
  const section = { run, report, loading, entries, unit, f };

  return (
    <div className="Run_Summary">
      {report?.verdicts && (
        <section className="Factsheet_Section">
          <Factsheet_Conclusions findings={report.verdicts.screens.hours} entries={entries} unit={unit} />
        </section>
      )}
      <Run_Hours_Entry {...section} />
      <Run_Hours_Exit {...section} />
      <Run_Hours_Weekdays {...section} />
      <Run_Hours_Day_Hour {...section} />
      <Run_Hours_Calendar {...section} />
      <Run_Hours_Entries {...section} />
      <Run_Hours_Position {...section} />
      <Run_Hours_Filters {...section} />
      <Run_Hours_Gaps {...section} />
      <Run_Hours_World {...section} />
    </div>
  );
};

export default Run_Hours;
