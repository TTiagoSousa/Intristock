import { useTranslation } from 'react-i18next';
import type { Entry_Payload } from '../../../../Hooks/Trading/useSimulation';
import { entryLabel } from '../Trading_Simulator/labels';
import { entryColor } from './factsheetFormat';

interface Factsheet_Entry_Name_Props {
  entries: Entry_Payload[];
  rule: number;
}

// O nome de uma entrada com o quadrado da cor dela (o mesmo em todas as tabelas e gráficos)
const Factsheet_Entry_Name = ({ entries, rule }: Factsheet_Entry_Name_Props) => {
  const { t } = useTranslation();
  return (
    <span className="Factsheet_By_Entry_Name">
      <span className={`Factsheet_By_Entry_Dot Color_${entryColor(rule)}`} />
      {entryLabel(entries, rule, t)}
    </span>
  );
};

export default Factsheet_Entry_Name;
