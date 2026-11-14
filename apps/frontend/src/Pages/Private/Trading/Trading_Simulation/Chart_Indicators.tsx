import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { INDICATORS } from 'openchartscandle/candlestick';
import { Plus, Trend } from '../../../../Imports/icons';

// Um indicador da simulação, como aparece no menu
export interface Simulation_Indicator_Row {
  id: string;
  label: string;
  color: string;
  shown: boolean;
}

interface Chart_Indicators_Props {
  simulation: Simulation_Indicator_Row[];
  onToggle: (id: string) => void;
  onAdd: (kind: string) => void;
}

/**
 * Os indicadores do gráfico, num menu no cabeçalho do card: os da simulação
 * (ligam-se e desligam-se, cada um no tempo gráfico dele) e os livres, os que a
 * biblioteca tem, que se acrescentam aqui e se mudam ou tiram na legenda.
 */
const Chart_Indicators = ({ simulation, onToggle, onAdd }: Chart_Indicators_Props) => {
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

  const add = (kind: string) => {
    onAdd(kind);
    setOpen(false);
  };

  return (
    <div className="Chart_Settings Chart_Indicators" ref={rootRef}>
      <button
        type="button"
        className={`Chart_Indicators_Button${open ? ' Open' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Trend />
        <span>{t('trading.chartIndicators')}</span>
      </button>

      {open && (
        <div className="Chart_Settings_Menu Chart_Indicators_Menu" role="menu">
          {simulation.length > 0 && (
            <>
              <span className="Chart_Settings_Title">{t('trading.chartIndicatorsSimulation')}</span>
              {simulation.map((row) => {
                const id = `chart-indicator-${row.id}`;
                return (
                  <div key={row.id} className="Chart_Settings_Row">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={row.shown}
                      aria-labelledby={id}
                      className={`Switch${row.shown ? ' On' : ''}`}
                      onClick={() => onToggle(row.id)}
                    >
                      <span className="Switch_Knob" />
                    </button>
                    <span className="Chart_Indicators_Swatch" style={{ backgroundColor: row.color }} />
                    <button type="button" className="Chart_Settings_Label" id={id} onClick={() => onToggle(row.id)}>
                      {row.label}
                    </button>
                  </div>
                );
              })}
            </>
          )}

          <span className="Chart_Settings_Title Chart_Indicators_Free">{t('trading.chartIndicatorsAdd')}</span>
          {/* Com os nomes da biblioteca, os mesmos da legenda */}
          {INDICATORS.map(({ type, name }) => (
            <button key={type} type="button" className="Chart_Settings_Row Chart_Indicators_Add" onClick={() => add(type)}>
              <span className="Chart_Indicators_Plus">
                <Plus />
              </span>
              <span className="Chart_Settings_Label">{name}</span>
            </button>
          ))}
          <span className="Chart_Indicators_Hint">{t('trading.chartIndicatorsHint')}</span>
        </div>
      )}
    </div>
  );
};

export default Chart_Indicators;
