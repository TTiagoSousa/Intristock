import { useTranslation } from 'react-i18next';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import type {
  Profile_Level,
  Profile_Source,
  Session_Level,
  Timeframe,
  Window_Kind,
} from '../../../../Hooks/Trading/useSimulation';
import { useIndicators } from './indicatorsContext';
import {
  CANDLES_BACK_SHOWN,
  MAX_INDICATORS,
  SESSIONS_BACK_SHOWN,
  SESSION_LEVELS,
  TIMEFRAMES,
  WINDOW_KINDS,
  WINDOW_SOURCES,
  candleSources,
  isCountKind,
  isPriceIndicator,
  isProfile,
  isProfilePrice,
  isRangeLevel,
} from './simulationForm';
import type { Candle_Source, Indicator_Form, Value_Form } from './simulationForm';
import { averageLabel, backLabel, indicatorLabel } from './valueLabels';

// Os níveis do perfil na lista, pela ordem: os da sessão anterior, os em
// desenvolvimento, os virgens e, fora dos preços, o delta e o volume da linha
const PROFILE_CHOICES: [Profile_Level, Profile_Source][] = [
  ['poc', 'session'],
  ['vah', 'session'],
  ['val', 'session'],
  ['poc', 'developing'],
  ['vah', 'developing'],
  ['val', 'developing'],
  ['poc', 'naked'],
  ['vah', 'naked'],
  ['val', 'naked'],
  ['delta', 'session'],
  ['delta', 'developing'],
  ['rowVolume', 'session'],
  ['rowVolume', 'developing'],
];

interface Value_Editor_Props {
  id: string;
  value: Value_Form;
  onChange: (value: Value_Form) => void;
  // Um preço de entrada ou saída: oferece o mercado e tira o volume
  priceOnly?: boolean;
  // Do outro lado está um RSI (de 0 a 100): o valor fixo vem primeiro na lista
  preferNumber?: boolean;
  // Visível nos preços ("Preço"); nas condições fica só para o leitor de ecrã
  label: string;
  showLabel?: boolean;
}

// O valor da lista: 'market', 'number', 'candle:close', 'ind:<id>', 'avg:<id>' (a média do
// RSI), 'win:highest' (as últimas N velas), 'session:day_high' (um nível do dia) ou
// 'prof:<id>:poc:session' (um nível do perfil de volume: o nível e de que sessão)
const encode = (form: Value_Form, indicators: Indicator_Form[]) => {
  if (form.kind === 'candle') return `candle:${form.source}`;
  if (form.kind === 'indicator' && indicators.some((item) => item.id === form.indicatorId && isProfile(item.kind))) {
    return `prof:${form.indicatorId}:${form.profileLevel}:${form.profileSource}`;
  }
  if (form.kind === 'indicator') return `${form.line === 'average' ? 'avg' : 'ind'}:${form.indicatorId}`;
  if (form.kind === 'window') return `win:${form.windowKind}`;
  if (form.kind === 'session') return `session:${form.level}`;
  return form.kind;
};

/**
 * Um valor: uma vela (abertura atual, abertura, máxima, mínima, fecho, volume),
 * um dos indicadores, um valor fixo ou (nos preços) o mercado. Ao lado, sempre
 * à vista, de que vela (a última fechada, há N velas) e, nas velas, de que
 * tempo gráfico — o indicador traz o seu. Num preço não entram o volume nem o
 * RSI. Um RSI com a média ligada nos Indicadores tem também a linha dela.
 * Também as últimas N velas (a máxima e a mínima delas, as verdes e as
 * vermelhas — estas não são preços) e os níveis do dia e da semana. O perfil
 * de volume tem um grupo na lista com cada nível já escolhido — o POC, o VAH e o
 * VAL da sessão anterior, em desenvolvimento ou virgens (e, fora dos preços, o
 * delta e o volume da linha do fecho) —, só com um perfil nos Indicadores.
 * Numa sessão acabada escolhe-se ao lado qual (a anterior, há N).
 */
