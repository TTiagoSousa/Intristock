import { useTranslation } from 'react-i18next';
import type { Market_Instrument } from '../../../../Hooks/Trading/useMarketInstruments';
import Option_Fields from './Option_Fields';
import { brokerLimits } from './strategyOptions';
import type { Option_Key, Options_Form } from './strategyOptions';

interface Option_Row_Props {
  option: Option_Key;
  options: Options_Form;
  onChange: (options: Options_Form) => void;
  instrument: Market_Instrument | null;
  error?: string;
}

/**
 * Uma opção numa linha de definições: o interruptor, o nome e o que faz numa
 * frase. Ligada, os campos aparecem por baixo; desligada, vale o normal.
 */
const Option_Row = ({ option, options, onChange, instrument, error }: Option_Row_Props) => {
  const { t } = useTranslation();
  const on = options.enabled.includes(option);
  const id = `option-row-${option}`;

  const toggle = () => {
    if (on) {
      onChange({ ...options, enabled: options.enabled.filter((item) => item !== option) });
      return;
    }
    // Os mínimos da ordem começam com os da corretora, se os houver
    const prefill =
      option === 'orderSize' && !options.quantityStep && !options.minQuantity && !options.minNotional
        ? brokerLimits(instrument)
        : {};
    onChange({ ...options, ...prefill, enabled: [...options.enabled, option] });
  };

  return (
    <div className={`Option_Row${on ? ' On' : ''}${error ? ' Invalid' : ''}`}>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby={id}
        className={`Switch${on ? ' On' : ''}`}
        onClick={toggle}
      >
        <span className="Switch_Knob" />
      </button>

      <div className="Option_Row_Main">
        <button type="button" className="Option_Row_Title" id={id} onClick={toggle}>
          {t(`trading.opt_${option}`)}
        </button>
        <span className="Option_Row_Help">{t(`trading.optHelp_${option}`)}</span>

        {on && (
          <div className="Option_Row_Fields">
            <Option_Fields
              option={option}
              options={options}
              onChange={(patch) => onChange({ ...options, ...patch })}
              instrument={instrument}
            />
          </div>
        )}
        {on && error && <span className="Simulator_Error">{t(error)}</span>}
      </div>
    </div>
  );
};

export default Option_Row;
