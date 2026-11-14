import { useTranslation } from 'react-i18next';
import type { Live_State } from '../../../../Hooks/Trading/useLiveTests';
import { Check, Close } from '../../../../Imports/icons';
import Factsheet_Panel from './Factsheet_Panel';
import type { Condition_Slot, useLiveTexts } from './liveTexts';

interface Live_Conditions_Props {
  state: Live_State;
  texts: ReturnType<typeof useLiveTexts>;
}

/**
 * O estado de cada condição na última vela de decisão (a abertura da vela do
 * tempo gráfico da simulação), por entrada: as da entrada (e dos grupos), se
 * todas se cumprem, a preparação (armada ou não) e as das saídas. Vem do
 * simulador a cada vela nova.
 */
const Live_Conditions = ({ state, texts }: Live_Conditions_Props) => {
  const { t } = useTranslation();
  const values = state.conditions ?? {};
  const known = Object.keys(values).length > 0;

  const row = (slot: Condition_Slot) => {
    const value = values[slot.id];
    return (
      <li key={slot.id} className={`Live_Condition${slot.depth ? ' Nested' : ''}${value ? ' True' : ''}`}>
        <span className="Live_Condition_Mark" aria-label={t(value ? 'trading.liveTrue' : 'trading.liveFalse')}>
          {value ? <Check /> : <Close />}
        </span>
        <span>{texts.conditionLabel(slot)}</span>
      </li>
    );
  };

  return (
    <Factsheet_Panel
      title={t('trading.liveConditionsTitle')}
      note={
        state.conditionsBarTime
          ? t('trading.liveConditionsNote', { time: texts.moment(state.conditionsBarTime) })
          : t('trading.liveConditionsWaiting')
      }
    >
      {!known ? (
        <span className="Factsheet_Hint">{t('trading.liveConditionsWaiting')}</span>
      ) : (
        <div className="Live_Conditions">
          {texts.slots.map((entry) => {
            const met = values[`met:${entry.entry}`];
            const armed = state.setupArmed?.[entry.entry - 1];
            return (
              <div key={entry.entry} className="Live_Conditions_Entry">
                <div className="Live_Conditions_Head">
                  <strong>{texts.entryName(entry.entry)}</strong>
                  <span className={`Live_Pill${met ? ' True' : ''}`}>
                    {t(met ? 'trading.liveMetShort_true' : 'trading.liveMetShort_false', {
                      match: t(entry.form.match === 'any' ? 'trading.liveMatch_any' : 'trading.liveMatch_all'),
                    })}
                  </span>
                </div>
                {entry.setup.length > 0 && (
                  <>
                    <span className="Live_Conditions_Label">
                      {t('trading.liveWhere_setup')} · {t(armed ? 'trading.liveArmed' : 'trading.liveNotArmed')}
                    </span>
                    <ul>{entry.setup.map(row)}</ul>
                  </>
                )}
                <span className="Live_Conditions_Label">{t('trading.liveWhere_entry')}</span>
                {entry.conditions.length ? (
                  <ul>{entry.conditions.map(row)}</ul>
                ) : (
                  <span className="Factsheet_Hint">{t('trading.liveAlways')}</span>
                )}
                {entry.exits
                  .filter((exit) => exit.conditions.length)
                  .map((exit) => (
                    <div key={exit.exit}>
                      <span className="Live_Conditions_Label">{exit.name}</span>
                      <ul>{exit.conditions.map(row)}</ul>
                    </div>
                  ))}
              </div>
            );
          })}
        </div>
      )}
    </Factsheet_Panel>
  );
};

export default Live_Conditions;
