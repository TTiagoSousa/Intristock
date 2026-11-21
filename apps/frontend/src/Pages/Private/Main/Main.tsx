import { useEffect } from 'react';
import { useLocation } from 'react-router';
import Header_Home from '../../../Containers/Header/Header_Home/Header_Home';
import Module_Rail from '../../../Containers/Navs/Navigation_Home/Module_Rail/Module_Rail';
import Context_Panel from '../../../Containers/Navs/Navigation_Home/Context_Panel/Context_Panel';
import { useNavs } from '../../../Contexts/Navs_Context';
import { CompanyProvider } from '../../../Contexts/Company_Context';
import { useSetupStatus } from '../../../Hooks/Setup/useSetupStatus';
import Setup from '../Setup/Setup';
import Private_Routes from '../../../Routes/Private_Routes';
import './Main.scss';

const Main_Layout = () => {
  const { effectiveNavigation, isMobileMenuOpen, toggleMobileMenu, isPanelCollapsed } = useNavs();
  const isMobile = effectiveNavigation === 'Mobile_Menu';
  // Recolhido, só fica a barra dos ícones (no telemóvel a gaveta mostra sempre os dois)
  const collapsed = !isMobile && isPanelCollapsed;
  const location = useLocation();

  // Ao mudar de página a gaveta fecha sozinha
  useEffect(() => {
    if (isMobile && isMobileMenuOpen) toggleMobileMenu();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return (
    <div
      className={`Shell ${isMobile ? 'Mobile' : ''} ${isMobile && isMobileMenuOpen ? 'Menu_Open' : ''} ${collapsed ? 'Panel_Collapsed' : ''}`}
    >
      {/* Em ecrã estreito estes dois continuam montados mas fora de cena, para
          a gaveta poder deslizar em vez de aparecer de repente */}
      <Module_Rail />
      {!collapsed && <Context_Panel onNavigate={isMobile ? toggleMobileMenu : undefined} />}

      {isMobile && isMobileMenuOpen && (
        <div className="Shell_Backdrop" onClick={toggleMobileMenu} />
      )}

      <main className="Shell_Canvas">
        <Header_Home />
        <div className="Shell_View">
          <Private_Routes />
        </div>
      </main>
    </div>
  );
};

// A empresa atual (e os seus módulos) tem de estar disponível para a barra e
// para o painel, por isso o provider fica por fora do layout.
//
// Antes de tudo, o primeiro arranque: uma instalação nova ainda não tem moedas
// nem países, e o admin configura as APIs antes de a app abrir. Se o estado não
// se conseguir ler, a app abre na mesma — cada página mostra os seus erros.
const Main = () => {
  const { status, loading, refresh } = useSetupStatus();

  if (loading) return null;
  if (status && !status.configured) return <Setup onDone={refresh} />;

  return (
    <CompanyProvider>
      <Main_Layout />
    </CompanyProvider>
  );
};

export default Main;
