import { useTranslation } from 'react-i18next';
import Factsheet_Heading from './Factsheet_Heading';
import Factsheet_Hour_Filters from './Factsheet_Hour_Filters';
import Factsheet_Hour_Sample from './Factsheet_Hour_Sample';
import Run_Hours_Pending from './Run_Hours_Pending';
import type { Hours_Section_Props } from './runHours';

// 5.8 — Os filtros de horário sugeridos pelos dados
const Run_Hours_Filters = ({ run, report, loading, unit }: Hours_Section_Props) => {
  const { t } = useTranslation();
  const hourFilters = report?.hourFilters;
  const filterWorst = report?.hourFilterWorst;
  const filterBest = report?.hourFilterBest;

  return (
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
        <Run_Hours_Pending loading={loading} status={run.status} />
      )}
    </section>
  );
};

export default Run_Hours_Filters;
