import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Simple_Button from '../../../../../Components/Buttons/Simple_Button/Simple_Button';
import { usePropFirmSync } from '../../../../../Hooks/Admin/usePropFirmSync';

interface Prop_Firms_Data_Props {
  formatDate: (iso: string) => string;
}

/**
 * As prop firms no cartão da API delas: o que está na base (ou o atualizar a
 * correr) e o Abrir, que leva à página com o atualizar, a lista e o comparar.
 */
const Prop_Firms_Data = ({ formatDate }: Prop_Firms_Data_Props) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { status } = usePropFirmSync();

  const progress = status?.progress;
  const detail = status?.running
    ? progress?.phase === 'details'
      ? t('adminApis.propFirms.runningDetails', { done: progress.detailsDone, total: progress.detailsTotal })
      : t('adminApis.propFirms.runningList')
    : status && status.fromApi > 0
      ? t('adminApis.propFirms.detail', {
          count: status.fromApi,
          plans: status.plans,
          date: status.lastSyncedAt ? formatDate(status.lastSyncedAt) : '—',
        })
      : t('adminApis.propFirms.never');

  return (
    <div className="Api_Sync_Row">
      <div className="Api_Sync_Text">
        <span className="Api_Sync_Label">{t('adminApis.propFirms.label')}</span>
        <span className={`Api_Sync_Detail ${status && status.fromApi === 0 && !status.running ? 'Warn' : ''}`}>{detail}</span>
      </div>
      <Simple_Button
        text={t('adminApis.propFirms.open')}
        onClick={() => navigate('/Settings/Admin/Apis/prop-firms')}
        variant="Ghost"
        small
        auto
      />
    </div>
  );
};

export default Prop_Firms_Data;