const Value_Editor = ({
  id,
  value,
  onChange,
  priceOnly = false,
  preferNumber = false,
  label,
  showLabel = false,
}: Value_Editor_Props) => {
  const { t } = useTranslation();
  const { indicators, addIndicator } = useIndicators();

  const numberOption = { value: 'number', label: t('trading.numberValue'), group: t('trading.groupOther') };

  // O perfil de volume: cada nível de cada perfil que está nos Indicadores (sem nenhum, nada)
  const profiles = indicators.filter((indicator) => isProfile(indicator.kind));
  const profileOptions = profiles.map((item) => item.id).flatMap((profileId) => {
    const named = profiles.length > 1 ? profiles.find((item) => item.id === profileId) : null;
    const group = named ? `${t('trading.groupProfile')} · ${indicatorLabel(named, t)}` : t('trading.groupProfile');
    return PROFILE_CHOICES.filter(([level]) => !priceOnly || isProfilePrice(level)).map(([level, source]) => ({
      value: `prof:${profileId}:${level}:${source}`,
      label: t(`trading.profileOption_${source}`, { level: t(`trading.profileLevel_${level}`) }),
      group,
    }));
  });
  const options = [
    ...(priceOnly ? [{ value: 'market', label: t('trading.kind_market') }] : []),
    ...(preferNumber ? [numberOption] : []),
    ...candleSources(priceOnly).map((source) => ({
      value: `candle:${source}`,
      label: t(`trading.source_${source}`),
      group: t('trading.groupCandle'),
    })),
    // Um RSI com média ligada nos Indicadores dá duas linhas: a dele e a da média
    // (o perfil de volume tem o grupo dele)
    ...indicators
      .filter((indicator) => !isProfile(indicator.kind) && (!priceOnly || isPriceIndicator(indicator.kind)))
      .flatMap((indicator) => [
        { value: `ind:${indicator.id}`, label: indicatorLabel(indicator, t), group: t('trading.groupIndicators') },
        ...(indicator.kind === 'rsi' && indicator.smoothing
          ? [{ value: `avg:${indicator.id}`, label: averageLabel(indicator, t), group: t('trading.groupIndicators') }]
          : []),
      ]),
    // As últimas N velas e os níveis do dia (as contagens não são preços)
    ...WINDOW_KINDS.filter((kind) => !priceOnly || !isCountKind(kind)).map((kind) => ({
      value: `win:${kind}`,
      label: t(`trading.window_${kind}`),
      group: t('trading.groupWindow'),
    })),
    ...SESSION_LEVELS.map((level) => ({
      value: `session:${level}`,
      label: t(`trading.session_${level}`),
      group: t('trading.groupSession'),
    })),
    ...profileOptions,
    ...(preferNumber ? [] : [numberOption]),
  ];

  const choose = (choice: string) => {
    if (choice.startsWith('candle:')) {
      onChange({ ...value, kind: 'candle', source: choice.slice(7) as Candle_Source });
    } else if (choice.startsWith('win:')) {
      const windowKind = choice.slice(4) as Window_Kind;
      // A máxima lê-se das máximas e a mínima das mínimas, a não ser que já se tenha escolhido outro campo
      const keep = value.kind === 'window' && WINDOW_SOURCES.includes(value.source as never);
      const source = keep ? value.source : windowKind === 'lowest' ? 'low' : 'high';
      onChange({ ...value, kind: 'window', windowKind, source });
    } else if (choice.startsWith('session:')) {
      onChange({ ...value, kind: 'session', level: choice.slice(8) as Session_Level });
    } else if (choice.startsWith('prof:')) {
      const [, profileId, profileLevel, profileSource] = choice.split(':');
      onChange({
        ...value,
        kind: 'indicator',
        indicatorId: profileId,
        line: 'value',
        profileLevel: profileLevel as Profile_Level,
        profileSource: profileSource as Profile_Source,
        // Ao escolher outro, uma sessão acabada volta a ser a anterior
        sessionsBack: profileSource === value.profileSource ? value.sessionsBack : '1',
      });
    } else if (choice.startsWith('ind:') || choice.startsWith('avg:')) {
      const line = choice.startsWith('avg:') ? 'average' : 'value';
      onChange({ ...value, kind: 'indicator', indicatorId: choice.slice(4), line });
    } else {
      onChange({ ...value, kind: choice as Value_Form['kind'] });
    }
  };

  // A abertura atual é sempre a da vela que começa: não tem "que vela"
  const withBack =
    value.kind === 'indicator' || value.kind === 'window' || (value.kind === 'candle' && value.source !== 'open_current');
  const withTimeframe = value.kind === 'candle' || value.kind === 'window';
  const withSource = value.kind === 'window' && !isCountKind(value.windowKind);
  const withRange = value.kind === 'session' && isRangeLevel(value.level);
  const withProfile =
    value.kind === 'indicator' &&
    indicators.some((indicator) => indicator.id === value.indicatorId && isProfile(indicator.kind));

  // Numa sessão acabada: qual (a anterior, há 2 sessões, …)
  const withSessionsBack = withProfile && value.profileSource === 'session';
  const sessionsBackOptions = Array.from({ length: SESSIONS_BACK_SHOWN }, (_, index) => ({
    value: String(index + 1),
    label: t('trading.profileBack', { count: index + 1 }),
  }));

  const backOptions = Array.from({ length: CANDLES_BACK_SHOWN }, (_, back) => ({
    value: back,
    label: back === 0 ? t('trading.candleLast') : backLabel(back, t),
  }));
  const timeframeOptions = [
    { value: '', label: t('trading.tfChart') },
    ...TIMEFRAMES.map((timeframe) => ({ value: timeframe, label: t(`trading.tf_${timeframe}`) })),
  ];

  return (
    <div className="Value_Editor">
      {/* Os níveis do perfil têm nomes mais compridos ("VAL em desenvolvimento") */}
      <div className={`Mini_Field Value_Main${withProfile ? ' Wide' : ''}`}>
        <label htmlFor={`${id}-value`} className={showLabel ? undefined : 'Hidden_Label'}>
          {label}
        </label>
        <Global_Dropdown
          id={`${id}-value`}
          value={encode(value, indicators)}
          searchable={false}
          maxVisibleOptions={9}
          placeholder={t('trading.indicatorMissing')}
          options={options}
          onChange={(choice) => choose(String(choice))}
          action={
            indicators.length < MAX_INDICATORS
              ? {
                  label: t('trading.newIndicator'),
                  onClick: () =>
                    onChange({ ...value, kind: 'indicator', indicatorId: addIndicator(), back: 0, line: 'value' }),
                }
              : undefined
          }
        />
      </div>

      {value.kind === 'number' && (
        <div className="Mini_Field Mini_Field_Value">
          <label htmlFor={`${id}-number`} className="Hidden_Label">
            {t('trading.value')}
          </label>
          <Global_Input
            id={`${id}-number`}
            type="number"
            value={value.value}
            onChange={(e) => onChange({ ...value, value: e.target.value })}
          />
        </div>
      )}

      {value.kind === 'window' && (
        <div className="Mini_Field Mini_Field_Number" title={t('trading.windowBarsHint')}>
          <label htmlFor={`${id}-period`} className={showLabel ? undefined : 'Hidden_Label'}>
            {t('trading.windowBars')}
          </label>
          <Global_Input
            id={`${id}-period`}
            type="number"
            value={value.period}
            onChange={(e) => onChange({ ...value, period: e.target.value })}
          />
        </div>
      )}

      {withSource && (
        <div className="Mini_Field Value_Source">
          <label htmlFor={`${id}-source`} className={showLabel ? undefined : 'Hidden_Label'}>
            {t('trading.windowSource')}
          </label>
          <Global_Dropdown
            id={`${id}-source`}
            value={value.source}
            searchable={false}
            options={WINDOW_SOURCES.map((source) => ({ value: source, label: t(`trading.source_${source}`) }))}
            onChange={(source) => onChange({ ...value, source: source as Candle_Source })}
          />
        </div>
      )}

      {withRange && (
        <>
          <div className="Mini_Field Value_Range_Start" title={t('trading.rangeHint')}>
            <label htmlFor={`${id}-range-start`} className={showLabel ? undefined : 'Hidden_Label'}>
              {t('trading.rangeStart')}
            </label>
            <Global_Input
              id={`${id}-range-start`}
              type="time"
              value={value.rangeStart}
              onChange={(e) => onChange({ ...value, rangeStart: e.target.value })}
            />
          </div>
          <div className="Mini_Field Mini_Field_Number" title={t('trading.rangeHint')}>
            <label htmlFor={`${id}-range-minutes`} className={showLabel ? undefined : 'Hidden_Label'}>
              {t('trading.rangeMinutes')}
            </label>
            <Global_Input
              id={`${id}-range-minutes`}
              type="number"
              value={value.rangeMinutes}
              onChange={(e) => onChange({ ...value, rangeMinutes: e.target.value })}
            />
          </div>
        </>
      )}

      {withSessionsBack && (
        <div className="Mini_Field Value_Profile_Source" title={t('trading.profileSourceHint')}>
          <label htmlFor={`${id}-profile-back`} className={showLabel ? undefined : 'Hidden_Label'}>
            {t('trading.profileSourceLabel')}
          </label>
          <Global_Dropdown
            id={`${id}-profile-back`}
            value={value.sessionsBack}
            searchable={false}
            maxVisibleOptions={8}
            options={sessionsBackOptions}
            onChange={(back) => onChange({ ...value, sessionsBack: String(back) })}
          />
        </div>
      )}

      {withBack && (
        <div className="Mini_Field Value_Back">
          <label htmlFor={`${id}-back`} className={showLabel ? undefined : 'Hidden_Label'}>
            {t('trading.whichCandle')}
          </label>
          <Global_Dropdown
            id={`${id}-back`}
            value={value.back}
            searchable={false}
            maxVisibleOptions={8}
            options={backOptions}
            onChange={(back) => onChange({ ...value, back: Number(back) })}
          />
        </div>
      )}

      {withTimeframe && (
        <div className="Mini_Field Value_Timeframe">
          <label htmlFor={`${id}-timeframe`} className={showLabel ? undefined : 'Hidden_Label'}>
            {t('trading.chartTimeframe')}
          </label>
          <Global_Dropdown
            id={`${id}-timeframe`}
            value={value.timeframe}
            searchable={false}
            maxVisibleOptions={8}
            options={timeframeOptions}
            onChange={(timeframe) => onChange({ ...value, timeframe: timeframe as Timeframe | '' })}
          />
        </div>
      )}
    </div>
  );
};

export default Value_Editor;
