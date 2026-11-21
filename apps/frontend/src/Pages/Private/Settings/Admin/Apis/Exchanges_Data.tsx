import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import Simple_Button from '../../../../../Components/Buttons/Simple_Button/Simple_Button';

/** No cartão das exchanges: o Abrir, que leva à página com a lista toda. */
const Exchanges_Data = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="Api_Sync_Row">
      <div className="Api_Sync_Text">
        <span className="Api_Sync_Label">{t('adminApis.exchanges.listLabel')}</span>
        <span className="Api_Sync_Detail">{t('adminApis.exchanges.listDetail')}</span>
      </div>
      <Simple_Button
        text={t('adminApis.propFirms.open')}
        onClick={() => navigate('/Settings/Admin/Apis/exchanges')}
        variant="Ghost"
        small
        auto
      />
    </div>
  );
};

export default Exchanges_Data;
