import { useTranslation } from 'react-i18next';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import { Plus, Trash } from '../../../../Imports/icons';
import type {
  Indicator_Kind,
  Price_Field,
  Profile_Exchange,
  Profile_Rows_Layout,
  Profile_Session,
  Profile_Volume,
  Smoothing_Kind,
  Timeframe,
} from '../../../../Hooks/Trading/useSimulation';
import {
  MAX_INDICATORS,
  MAX_NAME,
  PRICE_FIELDS,
  PROFILE_EXCHANGES,
  PROFILE_ROWS_LAYOUTS,
  PROFILE_SESSIONS,
  PROFILE_VOLUMES,
  SIMULATION_INDICATOR_KINDS,
  SMOOTHING_KINDS,
  TIMEFRAMES,
  hasShift,
  hasSmoothing,
  indicatorProblem,
  isProfile,
  isSimulationKind,
} from './simulationForm';
import type { Indicator_Form } from './simulationForm';
import { autoIndicatorName, uniqueName } from './valueLabels';

interface Indicators_Card_Props {
  indicators: Indicator_Form[];
  onChange: (indicators: Indicator_Form[]) => void;
  onAdd: () => void;
  // Um indicador usado numa condição ou preço não se apaga
  inUse: (id: string) => boolean;
}

/**
 * Os indicadores da estratégia (médias simples, exponenciais, ponderadas, RSI e
 * o perfil de volume por sessão), definidos uma vez (nome, tipo, período, fonte,
 * tempo gráfico; nas médias o deslocamento, no RSI a média dele; no perfil as
 * opções do indicador da trading-chart: a sessão, a bolsa, as linhas, o volume e
 * a % da área de valor) e escolhidos pelo nome nas condições. Mudar um aqui muda-o em
 * todos os sítios onde é usado.
 *
 * O nome vem preenchido com o automático e acompanha as definições enquanto não
 * for trocado (período 20 → "MM20"); apagado, volta o automático. Vive no seu
 * separador, sempre aberto.
 */
