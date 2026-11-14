import { useTranslation } from 'react-i18next';
import './Favoritos.scss';

const Favoritos = () => {
  const { t } = useTranslation();

  return (
    <div className="Favoritos">
      <div className="Page_Card">
        <div className="Card_Header">
          <span className="Card_Title">{t('calculators.favoritesTitle')}</span>
        </div>
        <div className="Card_Body">
          <p className="Empty_Message">{t('calculators.favoritesComingSoon')}</p>
        </div>
      </div>
    </div>
  );
};

export default Favoritos;
