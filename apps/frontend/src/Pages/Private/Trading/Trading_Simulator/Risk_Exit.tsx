import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import { Close } from '../../../../Imports/icons';
import Schedule_Toggle from './Schedule_Toggle';
import Segmented from './Segmented';
import { MAX_NAME } from './simulationForm';
import type { Schedule_Form } from './strategyOptions';

export type Risk_Exit_Kind = 'stop_loss' | 'take_profit' | 'trailing_stop' | 'break_even' | 'time';

interface Risk_Exit_Props {
  id: string;
  // A cor da risca: os stops a vermelho, o take profit a verde, o tempo a cinzento
  kind: Risk_Exit_Kind;
  value: string;
  onValueChange: (value: string) => void;
  // Só o stop e o take profit têm nome, horário e modos (o stop em %, na
  // mínima/máxima ou num nível; o take em % ou em R)
  name?: string;
  onNameChange?: (name: string) => void;
  schedule?: Schedule_Form | null;
  onScheduleChange?: (schedule: Schedule_Form | null) => void;
  modes?: { value: string; label: string }[];
  mode?: string;
  onModeChange?: (mode: string) => void;
  // A unidade do valor (por omissão %, velas no tempo)
  unit?: string;
  // Outros campos em vez do valor (as velas da mínima, o nível)
  fields?: ReactNode;
  // A explicação, quando não é a do valor em %
  hint?: string;
  // Se conta (por omissão, se tem valor)
  active?: boolean;
  // Tira a saída (fica só o botão para a voltar a pôr)
  onRemove: () => void;
}

/**
 * Uma saída de valor numa linha: a etiqueta, o nome (stop e take profit), o
 * modo, o valor (% do preço de entrada, R, ou velas no tempo) e o que faz. Só
 * aparece quando está ligada; o × tira-a. O stop e o take profit podem valer só
 * em certos dias e horas.
 */
const Risk_Exit = ({
  id,
  kind,
  value,
  onValueChange,
  name,
  onNameChange,
  schedule,
  onScheduleChange,
  modes,
  mode,
  onModeChange,
  unit,
  fields,
  hint,
  active,
  onRemove,
}: Risk_Exit_Props) => {
  const { t } = useTranslation();
  const off = active === undefined ? value.trim() === '' : !active;

  return (
    <div className={`Exit_Tile Risk_Tile ${kind}${off ? ' Off' : ''}`}>
      <div className="Risk_Tile_Line">
        <span className="Exit_Tile_Tag">{t(`trading.exit_${kind}`)}</span>
        {onNameChange && (
          <input
            className="Inline_Name"
            value={name ?? ''}
            maxLength={MAX_NAME}
            placeholder={t('trading.namePlaceholder')}
            aria-label={t('trading.name')}
            onChange={(e) => onNameChange(e.target.value)}
          />
        )}

        {/* Os controlos numa coluna da mesma largura em todas as saídas: as explicações ficam alinhadas */}
        <div className="Risk_Tile_Controls">
          {modes && mode && onModeChange && (
            <Segmented label={t(`trading.exit_${kind}`)} value={mode} options={modes} onChange={onModeChange} />
          )}

          {fields ?? (
            <div className="Pct_Field">
              <Global_Input id={id} type="number" value={value} placeholder={t('trading.none')} onChange={(e) => onValueChange(e.target.value)} />
              <label htmlFor={id}>{unit ?? (kind === 'time' ? t('trading.candlesUnit') : '%')}</label>
            </div>
          )}
        </div>

        <span className="Simulator_Hint">{off ? t('trading.riskEmpty') : (hint ?? t(`trading.${kind}Hint`, { value }))}</span>

        <button
          type="button"
          className="Row_Action Risk_Remove"
          onClick={onRemove}
          title={t('trading.removeExit')}
          aria-label={t('trading.removeExit')}
        >
          <Close />
        </button>
      </div>

      {onScheduleChange && !off && (
        <Schedule_Toggle
          schedule={schedule ?? null}
          onChange={onScheduleChange}
          addLabel={t('trading.scheduleAdd_stop')}
          defaultMode="only"
        />
      )}
    </div>
  );
};

export default Risk_Exit;
