import { useTranslation } from 'react-i18next';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import { Close, Plus } from '../../../../Imports/icons';
import Conditions_Editor from './Conditions_Editor';
import { useIndicators } from './indicatorsContext';
import { newCondition } from './simulationForm';
import type { Setup_Form } from './simulationForm';

interface Setup_Block_Props {
  id: string;
  setup: Setup_Form;
  onChange: (setup: Setup_Form) => void;
  onRemove: () => void;
}

/**
 * A preparação de uma entrada: primeiro estas condições, que a deixam armada
 * durante N velas; só então as condições da entrada a fazem entrar (é primeiro
 * uma e depois a outra). Pode cair antes, se as de cancelar se cumprirem.
 */
const Setup_Block = ({ id, setup, onChange, onRemove }: Setup_Block_Props) => {
  const { t } = useTranslation();
  const { indicators } = useIndicators();
  const set = <K extends keyof Setup_Form>(key: K, next: Setup_Form[K]) => onChange({ ...setup, [key]: next });

  return (
    <div className="Exit_Tile Rule_Tile setup">
      <div className="Exit_Tile_Header">
        <span className="Exit_Tile_Tag">{t('trading.setupTitle')}</span>
        <span className="Simulator_Hint">{t('trading.setupHint')}</span>
        <button
          type="button"
          className="Row_Action Risk_Remove"
          onClick={onRemove}
          title={t('trading.setupRemove')}
          aria-label={t('trading.setupRemove')}
        >
          <Close />
        </button>
      </div>

      <div className="Exit_Tile_Part">
        <span className="Exit_Tile_Label">{t('trading.setupFirst')}</span>
        <Conditions_Editor
          conditions={setup.conditions}
          onChange={(conditions) => set('conditions', conditions)}
          match={setup.match}
          onMatchChange={(match) => set('match', match)}
          minimum={1}
          addLabel={t('trading.addCondition')}
        />
      </div>

      <div className="Rule_Line">
        <span className="Rule_Word">{t('trading.setupArmedFor')}</span>
        <div className="Pct_Field">
          <Global_Input id={`${id}-setup-bars`} type="number" value={setup.bars} onChange={(e) => set('bars', e.target.value)} />
          <label htmlFor={`${id}-setup-bars`}>{t('trading.candlesUnit')}</label>
        </div>
      </div>

      {setup.cancel.length > 0 ? (
        <div className="Exit_Tile_Part">
          <span className="Exit_Tile_Label">{t('trading.setupCancel')}</span>
          <Conditions_Editor
            conditions={setup.cancel}
            onChange={(cancel) => set('cancel', cancel)}
            match={setup.cancelMatch}
            onMatchChange={(cancelMatch) => set('cancelMatch', cancelMatch)}
            minimum={0}
            addLabel={t('trading.addCondition')}
          />
        </div>
      ) : (
        <button type="button" className="Add_Condition" onClick={() => set('cancel', [newCondition(indicators)])}>
          <Plus />
          {t('trading.setupAddCancel')}
        </button>
      )}
    </div>
  );
};

export default Setup_Block;
