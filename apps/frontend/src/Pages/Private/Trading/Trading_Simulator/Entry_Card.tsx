import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import { Arrow_Up, Copy, Plus, Trash } from '../../../../Imports/icons';
import type { Side, Sizing_Mode, Stop_Mode } from '../../../../Hooks/Trading/useSimulation';
import Collapse_Button from './Collapse_Button';
import Conditions_Editor from './Conditions_Editor';
import Context_Rules from './Context_Rules';
import Entry_Preview from './Entry_Preview';
import Exit_Block from './Exit_Block';
import Flow_Step from './Flow_Step';
import Partial_Exit from './Partial_Exit';
import Risk_Exit from './Risk_Exit';
import type { Risk_Exit_Kind } from './Risk_Exit';
import Scale_In from './Scale_In';
import Schedule_Toggle from './Schedule_Toggle';
import Segmented from './Segmented';
import Setup_Block from './Setup_Block';
import Stop_Rule from './Stop_Rule';
import Value_Editor from './Value_Editor';
import { useIndicators } from './indicatorsContext';
import {
  MAX_NAME,
  MAX_PARTIALS,
  MAX_SCALE_INS,
  MAX_STOP_RULES,
  SIZING_MODES,
  STOP_MODES,
  TAKE_MODES,
  hasStop,
  hasTake,
  newContext,
  newExit,
  newPartial,
  newScaleIn,
  newSetup,
  newStopRule,
  value,
} from './simulationForm';
import { valueLabel } from './valueLabels';
import type { Entry_Form, Take_Mode } from './simulationForm';
import type { Schedule_Form } from './strategyOptions';

// Os campos das saídas de valor no formulário
type Risk_Field = 'stopLossPct' | 'takeProfitPct' | 'trailingPct' | 'breakEvenPct' | 'maxBars';

const MAX_EXITS = 5;

