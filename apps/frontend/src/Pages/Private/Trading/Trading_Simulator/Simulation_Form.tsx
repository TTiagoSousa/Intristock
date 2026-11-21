import { useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import { Plus } from '../../../../Imports/icons';
import type { Fee_Mode, Margin_Mode, Simulation_Payload, Timeframe } from '../../../../Hooks/Trading/useSimulation';
import type { Market_Instrument } from '../../../../Hooks/Trading/useMarketInstruments';
import Instrument_Picker from './Instrument_Picker';
import Entry_Card from './Entry_Card';
import Guards_Editor from './Guards_Editor';
import Indicators_Card from './Indicators_Card';
import Option_Row from './Option_Row';
import Segmented from './Segmented';
import { SETTINGS_TABS } from './runTabs';
import type { Run_Tab } from './runTabs';
import { Indicators_Context } from './indicatorsContext';
import { autoIndicatorName, nameIndicators, uniqueName } from './valueLabels';
import { formatDay } from './format';
import {
  DEFAULT_FEE_PCT,
  FEE_MODES,
  MAX_INDICATORS,
  TIMEFRAMES,
  copyEntry,
  dataStart,
  entryProblem,
  indicatorInUse,
  indicatorProblem,
  missingIndicators,
  unavailableIndicators,
  moveItem,
  newEntry,
  newIndicator,
  toDateInput,
  toPayload,
} from './simulationForm';
import type { Simulation_Form_State } from './simulationForm';
import { TIMEZONES, brokerFees, guardOk, optionAvailable, optionErrors } from './strategyOptions';
import type { Option_Key } from './strategyOptions';
import { localeOf } from '../../../../utils/locale';

const MAX_ENTRIES = 5;

// No simulador só existem os do formulário e o Resultado; na página de uma
// simulação, também as vistas dela (escolhidas na barra lateral)
type Tab = Run_Tab;

// As opções de cada separador, por secção, pela ordem em que aparecem
const TAB_OPTIONS: Record<'general' | 'rules', { title: string; options: Option_Key[] }[]> = {
  general: [
    { title: 'trading.sectionCapital', options: ['deposits'] },
    { title: 'trading.sectionFutures', options: ['funding'] },
    { title: 'trading.sectionOrders', options: ['execution', 'slippage', 'orderSize'] },
    { title: 'trading.sectionValidation', options: ['outOfSample', 'propFirm'] },
  ],
  rules: [
    { title: 'trading.sectionPositions', options: ['positions', 'opposite', 'cooldown'] },
    { title: 'trading.sectionSizing', options: ['sizingRules'] },
    { title: 'trading.sectionWhen', options: ['schedule', 'excluded'] },
  ],
};

// Em que separador vive cada opção
const tabOf = (option: Option_Key): Tab =>
  TAB_OPTIONS.general.some((section) => section.options.includes(option)) ? 'general' : 'rules';

const TIMEZONE_OPTIONS = TIMEZONES.map((zone) => ({ value: zone, label: zone }));

interface Simulation_Form_Props {
  initial: Simulation_Form_State;
  busy: boolean;
  error: string | null;
  onSubmit: (payload: Simulation_Payload) => void;
  // O estado ou o resultado da simulação aberta (separador Resultado); muda de
  // separador sozinho quando aparece uma simulação nova
  result: ReactNode;
  runId: string | null;
  // simulator = os separadores do formulário em linha; run = a página de uma
  // simulação, com o formulário dentro do Settings e as vistas dela à volta
  layout?: 'simulator' | 'run';
  // Na página de uma simulação, o que mostra cada vista dela (Gráfico…)
  views?: Partial<Record<Tab, ReactNode>>;
  // Na página de uma simulação o separador vem de fora (o endereço)
  tab?: Tab;
  onTabChange?: (tab: Tab) => void;
}

/**
 * O simulador como uma ficha, em separadores: Geral (mercado, conta, capital,
 * futuros, execução), Indicadores, Estratégia (as entradas, cada uma com o seu
 * capital, alavancagem, horários e saídas), Regras (o que vale para todas: não
 * operar se, posições, sinal contrário, horários) e o Resultado. Ao lado, o
 * resumo do que vai ser simulado com o Simular.
 */
const Simulation_Form = ({
  initial,
  busy,
  error,
  onSubmit,
  result,
  runId,
  layout = 'simulator',
  views,
  tab: controlledTab,
  onTabChange,
}: Simulation_Form_Props) => {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  // Os indicadores sem nome (de simulações antigas) ficam já com o automático
  const [form, setForm] = useState(() => ({ ...initial, indicators: nameIndicators(initial.indicators, t) }));
  // Na página de uma simulação, o resultado abre no Resumo
  const resultTab: Tab = layout === 'run' ? 'summary' : 'result';
  const [ownTab, setOwnTab] = useState<Tab>(runId ? resultTab : 'general');
  const tab = controlledTab ?? ownTab;
  const setTab = (next: Tab) => (onTabChange ? onTabChange(next) : setOwnTab(next));
  // Uma simulação nova (Simular) abre o resultado (na página de uma simulação,
  // a nova abre noutro endereço, já no Resumo)
  const [seenRun, setSeenRun] = useState(runId);
  if (runId !== seenRun) {
    setSeenRun(runId);
    if (runId) setOwnTab(resultTab);
  }
  const today = toDateInput(new Date());

  const set = <K extends keyof Simulation_Form_State>(key: K, value: Simulation_Form_State[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const marketFees = brokerFees(form.instrument);

  // Ao mudar de mercado, as comissões passam às da corretora dele, se ainda forem
  // as do mercado anterior (ou as iniciais): as que se escreveram à mão ficam
  const chooseInstrument = (instrument: Market_Instrument) =>
    setForm((prev) => {
      const fees = brokerFees(instrument);
      const before = brokerFees(prev.instrument)?.taker ?? DEFAULT_FEE_PCT;
      const untouched = prev.feeMode === 'both' && Number(prev.feePct.replace(',', '.')) === before;
      if (!fees || !untouched) return { ...prev, instrument };
      return { ...prev, instrument, feePct: String(fees.taker), feeExitPct: String(fees.taker) };
    });
  const setOptions = (patch: Partial<Simulation_Form_State['options']>) => set('options', { ...form.options, ...patch });

  // No spot não há venda a descoberto nem alavancagem
  const spot = form.instrument?.type === 'spot';
  const futures = Boolean(form.instrument && !spot);
  const quote = form.instrument?.quote ?? '';
  const pyramid = form.options.enabled.includes('positions');

  // Cria um indicador (do separador ou do "+ Novo indicador" de uma lista) e devolve o id
  // Vem com o nome automático ("MM21", ou "MM21 (2)" se já houver um), que se pode trocar
  const addIndicator = () => {
    const indicator = newIndicator({});
    setForm((prev) => {
      if (prev.indicators.length >= MAX_INDICATORS) return prev;
      const name = uniqueName(
        autoIndicatorName(indicator, t),
        prev.indicators.map((item) => item.name),
      );
      return { ...prev, indicators: [...prev.indicators, { ...indicator, name }] };
    });
    return indicator.id;
  };

  const validRange = Boolean(form.from && form.to && form.from <= form.to);
  const indicatorsOk =
    form.indicators.every((indicator) => !indicatorProblem(indicator)) &&
    !missingIndicators(form) &&
    !unavailableIndicators(form);
  const errors = optionErrors(form.options, form.instrument);
  const entryProblems = form.entries.map((entry) => entryProblem(form, entry));
  const guardsOk = form.options.guards.every(guardOk);

  // O que ainda impede de simular, com o separador onde se resolve
  const problems: { tab: Tab; text: string }[] = [
    ...(!form.instrument ? [{ tab: 'general' as Tab, text: t('trading.chooseInstrument') }] : []),
    ...(!validRange ? [{ tab: 'general' as Tab, text: t('trading.invalidRange') }] : []),
    ...(!indicatorsOk ? [{ tab: 'indicators' as Tab, text: t('trading.problemIndicators') }] : []),
    ...entryProblems.flatMap((problem, index) =>
      problem
        ? [{ tab: 'strategy' as Tab, text: `${t('trading.entryTitle', { position: index + 1 })}: ${t(problem, { max: form.options.maxPositions })}` }]
        : [],
    ),
    ...(!guardsOk ? [{ tab: 'rules' as Tab, text: t('trading.problemGuards') }] : []),
    ...Object.keys(errors).map((key) => ({
      tab: tabOf(key as Option_Key),
      text: `${t(`trading.opt_${key}`)}: ${t(errors[key as Option_Key]!)}`,
    })),
  ];
  const canSubmit = !problems.length && !busy;

  const available = (key: Option_Key) => optionAvailable(key, form.instrument);
  const activeOptions = form.options.enabled.filter(available);
  const warmupFrom = validRange ? dataStart(form) : null;

  const countIn = (key: 'general' | 'rules') =>
    TAB_OPTIONS[key].flatMap((section) => section.options).filter((option) => activeOptions.includes(option)).length;
  // O resumo e o Simular só ao lado dos separadores do formulário
  const formTab = SETTINGS_TABS.includes(tab);
  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'general', label: t('trading.tab_general'), count: countIn('general') },
    { key: 'indicators', label: t('trading.indicators'), count: form.indicators.length },
    { key: 'strategy', label: t('trading.tabStrategy'), count: form.entries.length },
    { key: 'rules', label: t('trading.tab_rules'), count: countIn('rules') + form.options.guards.length },
    ...(result ? [{ key: 'result' as Tab, label: t('trading.result') }] : []),
  ];

  const optionRows = (options: Option_Key[]) => (
    <div className="Option_Rows">
      {options.filter(available).map((option) => (
        <Option_Row
          key={option}
          option={option}
          options={form.options}
          onChange={(options) => set('options', options)}
          instrument={form.instrument}
          error={errors[option]}
        />
      ))}
    </div>
  );

  const optionSection = (section: { title: string; options: Option_Key[] }, extra?: ReactNode) => {
    if (!section.options.some(available) && !extra) return null;
    return (
      <section key={section.title} className="Sim_Section">
        <h2 className="Sim_Section_Title">{t(section.title)}</h2>
        {extra}
        {section.options.some(available) && optionRows(section.options)}
      </section>
    );
  };

  // O resumo à direita: o essencial e as opções ligadas
  const pair = form.instrument ? `${form.instrument.asset.ticker ?? form.instrument.symbol}/${form.instrument.quote}` : '—';
  const summary: { label: string; value: string }[] = [
    { label: t('trading.instrument'), value: form.instrument ? `${pair} · ${t(`trading.tf_${form.timeframe}`)}` : '—' },
    {
      label: t('trading.period'),
      value: validRange ? `${formatDay(form.from, language)} – ${formatDay(form.to, language)}` : '—',
    },
    { label: t('trading.initialCapital'), value: `${form.initialCapital || '—'} ${quote}` },
    {
      label: t('trading.feePct'),
      value: form.feeMode === 'custom' ? `${form.feePct || 0}% / ${form.feeExitPct || 0}%` : `${form.feePct || 0}%`,
    },
    { label: t('trading.compounding'), value: t(`trading.compoundingShort_${form.compounding ? 'yes' : 'no'}`) },
    {
      label: t('trading.tabStrategy'),
      value: t('trading.summaryStrategy', { indicators: form.indicators.length, entries: form.entries.length }),
    },
    { label: t('trading.guardsTitle'), value: String(form.options.guards.length) },
  ];

  return (
    <div className="Sim_Page">
      {layout === 'simulator' && (
      <div className="Sim_Tabs" role="tablist">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            className={`${tab === item.key ? 'Active' : ''}${problems.some((problem) => problem.tab === item.key) ? ' Has_Problem' : ''}`}
            onClick={() => setTab(item.key)}
          >
            {item.label}
            {item.count ? <span className="Sim_Tab_Count">{item.count}</span> : null}
          </button>
        ))}
      </div>
      )}

      <div className={`Sim_Layout${formTab ? '' : ' Full'}`}>
        <div className="Sim_Main">
          {tab === 'general' && (
            <div className="Page_Card Sim_Panel">
              <section className="Sim_Section">
                <h2 className="Sim_Section_Title">{t('trading.sectionMarket')}</h2>
                <div className="Sim_Fields">
                  <div className="Simulator_Field Sim_Field_Wide">
                    <label htmlFor="trading-instrument">{t('trading.instrument')}</label>
                    <Instrument_Picker value={form.instrument} onChange={chooseInstrument} />
                  </div>

                  <div className="Simulator_Field">
                    <label htmlFor="trading-timeframe">{t('trading.timeframe')}</label>
                    <Global_Dropdown
                      id="trading-timeframe"
                      value={form.timeframe}
                      searchable={false}
                      maxVisibleOptions={7}
                      options={TIMEFRAMES.map((timeframe) => ({ value: timeframe, label: t(`trading.tf_${timeframe}`) }))}
                      onChange={(timeframe) => set('timeframe', timeframe as Timeframe)}
                    />
                  </div>

                  <div className="Simulator_Field">
                    <label htmlFor="trading-from">{t('trading.from')}</label>
                    <Global_Input id="trading-from" type="date" value={form.from} onChange={(e) => set('from', e.target.value)} />
                  </div>

                  <div className="Simulator_Field">
                    <label htmlFor="trading-to">{t('trading.to')}</label>
                    <Global_Input id="trading-to" type="date" value={form.to} onChange={(e) => set('to', e.target.value)} />
                  </div>

                  <div className="Simulator_Field">
                    <label htmlFor="trading-timezone">{t('trading.timezone')}</label>
                    <Global_Dropdown
                      id="trading-timezone"
                      value={form.options.timezone}
                      maxVisibleOptions={8}
                      options={TIMEZONE_OPTIONS}
                      onChange={(zone) => setOptions({ timezone: String(zone) })}
                    />
                  </div>
                </div>
                {!validRange && <span className="Simulator_Error">{t('trading.invalidRange')}</span>}
                <span className="Simulator_Hint">{t('trading.timezoneHint')}</span>
              </section>

              <section className="Sim_Section">
                <h2 className="Sim_Section_Title">{t('trading.account')}</h2>
                <div className="Sim_Fields">
                  <div className="Simulator_Field">
                    <label htmlFor="trading-capital">
                      {t('trading.initialCapital')}
                      {quote && <em> ({quote})</em>}
                    </label>
                    <Global_Input
                      id="trading-capital"
                      type="number"
                      value={form.initialCapital}
                      onChange={(e) => set('initialCapital', e.target.value)}
                    />
                  </div>

                  <div className="Simulator_Field">
                    <label htmlFor="trading-fee-mode">{t('trading.feeMode')}</label>
                    <Global_Dropdown
                      id="trading-fee-mode"
                      value={form.feeMode}
                      searchable={false}
                      options={FEE_MODES.map((mode) => ({ value: mode, label: t(`trading.feeMode_${mode}`) }))}
                      onChange={(mode) => set('feeMode', mode as Fee_Mode)}
                    />
                  </div>

                  <div className="Simulator_Field">
                    <label htmlFor="trading-fee">
                      {form.feeMode === 'custom' ? t('trading.feeEntryExitPct') : t('trading.feePct')}
                    </label>
                    <div className="Fee_Inputs">
                      <Global_Input id="trading-fee" type="number" value={form.feePct} onChange={(e) => set('feePct', e.target.value)} />
                      {form.feeMode === 'custom' && (
                        <Global_Input
                          id="trading-fee-exit"
                          type="number"
                          value={form.feeExitPct}
                          onChange={(e) => set('feeExitPct', e.target.value)}
                        />
                      )}
                    </div>
                  </div>

                  <div className="Simulator_Field">
                    <span className="Simulator_Label">{t('trading.compounding')}</span>
                    <Segmented
                      label={t('trading.compounding')}
                      value={form.compounding ? 'yes' : 'no'}
                      options={[
                        { value: 'yes', label: t('trading.compoundingShort_yes') },
                        { value: 'no', label: t('trading.compoundingShort_no') },
                      ]}
                      onChange={(choice) => set('compounding', choice === 'yes')}
                    />
                  </div>
                </div>
                <span className="Simulator_Hint">
                  {t(`trading.feeModeHint_${form.feeMode}`)} {t(`trading.compoundingHint_${form.compounding ? 'yes' : 'no'}`)}
                  {marketFees &&
                    ` ${t('trading.feeBrokerHint', {
                      broker: t(`trading.feeBroker_${marketFees.key.replace(':', '_')}`),
                      maker: marketFees.maker.toLocaleString(localeOf(i18n.language), { maximumFractionDigits: 3 }),
                      taker: marketFees.taker.toLocaleString(localeOf(i18n.language), { maximumFractionDigits: 3 }),
                    })}`}
                </span>
              </section>

              {TAB_OPTIONS.general.map((section) =>
                section.title === 'trading.sectionFutures'
                  ? futures &&
                    optionSection(
                      section,
                      <>
                        <div className="Sim_Fields">
                          <div className="Simulator_Field">
                            <span className="Simulator_Label">{t('trading.marginMode')}</span>
                            <Segmented
                              label={t('trading.marginMode')}
                              value={form.options.marginMode}
                              options={(['isolated', 'cross'] as Margin_Mode[]).map((mode) => ({
                                value: mode,
                                label: t(`trading.margin_${mode}`),
                              }))}
                              onChange={(mode) => setOptions({ marginMode: mode })}
                            />
                          </div>
                          <div className="Simulator_Field">
                            <label htmlFor="trading-maintenance">
                              {t('trading.maintenancePct')}
                              <em> (%)</em>
                            </label>
                            <Global_Input
                              id="trading-maintenance"
                              type="number"
                              value={form.options.maintenancePct}
                              onChange={(e) => setOptions({ maintenancePct: e.target.value })}
                            />
                          </div>
                        </div>
                        <span className="Simulator_Hint">
                          {t(`trading.marginHint_${form.options.marginMode}`)} {t('trading.leverageInEntries')}
                        </span>
                      </>,
                    )
                  : optionSection(section),
              )}
            </div>
          )}

          {tab === 'indicators' && (
            <Indicators_Card
              indicators={form.indicators}
              onChange={(indicators) => set('indicators', indicators)}
              onAdd={() => addIndicator()}
              inUse={(id) => indicatorInUse(form.entries, id)}
            />
          )}

          {tab === 'strategy' && (
            <Indicators_Context.Provider value={{ indicators: form.indicators, addIndicator }}>
              <p className="Candle_Rule">{t('trading.candleRule')}</p>

              {form.entries.map((entry, index) => (
                <Entry_Card
                  key={entry.id}
                  entry={entry}
                  position={index + 1}
                  spot={spot}
                  quote={quote}
                  pyramid={pyramid}
                  maxPositions={Number(form.options.maxPositions) || 1}
                  problem={entryProblems[index]}
                  onChange={(next) => set('entries', form.entries.map((item) => (item.id === entry.id ? next : item)))}
                  onRemove={
                    form.entries.length > 1
                      ? () => set('entries', form.entries.filter((item) => item.id !== entry.id))
                      : undefined
                  }
                  onDuplicate={
                    form.entries.length < MAX_ENTRIES
                      ? () => set('entries', form.entries.toSpliced(index + 1, 0, copyEntry(entry)))
                      : undefined
                  }
                  onMoveUp={index > 0 ? () => set('entries', moveItem(form.entries, index, index - 1)) : undefined}
                  onMoveDown={
                    index < form.entries.length - 1
                      ? () => set('entries', moveItem(form.entries, index, index + 1))
                      : undefined
                  }
                />
              ))}

              <button
                type="button"
                className="Add_Condition Add_Entry"
                onClick={() =>
                  set('entries', [
                    ...form.entries,
                    newEntry(form.indicators, spot || form.entries.at(-1)?.side === 'short' ? 'long' : 'short'),
                  ])
                }
                disabled={form.entries.length >= MAX_ENTRIES}
              >
                <Plus />
                {t('trading.addEntry')}
              </button>
            </Indicators_Context.Provider>
          )}

          {tab === 'rules' && (
            <div className="Page_Card Sim_Panel">
              <section className="Sim_Section">
                <h2 className="Sim_Section_Title">{t('trading.guardsTitle')}</h2>
                <span className="Simulator_Hint">{t('trading.guardsHint')}</span>
                <Guards_Editor guards={form.options.guards} onChange={(guards) => setOptions({ guards })} quote={quote} />
              </section>
              {TAB_OPTIONS.rules.map((section) => optionSection(section))}
            </div>
          )}

          {tab === 'result' && result}
          {views?.[tab]}
        </div>

        {formTab && (
          <aside className="Sim_Summary">
            <div className="Page_Card">
              <div className="Card_Body Sim_Summary_Body">
                <span className="Sim_Summary_Title">{t('trading.summaryTitle')}</span>

                <dl className="Sim_Summary_List">
                  {summary.map((item) => (
                    <div key={item.label} className="Sim_Summary_Item">
                      <dt>{item.label}</dt>
                      <dd>{item.value}</dd>
                    </div>
                  ))}
                </dl>

                <div className="Sim_Summary_Options">
                  <span className="Sim_Summary_Label">{t('trading.options')}</span>
                  {activeOptions.length ? (
                    <div className="Sim_Summary_Chips">
                      {activeOptions.map((option) => (
                        <button key={option} type="button" className="Sim_Summary_Chip" onClick={() => setTab(tabOf(option))}>
                          {t(`trading.opt_${option}`)}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span className="Simulator_Hint">{t('trading.optionsNone')}</span>
                  )}
                </div>

                {warmupFrom && (
                  <span className="Simulator_Hint">
                    {t('trading.warmupHint', { date: formatDay(warmupFrom.getTime(), language) })}
                  </span>
                )}
                {form.to > today && <span className="Simulator_Hint">{t('trading.futureDateHint')}</span>}

                {problems.length > 0 && (
                  <ul className="Sim_Problems">
                    {problems.map((problem) => (
                      <li key={problem.text}>
                        <button type="button" onClick={() => setTab(problem.tab)}>
                          {problem.text}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {error && <span className="Simulator_Error">{error}</span>}

                <Simple_Button
                  text={t('trading.simulate')}
                  onClick={() => onSubmit(toPayload(form))}
                  disabled={!canSubmit}
                />
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};

export default Simulation_Form;
