import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash } from '../../../../Imports/icons';
import Collapse_Button from './Collapse_Button';
import Conditions_Editor from './Conditions_Editor';
import Schedule_Toggle from './Schedule_Toggle';
import Value_Editor from './Value_Editor';
import { useIndicators } from './indicatorsContext';
import { MAX_NAME } from './simulationForm';
import { valueLabel } from './valueLabels';
import type { Exit_Form } from './simulationForm';

interface Exit_Block_Props {
  exit: Exit_Form;
  position: number;
  onChange: (exit: Exit_Form) => void;
  onRemove: () => void;
}

/**
 * Uma saída com condição de uma entrada: o nome, "quando" (as condições,
 * todas ou qualquer uma; sem nenhuma, está sempre ativa) e "sai a" (a abertura da vela ou um
 * nível: o preço de uma vela, uma média ou um valor). Fecha-se para ficar só o
 * cabeçalho, com um resumo.
 */
const Exit_Block = ({ exit, position, onChange, onRemove }: Exit_Block_Props) => {
  const { t } = useTranslation();
  const { indicators } = useIndicators();
  const market = exit.price.kind === 'market';
  const [open, setOpen] = useState(true);
  const bodyId = `exit-${exit.id}-body`;

  // Fechada: "1 condição · MM21" ou "sempre ativa · Abertura (mercado)"
  const summary = [
    exit.conditions.length
      ? t('trading.summaryConditions', { count: exit.conditions.length })
      : t('trading.summaryAlways'),
    valueLabel(exit.price, indicators, t),
  ].join(' · ');

  return (
    <div className="Exit_Tile signal">
      <div className="Exit_Tile_Header">
        <Collapse_Button open={open} onToggle={() => setOpen((value) => !value)} controls={bodyId} />
        <span className="Exit_Tile_Tag">{t('trading.exitTitle', { position })}</span>
        <input
          className="Inline_Name"
          value={exit.name}
          maxLength={MAX_NAME}
          placeholder={t('trading.namePlaceholder')}
          aria-label={t('trading.name')}
          onChange={(e) => onChange({ ...exit, name: e.target.value })}
        />
        {!open && <span className="Collapsed_Summary">{summary}</span>}
        <button
          type="button"
          className="Row_Action Danger"
          onClick={onRemove}
          title={t('trading.removeExit')}
          aria-label={t('trading.removeExit')}
        >
          <Trash />
        </button>
      </div>

      <div className="Exit_Tile_Content" id={bodyId} hidden={!open}>
        <div className="Exit_Tile_Part">
          <span className="Exit_Tile_Label">{t('trading.exitWhen')}</span>
          <Conditions_Editor
            conditions={exit.conditions}
            onChange={(conditions) => onChange({ ...exit, conditions })}
            match={exit.match}
            onMatchChange={(match) => onChange({ ...exit, match })}
            minimum={0}
            addLabel={t('trading.addCondition')}
            emptyText={t('trading.exitAlways')}
          />
        </div>

        <div className="Exit_Tile_Part">
          <span className="Exit_Tile_Label">{t('trading.exitAt')}</span>
          <div className="Price_Row">
            <div className="Operand_Box">
              <Value_Editor
                id={`exit-${exit.id}-price`}
                label={t('trading.exitPrice')}
                showLabel
                priceOnly
                value={exit.price}
                onChange={(price) => onChange({ ...exit, price })}
              />
            </div>
            <span className="Simulator_Hint">{market ? t('trading.exitMarketHint') : t('trading.exitLevelHint')}</span>
          </div>
        </div>

        <Schedule_Toggle
          schedule={exit.schedule}
          onChange={(schedule) => onChange({ ...exit, schedule })}
          addLabel={t('trading.scheduleAdd_exit')}
          defaultMode="only"
        />
      </div>
    </div>
  );
};

export default Exit_Block;
