import { useTranslation } from 'react-i18next';
import Factsheet_Entry_Blocks from './Factsheet_Entry_Blocks';
import Factsheet_Entry_Hours from './Factsheet_Entry_Hours';
import Factsheet_Heading from './Factsheet_Heading';
import Run_Hours_Pending from './Run_Hours_Pending';
import type { Hours_Section_Props } from './runHours';

// 5.6 — Cada entrada por hora de entrada e os blocos de horas
const Run_Hours_Entries = ({ run, report, loading, entries, unit }: Hours_Section_Props) => {
  const { t } = useTranslation();
  const profiles = report?.entryHourProfiles;
  const hourBlocks = report?.entryHourBlocks;

  return (
    <section className="Factsheet_Section">
      <Factsheet_Heading
        title={t('trading.factsheetEntryHoursTitle')}
        tag={t('trading.factsheetEntryHoursTag')}
        info={t('trading.factsheetEntryHoursInfo')}
      />
      {profiles && hourBlocks ? (
        <>
          <div className="Factsheet_Grid Two">
            {profiles.entries.map((profile) => (
              <Factsheet_Entry_Hours key={profile.rule} profile={profile} entries={entries} unit={unit} />
            ))}
          </div>
          <Factsheet_Entry_Blocks table={hourBlocks} entries={entries} unit={unit} />
        </>
      ) : (
        <Run_Hours_Pending loading={loading} status={run.status} />
      )}
    </section>
  );
};

export default Run_Hours_Entries;