interface Entry_Card_Props {
  entry: Entry_Form;
  position: number;
  // No spot só se compra e não há alavancagem
  spot: boolean;
  quote: string;
  // Com várias posições ligadas: quantas desta entrada ao mesmo tempo (até ao máximo geral)
  pyramid: boolean;
  maxPositions: number;
  // O que está mal fora das condições (chave da tradução), ou null
  problem: string | null;
  onChange: (entry: Entry_Form) => void;
  onRemove?: () => void;
  onDuplicate?: () => void;
  // Mudar de lugar: na mesma vela, as entradas veem-se pela ordem da lista
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

/**
 * Uma entrada da estratégia, em quatro passos: (1) quando entra — as
 * condições, todas, e os dias e horas em que entra ou não; (2) a que preço — ao
 * mercado ou uma ordem a um preço, que fica à espera N velas; (3) com quanto —
 * o capital, a alavancagem e as posições; (4) como sai — stop, take profit,
 * trailing, break-even, tempo e saídas com condição, cada um com o seu horário.
 * Ganha a saída que acontecer primeiro (daí o "ou"). No passo 1 pode haver uma
 * preparação (primeiro isto, depois as condições) e condições da conta ("só
 * entra se"); no 3, reforços; no 4, ajustes do stop. Fecha-se para ficar só o
 * cabeçalho, com um resumo.
 */
const Entry_Card = ({
  entry,
  position,
  spot,
  quote,
  pyramid,
  maxPositions,
  problem,
  onChange,
  onRemove,
  onDuplicate,
  onMoveUp,
  onMoveDown,
}: Entry_Card_Props) => {
  const { t } = useTranslation();
  const { indicators } = useIndicators();
  const side: Side = spot ? 'long' : entry.side;
  const id = `entry-${entry.id}`;
  const [open, setOpen] = useState(true);
  const atPrice = entry.price.kind !== 'market';

  const set = <K extends keyof Entry_Form>(key: K, next: Entry_Form[K]) => onChange({ ...entry, [key]: next });

  // O que se vê com o cartão fechado: "2 condições · Abertura (mercado) · 10% · Stop 2% · 1 saída"
  const pct = (text: string, label: string) => (text.trim() ? `${label} ${text}%` : null);
  const sizingText =
    entry.sizingMode === 'all'
      ? t('trading.sizing_all')
      : `${entry.sizingValue || '—'} ${entry.sizingMode === 'amount' ? quote : '%'}`;
  const stopText =
    entry.stopMode === 'pct'
      ? pct(entry.stopLossPct, t('trading.exit_stop_loss'))
      : `${t('trading.exit_stop_loss')} ${t(`trading.stopModeShort_${entry.stopMode}`, { count: Number(entry.stopBars) || 0 })}`;
  const takeText =
    entry.takeMode === 'r'
      ? entry.takeR.trim() && `${t('trading.exit_take_profit')} ${entry.takeR}R`
      : pct(entry.takeProfitPct, t('trading.exit_take_profit'));
  const summary = [
    t('trading.summaryConditions', { count: entry.conditions.length }),
    valueLabel(entry.price, indicators, t),
    sizingText,
    !spot && entry.leverage && entry.leverage !== '1' ? `${entry.leverage}×` : null,
    stopText,
    takeText,
    entry.setup ? t('trading.summarySetup') : null,
    entry.partials.length ? t('trading.summaryPartials', { count: entry.partials.length }) : null,
    entry.scaleIns.length ? t('trading.summaryScaleIns', { count: entry.scaleIns.length }) : null,
    entry.stopRules.length ? t('trading.summaryStopRules', { count: entry.stopRules.length }) : null,
    entry.exits.length ? t('trading.summaryExits', { count: entry.exits.length }) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  // As saídas de valor: só as ligadas aparecem; as outras ficam como botões
  // "+ Trailing stop", que as ligam com um valor para começar
  const riskExits: { kind: Risk_Exit_Kind; field: Risk_Field; start: string }[] = [
    { kind: 'stop_loss', field: 'stopLossPct', start: '2' },
    { kind: 'take_profit', field: 'takeProfitPct', start: '4' },
    { kind: 'trailing_stop', field: 'trailingPct', start: '2' },
    { kind: 'break_even', field: 'breakEvenPct', start: '1' },
    { kind: 'time', field: 'maxBars', start: '24' },
  ];
  // Ligada é a que tem valor ou foi ligada agora e ainda está vazia
  const [shown, setShown] = useState<Risk_Exit_Kind[]>([]);
  // O stop noutro modo e o take em R contam como ligados mesmo sem a %
  const isOn = (item: (typeof riskExits)[number]) =>
    (item.kind === 'stop_loss' ? hasStop(entry) : item.kind === 'take_profit' ? hasTake(entry) : entry[item.field].trim() !== '') ||
    shown.includes(item.kind);
  const turnOn = (item: (typeof riskExits)[number]) => {
    setShown((current) => [...current, item.kind]);
    if (item.kind === 'take_profit') onChange({ ...entry, takeMode: 'pct', takeProfitPct: item.start });
    else set(item.field, item.start);
  };
  const turnOff = (item: (typeof riskExits)[number]) => {
    setShown((current) => current.filter((kind) => kind !== item.kind));
    // Sem stop nem take profit, o horário deles também sai (e voltam à %)
    if (item.kind === 'stop_loss') onChange({ ...entry, stopMode: 'pct', stopLossPct: '', stopSchedule: null });
    else if (item.kind === 'take_profit') onChange({ ...entry, takeMode: 'pct', takeProfitPct: '', takeSchedule: null });
    else set(item.field, '');
  };

  // O stop na mínima (compra) ou máxima (venda) das últimas N velas, ou num nível, com a folga
  const stopFields =
    entry.stopMode === 'pct' ? undefined : (
      <>
        {entry.stopMode === 'swing' ? (
          <div className="Pct_Field Stop_Bars">
            <Global_Input id={`${id}-stop-bars`} type="number" value={entry.stopBars} onChange={(e) => set('stopBars', e.target.value)} />
            <label htmlFor={`${id}-stop-bars`}>{t('trading.candlesUnit')}</label>
          </div>
        ) : (
          <div className="Operand_Box">
            <Value_Editor
              id={`${id}-stop-level`}
              label={t('trading.stopLevel')}
              priceOnly
              value={entry.stopLevel}
              onChange={(level) => set('stopLevel', level)}
            />
          </div>
        )}
        <div className="Pct_Field Stop_Buffer" title={t('trading.stopBufferHint')}>
          <Global_Input
            id={`${id}-stop-buffer`}
            type="number"
            value={entry.stopBufferPct}
            placeholder={t('trading.stopBuffer')}
            onChange={(e) => set('stopBufferPct', e.target.value)}
          />
          <label htmlFor={`${id}-stop-buffer`}>%</label>
        </div>
      </>
    );
  const stopHint =
    entry.stopMode === 'swing'
      ? t(`trading.stopSwingHint_${side}`, { count: Number(entry.stopBars) || 0 })
      : entry.stopMode === 'level'
        ? t(`trading.stopLevelHint_${side}`)
        : undefined;

  // O nome, o horário e os modos, que só o stop e o take profit têm
  const extrasOf = (kind: Risk_Exit_Kind) => {
    if (kind === 'stop_loss') {
      return {
        name: entry.stopLossName,
        onNameChange: (name: string) => set('stopLossName', name),
        schedule: entry.stopSchedule,
        onScheduleChange: (schedule: Schedule_Form | null) => set('stopSchedule', schedule),
        modes: STOP_MODES.map((mode) => ({ value: mode, label: t(`trading.stopMode_${mode}`) })),
        mode: entry.stopMode,
        onModeChange: (mode: string) => set('stopMode', mode as Stop_Mode),
        fields: stopFields,
        hint: stopHint,
        active: hasStop(entry),
      };
    }
    if (kind === 'take_profit') {
      return {
        name: entry.takeProfitName,
        onNameChange: (name: string) => set('takeProfitName', name),
        schedule: entry.takeSchedule,
        onScheduleChange: (schedule: Schedule_Form | null) => set('takeSchedule', schedule),
        modes: TAKE_MODES.map((mode) => ({ value: mode, label: t(`trading.takeMode_${mode}`) })),
        mode: entry.takeMode,
        onModeChange: (mode: string) => set('takeMode', mode as Take_Mode),
        unit: entry.takeMode === 'r' ? 'R' : '%',
        hint: entry.takeMode === 'r' ? t('trading.takeRHint', { value: entry.takeR }) : undefined,
        active: hasTake(entry),
      };
    }
    return {};
  };
  // O valor de cada saída: o take em R vem de outro campo
  const valueOf = (item: (typeof riskExits)[number]) =>
    item.kind === 'take_profit' && entry.takeMode === 'r' ? entry.takeR : entry[item.field];
  const setValue = (item: (typeof riskExits)[number], next: string) =>
    item.kind === 'take_profit' && entry.takeMode === 'r' ? set('takeR', next) : set(item.field, next);

  const exits = [
    ...riskExits.filter(isOn).map((item) => (
      <Risk_Exit
        key={item.kind}
        id={`${id}-${item.kind}`}
        kind={item.kind}
        value={valueOf(item)}
        onValueChange={(next) => setValue(item, next)}
        onRemove={() => turnOff(item)}
        {...extrasOf(item.kind)}
      />
    )),
    ...entry.exits.map((exit, index) => (
      <Exit_Block
        key={exit.id}
        exit={exit}
        position={index + 1}
        onChange={(next) => set('exits', entry.exits.map((item) => (item.id === exit.id ? next : item)))}
        onRemove={() => set('exits', entry.exits.filter((item) => item.id !== exit.id))}
      />
    )),
  ];
  const missing = riskExits.filter((item) => !isOn(item));

  return (
    <div className={`Page_Card Entry_Card ${side}${open ? '' : ' Closed'}`}>
      <div className="Entry_Head">
        <Collapse_Button open={open} onToggle={() => setOpen((current) => !current)} controls={`${id}-flow`} />
        <span className="Entry_Tag">{t('trading.entryTitle', { position })}</span>
        <input
          className="Inline_Name Entry_Name"
          value={entry.name}
          maxLength={MAX_NAME}
          placeholder={t('trading.namePlaceholder')}
          aria-label={t('trading.name')}
          onChange={(e) => set('name', e.target.value)}
        />
        {!open && <span className="Collapsed_Summary">{summary}</span>}

        <div className="Entry_Header_Actions">
          <Entry_Preview entry={entry} position={position} spot={spot} />
          <div className="Side_Switch" role="group" aria-label={t('trading.side')}>
            {(['long', 'short'] as Side[]).map((option) => (
              <button
                key={option}
                type="button"
                className={`Side_Option ${option}${side === option ? ' Active' : ''}`}
                onClick={() => set('side', option)}
                disabled={option === 'short' && spot}
                title={option === 'short' && spot ? t('trading.shortSpotHint') : undefined}
              >
                {t(`trading.side_${option}`)}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="Row_Action"
            onClick={onMoveUp}
            disabled={!onMoveUp}
            title={t('trading.moveUp')}
            aria-label={t('trading.moveUp')}
          >
            <Arrow_Up />
          </button>
          <button
            type="button"
            className="Row_Action Flip"
            onClick={onMoveDown}
            disabled={!onMoveDown}
            title={t('trading.moveDown')}
            aria-label={t('trading.moveDown')}
          >
            <Arrow_Up />
          </button>
          {onDuplicate && (
            <button
              type="button"
              className="Row_Action"
              onClick={onDuplicate}
              title={t('trading.duplicateEntry')}
              aria-label={t('trading.duplicateEntry')}
            >
              <Copy />
            </button>
          )}
          {onRemove && (
            <button
              type="button"
              className="Row_Action Danger"
              onClick={onRemove}
              title={t('trading.removeEntry')}
              aria-label={t('trading.removeEntry')}
            >
              <Trash />
            </button>
          )}
        </div>
      </div>

      <div className="Entry_Flow" id={`${id}-flow`} hidden={!open}>
        <Flow_Step
          number={1}
          title={t('trading.enterWhen')}
          hint={t(entry.match === 'any' ? 'trading.enterWhenHint_any' : 'trading.enterWhenHint')}
        >
          {entry.setup && (
            <>
              <Setup_Block
                id={id}
                setup={entry.setup}
                onChange={(setup) => set('setup', setup)}
                onRemove={() => set('setup', null)}
              />
              <span className="Exit_Tile_Label">{t('trading.setupThen')}</span>
            </>
          )}
          <Conditions_Editor
            conditions={entry.conditions}
            onChange={(conditions) => set('conditions', conditions)}
            match={entry.match}
            onMatchChange={(match) => set('match', match)}
            minimum={1}
            addLabel={t('trading.addCondition')}
          />
          {entry.context.length > 0 && (
            <Context_Rules id={id} rules={entry.context} onChange={(context) => set('context', context)} />
          )}
          <div className="Entry_Extra_Adds">
            {!entry.setup && (
              <button type="button" className="Link_Button Schedule_Add" onClick={() => set('setup', newSetup(indicators))}>
                {t('trading.setupAdd')}
              </button>
            )}
            {entry.context.length === 0 && (
              <button type="button" className="Link_Button Schedule_Add" onClick={() => set('context', [newContext()])}>
                {t('trading.contextAddFirst')}
              </button>
            )}
          </div>
          <Schedule_Toggle
            schedule={entry.schedule}
            onChange={(schedule) => set('schedule', schedule)}
            addLabel={t('trading.scheduleAdd_entry')}
            defaultMode="except"
          />
        </Flow_Step>

        <Flow_Step number={2} title={t('trading.enterAt')}>
          <div className="Order_Options">
            <div className="Option_Field">
              <span className="Simulator_Label">{t('trading.orderType')}</span>
              <Segmented
                label={t('trading.orderType')}
                value={atPrice ? 'price' : 'market'}
                options={[
                  { value: 'market', label: t('trading.orderType_market') },
                  { value: 'price', label: t('trading.orderType_price') },
                ]}
                onChange={(choice) =>
                  set('price', choice === 'market' ? value({ kind: 'market' }) : value({ kind: 'candle', source: 'close' }))
                }
              />
            </div>

            {atPrice && (
              <>
                <div className="Operand_Box">
                  <Value_Editor
                    id={`${id}-price`}
                    label={t('trading.entryPrice')}
                    showLabel
                    priceOnly
                    value={entry.price}
                    onChange={(price) => set('price', price)}
                  />
                </div>
                <div className="Option_Field Option_Field_Small">
                  <label htmlFor={`${id}-bars`}>{t('trading.orderBars')}</label>
                  <Global_Input
                    id={`${id}-bars`}
                    type="number"
                    value={entry.orderBars}
                    onChange={(e) => set('orderBars', e.target.value)}
                  />
                </div>
                {Number(entry.orderBars) > 1 && (
                  <>
                    <div className="Option_Field">
                      <span className="Simulator_Label">{t('trading.orderLevel')}</span>
                      <Segmented
                        label={t('trading.orderLevel')}
                        value={entry.orderTrack ? 'track' : 'fixed'}
                        options={[
                          { value: 'fixed', label: t('trading.orderLevel_fixed') },
                          { value: 'track', label: t('trading.orderLevel_track') },
                        ]}
                        onChange={(choice) => set('orderTrack', choice === 'track')}
                      />
                    </div>
                    <div className="Option_Field">
                      <span className="Simulator_Label">{t('trading.orderCancel')}</span>
                      <Segmented
                        label={t('trading.orderCancel')}
                        value={entry.orderCancel ? 'cancel' : 'keep'}
                        options={[
                          { value: 'keep', label: t('trading.orderCancel_keep') },
                          { value: 'cancel', label: t('trading.orderCancel_cancel') },
                        ]}
                        onChange={(choice) => set('orderCancel', choice === 'cancel')}
                      />
                    </div>
                  </>
                )}
              </>
            )}
            <span className="Simulator_Hint">
              {atPrice
                ? `${t('trading.entryLevelHint')} ${t(
                    Number(entry.orderBars) > 1 ? 'trading.orderBarsHintMany' : 'trading.orderBarsHintOne',
                    { count: Number(entry.orderBars) || 1 },
                  )}`
                : t('trading.entryMarketHint')}
            </span>
          </div>
        </Flow_Step>

        <Flow_Step number={3} title={t('trading.enterWith')}>
          <div className="Order_Options">
            <div className="Option_Field">
              <label htmlFor={`${id}-sizing`}>{t('trading.sizing')}</label>
              <Global_Dropdown
                id={`${id}-sizing`}
                value={entry.sizingMode}
                searchable={false}
                options={SIZING_MODES.map((mode) => ({ value: mode, label: t(`trading.sizing_${mode}`) }))}
                onChange={(mode) => set('sizingMode', mode as Sizing_Mode)}
              />
            </div>
            {entry.sizingMode !== 'all' && (
              <div className="Option_Field Option_Field_Small">
                <label htmlFor={`${id}-sizing-value`}>
                  {t(`trading.sizingValue_${entry.sizingMode}`)}
                  <em> ({entry.sizingMode === 'amount' ? quote : '%'})</em>
                </label>
                <Global_Input
                  id={`${id}-sizing-value`}
                  type="number"
                  value={entry.sizingValue}
                  onChange={(e) => set('sizingValue', e.target.value)}
                />
              </div>
            )}
            {!spot && (
              <div className="Option_Field Option_Field_Small">
                <label htmlFor={`${id}-leverage`}>
                  {t('trading.leverage')}
                  <em> (×)</em>
                </label>
                <Global_Input
                  id={`${id}-leverage`}
                  type="number"
                  value={entry.leverage}
                  onChange={(e) => set('leverage', e.target.value)}
                />
              </div>
            )}
            {pyramid && (
              <div className="Option_Field Option_Field_Small">
                <label htmlFor={`${id}-positions`}>{t('trading.entryPositions', { max: maxPositions })}</label>
                <Global_Input
                  id={`${id}-positions`}
                  type="number"
                  value={entry.maxPositions}
                  onChange={(e) => set('maxPositions', e.target.value)}
                />
              </div>
            )}
            <span className="Simulator_Hint">
              {t(`trading.sizingHint_${entry.sizingMode}`)}
              {!spot && ` ${t('trading.leverageHint')}`}
              {pyramid && ` ${t('trading.entryPositionsHint')}`}
            </span>
          </div>
          {entry.scaleIns.length > 0 && (
            <div className="Partial_List">
              {entry.scaleIns.map((add, index) => (
                <Scale_In
                  key={add.id}
                  id={id}
                  add={add}
                  position={index + 1}
                  onChange={(next) => set('scaleIns', entry.scaleIns.map((item) => (item.id === add.id ? next : item)))}
                  onRemove={() => set('scaleIns', entry.scaleIns.filter((item) => item.id !== add.id))}
                />
              ))}
            </div>
          )}
          <div className="Exit_Adds">
            <button
              type="button"
              className="Exit_Add take_profit"
              onClick={() => set('scaleIns', [...entry.scaleIns, newScaleIn(indicators)])}
              disabled={entry.scaleIns.length >= MAX_SCALE_INS}
            >
              <Plus />
              {t('trading.scaleInAdd')}
            </button>
          </div>
        </Flow_Step>

        <Flow_Step number={4} title={t('trading.exitHow')} hint={t('trading.exitHowHint')}>
          {entry.partials.length > 0 && (
            <div className="Partial_List">
              <span className="Simulator_Hint">{t('trading.partialsHint')}</span>
              {entry.partials.map((partial, index) => (
                <Partial_Exit
                  key={partial.id}
                  id={`${id}-partial-${partial.id}`}
                  partial={partial}
                  position={index + 1}
                  onChange={(next) => set('partials', entry.partials.map((item) => (item.id === partial.id ? next : item)))}
                  onRemove={() => set('partials', entry.partials.filter((item) => item.id !== partial.id))}
                />
              ))}
            </div>
          )}
          {entry.stopRules.length > 0 && (
            <div className="Partial_List">
              <span className="Simulator_Hint">{t('trading.stopRulesHint')}</span>
              {entry.stopRules.map((rule, index) => (
                <Stop_Rule
                  key={rule.id}
                  id={id}
                  rule={rule}
                  position={index + 1}
                  side={side}
                  onChange={(next) => set('stopRules', entry.stopRules.map((item) => (item.id === rule.id ? next : item)))}
                  onRemove={() => set('stopRules', entry.stopRules.filter((item) => item.id !== rule.id))}
                />
              ))}
            </div>
          )}
          {exits.length > 0 && (
            <div className="Exit_List">
              {exits.map((tile, index) => (
                <Fragment key={tile.key}>
                  {index > 0 && <span className="Flow_Joiner Or">{t('trading.or')}</span>}
                  {tile}
                </Fragment>
              ))}
            </div>
          )}

          <div className="Exit_Adds">
            {missing.map((item) => (
              <button key={item.kind} type="button" className={`Exit_Add ${item.kind}`} onClick={() => turnOn(item)}>
                <Plus />
                {t(`trading.exit_${item.kind}`)}
              </button>
            ))}
            <button
              type="button"
              className="Exit_Add signal"
              onClick={() => set('exits', [...entry.exits, newExit(indicators)])}
              disabled={entry.exits.length >= MAX_EXITS}
            >
              <Plus />
              {t('trading.addSignalExit')}
            </button>
            <button
              type="button"
              className="Exit_Add take_profit"
              onClick={() => set('partials', [...entry.partials, newPartial()])}
              disabled={entry.partials.length >= MAX_PARTIALS}
            >
              <Plus />
              {t('trading.addPartial')}
            </button>
            <button
              type="button"
              className="Exit_Add stop_loss"
              onClick={() => set('stopRules', [...entry.stopRules, newStopRule(indicators)])}
              disabled={entry.stopRules.length >= MAX_STOP_RULES}
            >
              <Plus />
              {t('trading.stopRuleAdd')}
            </button>
          </div>
        </Flow_Step>

        {problem && <span className="Simulator_Error">{t(problem, { max: maxPositions })}</span>}
      </div>
    </div>
  );
};

export default Entry_Card;
