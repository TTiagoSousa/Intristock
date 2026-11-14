import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TradeDisplay } from 'openchartscandle/candlestick';
import { Sliders } from '../../../../Imports/icons';

// O que se vê de cada trade: o da biblioteca e, sem as etiquetas, só as setas
export interface Chart_Display extends TradeDisplay {
  arrowsOnly: boolean;
}

interface Chart_Settings_Props {
  display: Chart_Display;
  onChange: (display: Chart_Display) => void;
}

const ROWS: (keyof Chart_Display)[] = ['entries', 'exits', 'arrowsOnly', 'lines'];

/**
 * As definições do gráfico, num menu no cabeçalho do card: o que se vê de cada
 * trade (as entradas, as saídas, só as setas e a linha entre elas). Só com as
 * setas não há linha: a linha leva o resultado, que é uma etiqueta.
 */
const Chart_Settings = ({ display, onChange }: Chart_Settings_Props) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora ou com o Escape
  useEffect(() => {
    if (!open) return;

    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="Chart_Settings" ref={rootRef}>
      <button
        type="button"
        className={`Chart_Settings_Button${open ? ' Open' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('trading.chartSettings')}
        title={t('trading.chartSettings')}
        onClick={() => setOpen(!open)}
      >
        <Sliders />
      </button>

      {open && (
        <div className="Chart_Settings_Menu" role="menu">
          <span className="Chart_Settings_Title">{t('trading.chartTradesTitle')}</span>
          {ROWS.map((key) => {
            const id = `chart-settings-${key}`;
            const disabled = key === 'lines' && display.arrowsOnly;
            const on = display[key] && !disabled;
            const toggle = () => {
              if (!disabled) onChange({ ...display, [key]: !display[key] });
            };
            return (
              <div key={key} className={`Chart_Settings_Row${disabled ? ' Disabled' : ''}`}>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-labelledby={id}
                  aria-disabled={disabled}
                  className={`Switch${on ? ' On' : ''}`}
                  onClick={toggle}
                >
                  <span className="Switch_Knob" />
                </button>
                <button type="button" className="Chart_Settings_Label" id={id} onClick={toggle}>
                  {t(`trading.chartShow_${key}`)}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Chart_Settings;
