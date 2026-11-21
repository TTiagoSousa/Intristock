import { useTranslation } from 'react-i18next';
import type { Run_Status } from '../../../../Hooks/Trading/useSimulation';

// O texto de uma secção do ecrã 5 sem os blocos: a carregar, sem relatório, cancelada ou por acabar
const Run_Hours_Pending = ({ loading, status }: { loading: boolean; status: Run_Status }) => {
  const { t } = useTranslation();
  return (
    <span className="Factsheet_Hint">
      {t(loading ? 'common.loading' : status === 'done' ? 'trading.factsheetMissing' : status === 'cancelled' ? 'trading.factsheetCancelled' : 'trading.factsheetPending')}
    </span>
  );
};

export default Run_Hours_Pending;
