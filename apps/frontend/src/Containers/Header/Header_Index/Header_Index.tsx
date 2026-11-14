import { useTranslation } from 'react-i18next';
import './Header_Index.scss';
import { useNavigate } from 'react-router';
import { useAuth } from '../../../Contexts/Auth_Context';

const Header_Index = () => {
  
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { authenticated, isLoading } = useAuth();

  return (
    <div className="Header_Index">
      <div className="Left_Side">
        <div className="Title">
          <span>Intri</span>
          <span>Stock</span>
        </div>
      </div>
      <div className="Right_Side">
        {!isLoading && (
          authenticated ? (
            <div className="Button_Field">
              <button
                className='Back_To_Dashboard'
                onClick={() => navigate('/Dashboard')}
              >
                {t('landing.backToDashboard')}
              </button>
            </div>
          ) : (
            // Sem registo público: as contas são criadas pelo admin
            <div className="Button_Field">
              <button
                className='Login'
                onClick={() => navigate('/Auth')}
              >
                {t('landing.login')}
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default Header_Index;
