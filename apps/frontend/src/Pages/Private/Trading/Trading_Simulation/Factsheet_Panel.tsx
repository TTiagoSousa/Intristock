import { useEffect, useState } from 'react';
import type { ReactNode, Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { Close, Expand } from '../../../../Imports/icons';
import Factsheet_Explain from './Factsheet_Explain';

interface Factsheet_Panel_Props {
  title: ReactNode;
  note?: ReactNode;
  // A explicação do "?" ao lado do título (trading.fsExplain_<explain>_*)
  explain?: string;
  // Os botões do painel antes do de ecrã inteiro (Mês / Trimestre / Ano, vista avançada…)
  actions?: ReactNode;
  // Para o gráfico ler os tokens do painel
  panelRef?: Ref<HTMLDivElement>;
  // O ecrã inteiro controlado de fora (ex.: um botão "Ver todos"); sem isto, o painel trata dele
  fullscreen?: boolean;
  onFullscreenChange?: (fullscreen: boolean) => void;
  children: ReactNode;
}

/**
 * Um painel do Resumo: o cabeçalho numa faixa (título, nota e botões) e o
 * conteúdo por baixo. O botão de ecrã inteiro abre-o por cima da página, com ela
 * escurecida e parada; o ✕, o Esc ou um clique fora fecham. O painel é sempre o
 * mesmo elemento (não se desmonta), por isso o gráfico só muda de tamanho.
 */
const Factsheet_Panel = ({
  title,
  note,
  explain,
  actions,
  panelRef,
  fullscreen: controlled,
  onFullscreenChange,
  children,
}: Factsheet_Panel_Props) => {
  const { t } = useTranslation();
  const [own, setOwn] = useState(false);
  const fullscreen = controlled ?? own;
  const setFullscreen = (value: boolean) => {
    setOwn(value);
    onFullscreenChange?.(value);
  };

  // Em ecrã inteiro: o Esc fecha e a página por trás não anda
  useEffect(() => {
    if (!fullscreen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOwn(false);
        onFullscreenChange?.(false);
      }
    };
    window.addEventListener('keydown', close);
    // Quem faz scroll é o <html> (o overflow do body não chega lá)
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', close);
      root.style.overflow = overflow;
    };
  }, [fullscreen, onFullscreenChange]);

  const label = t(fullscreen ? 'trading.fsPanelExitFullscreen' : 'trading.fsPanelFullscreen');

  return (
    <>
      {fullscreen && <div className="Factsheet_Panel_Backdrop" onClick={() => setFullscreen(false)} />}
      <div
        className={`Factsheet_Panel${fullscreen ? ' Fullscreen' : ''}`}
        role={fullscreen ? 'dialog' : undefined}
        aria-modal={fullscreen || undefined}
        ref={panelRef}
      >
        <div className="Factsheet_Panel_Header">
          <div className="Factsheet_Panel_Heading">
            <span className="Factsheet_Panel_Title">
              {title}
              {explain && <Factsheet_Explain id={explain} title={typeof title === 'string' ? title : undefined} />}
            </span>
            {note && <span className="Factsheet_Panel_Note">{note}</span>}
          </div>
          <div className="Factsheet_Panel_Actions">
            {actions}
            <button
              type="button"
              className="Factsheet_Panel_Button Icon"
              onClick={() => setFullscreen(!fullscreen)}
              title={label}
              aria-label={label}
            >
              {fullscreen ? <Close /> : <Expand />}
            </button>
          </div>
        </div>
        {children}
      </div>
    </>
  );
};

export default Factsheet_Panel;
