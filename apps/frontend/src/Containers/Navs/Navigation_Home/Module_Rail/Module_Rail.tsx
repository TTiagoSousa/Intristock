import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { modules } from '../Menu_Itins';
import { useAuth } from '../../../../Contexts/Auth_Context';
import * as Icon from '../../../../Imports/icons';
import './Module_Rail.scss';

/**
 * A barra estreita dos módulos: é sempre a mesma, também dentro de uma empresa
 * (as áreas da empresa estão no painel ao lado). Cada ícone diz o que é ao
 * passar o rato ou ao chegar lá com o teclado.
 */
export const Module_Rail = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const railItem = (key: string, label: string, content: React.ReactNode, isActive: boolean, onClick: () => void) => (
    <button
      key={key}
      type="button"
      className={`Rail_Item ${isActive ? 'Active' : ''}`}
      onClick={onClick}
      aria-label={label}
      aria-current={isActive ? 'page' : undefined}
    >
      {content}
      <span className="Rail_Tooltip" aria-hidden="true">
        {label}
      </span>
    </button>
  );

  return (
    <nav className="Module_Rail" aria-label={t('menu.modules')}>
      <button type="button" className="Rail_Brand" onClick={() => navigate('/Dashboard')}>
        iS
      </button>

      <div className="Rail_Items">
        {modules.map((item) =>
          railItem(
            item.id,
            t(item.labelKey),
            <item.icon />,
            item.id === 'dashboard'
              ? location.pathname === '/' || location.pathname.startsWith('/Dashboard')
              : location.pathname.startsWith(item.path),
            () => navigate(item.path),
          ),
        )}
      </div>

      <div className="Rail_Bottom">
        {railItem('logout', t('menu.logout'), <Icon.Logout />, false, handleLogout)}
      </div>
    </nav>
  );
};

export default Module_Rail;
