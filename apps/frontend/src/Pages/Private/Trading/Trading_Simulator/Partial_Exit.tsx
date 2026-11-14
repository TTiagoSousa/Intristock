import { useTranslation } from 'react-i18next';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import { Close } from '../../../../Imports/icons';
import Segmented from './Segmented';
import { MAX_NAME, TAKE_MODES } from './simulationForm';
import type { Partial_Form, Take_Mode } from './simulationForm';

interface Partial_Exit_Props {
  id: string;
  partial: Partial_Form;
  position: number;
  onChange: (partial: Partial_Form) => void;
  onRemove: () => void;
}

/**
 * Uma saída parcial numa linha: fecha X% da posição quando o preço anda a favor
 * uma % ou N R (a distância ao stop), e o stop pode passar para a entrada. O
 * resto da posição segue com as outras saídas.
 */
const Partial_Exit = ({ id, partial, position, onChange, onRemove }: Partial_Exit_Props) => {
  const { t } = useTranslation();
  const set = <K extends keyof Partial_Form>(key: K, next: Partial_Form[K]) => onChange({ ...partial, [key]: next });

  return (
    <div className="Exit_Tile Risk_Tile partial">
      <div className="Risk_Tile_Line">
        <span className="Exit_Tile_Tag">{t('trading.partialTitle', { position })}</span>
        <input
          className="Inline_Name"
          value={partial.name}
          maxLength={MAX_NAME}
          placeholder={t('trading.namePlaceholder')}
          aria-label={t('trading.name')}
          onChange={(e) => set('name', e.target.value)}
        />

        <div className="Risk_Tile_Controls">
          <div className="Pct_Field">
            <Global_Input id={`${id}-close`} type="number" value={partial.closePct} onChange={(e) => set('closePct', e.target.value)} />
            <label htmlFor={`${id}-close`}>%</label>
          </div>
          <span className="Partial_Word">{t('trading.partialAt')}</span>
          <Segmented
            label={t('trading.partialUnit')}
            value={partial.mode}
            options={TAKE_MODES.map((mode) => ({ value: mode, label: t(`trading.takeMode_${mode}`) }))}
            onChange={(mode) => set('mode', mode as Take_Mode)}
          />
          <div className="Pct_Field">
            <Global_Input id={`${id}-value`} type="number" value={partial.value} onChange={(e) => set('value', e.target.value)} />
            <label htmlFor={`${id}-value`}>{partial.mode === 'r' ? 'R' : '%'}</label>
          </div>
          <Segmented
            label={t('trading.partialStop')}
            value={partial.moveStop ? 'entry' : 'keep'}
            options={[
              { value: 'keep', label: t('trading.partialStop_keep') },
              { value: 'entry', label: t('trading.partialStop_entry') },
            ]}
            onChange={(choice) => set('moveStop', choice === 'entry')}
          />
        </div>

        <span className="Simulator_Hint">
          {t(partial.mode === 'r' ? 'trading.partialHint_r' : 'trading.partialHint_pct', {
            close: partial.closePct || '…',
            value: partial.value || '…',
          })}
          {partial.moveStop && ` ${t('trading.partialHintMove')}`}
        </span>

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
    </div>
  );
};

export default Partial_Exit;