const Indicators_Card = ({ indicators, onChange, onAdd, inUse }: Indicators_Card_Props) => {
  const { t } = useTranslation();

  // Um nome automático é o das definições, com ou sem o "(2)" de repetido
  const isAuto = (indicator: Indicator_Form) => {
    const auto = autoIndicatorName(indicator, t);
    return indicator.name === auto || indicator.name.startsWith(`${auto} (`);
  };

  const othersNames = (id: string) => indicators.filter((item) => item.id !== id).map((item) => item.name);

  const update = (id: string, patch: Partial<Indicator_Form>) =>
    onChange(
      indicators.map((indicator) => {
        if (indicator.id !== id) return indicator;
        const next = { ...indicator, ...patch };
        if (!('name' in patch) && isAuto(indicator)) {
          next.name = uniqueName(autoIndicatorName(next, t), othersNames(id));
        }
        return next;
      }),
    );

  // Sem nome não fica: ao sair do campo vazio, volta o automático
  const fillName = (indicator: Indicator_Form) => {
    if (indicator.name.trim()) return;
    update(indicator.id, { name: uniqueName(autoIndicatorName(indicator, t), othersNames(indicator.id)) });
  };

  const timeframeOptions = [
    { value: '', label: t('trading.tfChart') },
    ...TIMEFRAMES.map((timeframe) => ({ value: timeframe, label: t(`trading.tf_${timeframe}`) })),
  ];

  return (
    <div className="Page_Card Indicators_Card">
      <div className="Card_Header">
        <div className="Card_Header_Text">
          <span className="Card_Title">{t('trading.indicators')}</span>
          <span className="Card_Subtitle">{t('trading.indicatorsSubtitle')}</span>
        </div>
      </div>

      <div className="Card_Body Indicators_Body">
        {indicators.length === 0 && <span className="Conditions_Empty">{t('trading.noIndicators')}</span>}

        {indicators.map((indicator) => {
          const id = `indicator-${indicator.id}`;
          const used = inUse(indicator.id);
          const profile = isProfile(indicator.kind);
          return (
            <div key={indicator.id} className="Indicator_Row">
              <div className="Mini_Field Indicator_Name">
                <label htmlFor={`${id}-name`}>{t('trading.name')}</label>
                <Global_Input
                  id={`${id}-name`}
                  value={indicator.name}
                  maxLength={MAX_NAME}
                  placeholder={autoIndicatorName(indicator, t)}
                  onChange={(e) => update(indicator.id, { name: e.target.value })}
                  onBlur={() => fillName(indicator)}
                />
              </div>

              <div className="Mini_Field Mini_Field_Kind">
                <label htmlFor={`${id}-kind`}>{t('trading.indicatorKind')}</label>
                <Global_Dropdown
                  id={`${id}-kind`}
                  value={indicator.kind}
                  searchable={false}
                  // O de uma simulação antiga continua à vista até se mudar
                  options={[
                    ...SIMULATION_INDICATOR_KINDS,
                    ...(isSimulationKind(indicator.kind) ? [] : [indicator.kind]),
                  ].map((kind) => ({ value: kind, label: t(`trading.kindLong_${kind}`) }))}
                  onChange={(kind) => update(indicator.id, { kind: kind as Indicator_Kind })}
                />
              </div>

              {profile && (
                <>
                  <div className="Mini_Field Indicator_Profile_Session">
                    <label htmlFor={`${id}-session`}>{t('trading.profileSessionLabel')}</label>
                    <Global_Dropdown
                      id={`${id}-session`}
                      value={indicator.session}
                      searchable={false}
                      maxVisibleOptions={8}
                      options={PROFILE_SESSIONS.map((session) => ({
                        value: session,
                        label: t(`trading.profileSession_${session}`),
                      }))}
                      onChange={(session) => update(indicator.id, { session: session as Profile_Session })}
                    />
                  </div>

                  {indicator.session === 'custom' && (
                    <div className="Mini_Field Mini_Field_Kind" title={t('trading.profileCustomHint')}>
                      <label htmlFor={`${id}-custom`}>{t('trading.profileCustomSession')}</label>
                      <Global_Input
                        id={`${id}-custom`}
                        value={indicator.customSession}
                        placeholder="0930-1600"
                        onChange={(e) => update(indicator.id, { customSession: e.target.value })}
                      />
                    </div>
                  )}

                  <div className="Mini_Field Indicator_Profile_Exchange" title={t('trading.profileExchangeHint')}>
                    <label htmlFor={`${id}-exchange`}>{t('trading.profileExchangeLabel')}</label>
                    <Global_Dropdown
                      id={`${id}-exchange`}
                      value={indicator.exchange}
                      searchable={false}
                      maxVisibleOptions={8}
                      options={PROFILE_EXCHANGES.map((exchange) => ({
                        value: exchange,
                        label: t(`trading.profileExchange_${exchange || 'symbol'}`),
                      }))}
                      onChange={(exchange) => update(indicator.id, { exchange: exchange as Profile_Exchange })}
                    />
                  </div>

                  <div className="Mini_Field Mini_Field_Kind">
                    <label htmlFor={`${id}-layout`}>{t('trading.profileRowsLayoutLabel')}</label>
                    <Global_Dropdown
                      id={`${id}-layout`}
                      value={indicator.rowsLayout}
                      searchable={false}
                      options={PROFILE_ROWS_LAYOUTS.map((layout) => ({
                        value: layout,
                        label: t(`trading.profileRowsLayout_${layout}`),
                      }))}
                      onChange={(layout) => update(indicator.id, { rowsLayout: layout as Profile_Rows_Layout })}
                    />
                  </div>

                  <div className="Mini_Field Indicator_Profile_Number">
                    <label htmlFor={`${id}-rows`}>{t('trading.profileRowSize')}</label>
                    <Global_Input
                      id={`${id}-rows`}
                      type="number"
                      value={indicator.rowSize}
                      onChange={(e) => update(indicator.id, { rowSize: e.target.value })}
                    />
                  </div>

                  <div className="Mini_Field Mini_Field_Kind" title={t('trading.profileVolumeHint')}>
                    <label htmlFor={`${id}-volume`}>{t('trading.profileVolumeLabel')}</label>
                    <Global_Dropdown
                      id={`${id}-volume`}
                      value={indicator.volume}
                      searchable={false}
                      options={PROFILE_VOLUMES.map((volume) => ({
                        value: volume,
                        label: t(`trading.profileVolume_${volume}`),
                      }))}
                      onChange={(volume) => update(indicator.id, { volume: volume as Profile_Volume })}
                    />
                  </div>

                  <div className="Mini_Field Indicator_Profile_Number">
                    <label htmlFor={`${id}-va`}>{t('trading.profileVaPct')}</label>
                    <Global_Input
                      id={`${id}-va`}
                      type="number"
                      value={indicator.vaPct}
                      onChange={(e) => update(indicator.id, { vaPct: e.target.value })}
                    />
                  </div>
                </>
              )}

              {!profile && (
                <div className="Mini_Field Mini_Field_Number">
                  <label htmlFor={`${id}-period`}>{t('trading.period')}</label>
                  <Global_Input
                    id={`${id}-period`}
                    type="number"
                    value={indicator.period}
                    onChange={(e) => update(indicator.id, { period: e.target.value })}
                  />
                </div>
              )}

              {!profile && (
                <div className="Mini_Field">
                  <label htmlFor={`${id}-field`}>{t('trading.source')}</label>
                  <Global_Dropdown
                    id={`${id}-field`}
                    value={indicator.field}
                    searchable={false}
                    options={PRICE_FIELDS.map((field) => ({ value: field, label: t(`trading.field_${field}`) }))}
                    onChange={(field) => update(indicator.id, { field: field as Price_Field })}
                  />
                </div>
              )}

              {hasShift(indicator.kind) && (
                <div className="Mini_Field Mini_Field_Number">
                  <label htmlFor={`${id}-shift`}>{t('trading.indicatorShift')}</label>
                  <Global_Input
                    id={`${id}-shift`}
                    type="number"
                    value={indicator.shift}
                    onChange={(e) => update(indicator.id, { shift: e.target.value })}
                  />
                </div>
              )}

              {hasSmoothing(indicator.kind) && (
                <div className="Mini_Field Mini_Field_Kind">
                  <label htmlFor={`${id}-smoothing`}>{t('trading.rsiAverage')}</label>
                  <Global_Dropdown
                    id={`${id}-smoothing`}
                    value={indicator.smoothing}
                    searchable={false}
                    options={[
                      { value: '', label: t('trading.rsiAverageNone') },
                      ...SMOOTHING_KINDS.map((kind) => ({ value: kind, label: t(`trading.kindLong_${kind}`) })),
                    ]}
                    onChange={(smoothing) => update(indicator.id, { smoothing: smoothing as Smoothing_Kind | '' })}
                  />
                </div>
              )}

              {hasSmoothing(indicator.kind) && indicator.smoothing && (
                <div className="Mini_Field Mini_Field_Value">
                  <label htmlFor={`${id}-smoothing-period`}>{t('trading.rsiAveragePeriod')}</label>
                  <Global_Input
                    id={`${id}-smoothing-period`}
                    type="number"
                    value={indicator.smoothingPeriod}
                    onChange={(e) => update(indicator.id, { smoothingPeriod: e.target.value })}
                  />
                </div>
              )}

              {!profile && (
                <div className="Mini_Field">
                  <label htmlFor={`${id}-timeframe`}>{t('trading.chartTimeframe')}</label>
                  <Global_Dropdown
                    id={`${id}-timeframe`}
                    value={indicator.timeframe}
                    searchable={false}
                    maxVisibleOptions={8}
                    options={timeframeOptions}
                    onChange={(timeframe) => update(indicator.id, { timeframe: timeframe as Timeframe | '' })}
                  />
                </div>
              )}

              <button
                type="button"
                className="Row_Action Danger Indicator_Remove"
                onClick={() => onChange(indicators.filter((item) => item.id !== indicator.id))}
                disabled={used}
                title={used ? t('trading.indicatorInUse') : t('trading.removeIndicator')}
                aria-label={t('trading.removeIndicator')}
              >
                <Trash />
              </button>

              {profile && <span className="Indicator_Hint">{t('trading.profileIndicatorHint')}</span>}

              {indicatorProblem(indicator) && (
                <span className="Simulator_Error Indicator_Error">{t(indicatorProblem(indicator)!)}</span>
              )}
              {!isSimulationKind(indicator.kind) && (
                <span className="Simulator_Error Indicator_Error">
                  {t('trading.indicatorKindGone', { kind: t(`trading.kindLong_${indicator.kind}`) })}
                </span>
              )}
            </div>
          );
        })}

        <button type="button" className="Add_Condition" onClick={onAdd} disabled={indicators.length >= MAX_INDICATORS}>
          <Plus />
          {t('trading.addIndicator')}
        </button>
      </div>
    </div>
  );
};

export default Indicators_Card;
