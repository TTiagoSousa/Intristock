import { useTranslation } from 'react-i18next';
import Factsheet_Heading from './Factsheet_Heading';
import { Factsheet_Session_Edges, Factsheet_Work_Hours, Factsheet_World_Sessions } from './Factsheet_World_Sessions';
import Run_Hours_Pending from './Run_Hours_Pending';
import { zoneLabel, type Hours_Section_Props } from './runHours';

// 5.10 — As sessões mundiais, o horário de trabalho e a primeira e a última hora de cada bolsa
const Run_Hours_World = ({ run, report, loading, unit }: Hours_Section_Props) => {
  const { t } = useTranslation();
  const worldSessions = report?.worldSessions;
  const workHours = report?.workHours;
  const sessionEdges = report?.sessionEdges;
  const zoneName = (name: string) => zoneLabel(t, name);

  return (
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
        <Run_Hours_Pending loading={loading} status={run.status} />
      )}
    </section>
  );
};

export default Run_Hours_World;
