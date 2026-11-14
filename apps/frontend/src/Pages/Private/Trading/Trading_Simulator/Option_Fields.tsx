import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import { Plus, Trash } from '../../../../Imports/icons';
import type { Market_Instrument } from '../../../../Hooks/Trading/useMarketInstruments';
import type {
  Cooldown_After,
  Deposit_Period,
  Execution_Price,
  Max_Loss_Mode,
  Opposite_Mode,
  Sizing_Action,
  Streak,
} from '../../../../Hooks/Trading/useSimulation';
import Schedule_Rules from './Schedule_Rules';
import Segmented from './Segmented';
import {
  DEPOSIT_PERIODS,
  EXECUTION_PRICES,
  MAX_EXCLUDED_PERIODS,
  MAX_LOSS_MODES,
  MAX_SIZING_RULES,
  OPPOSITE_MODES,
  SIZING_ACTIONS,
  STREAKS,
  brokerLimits,
  newExcludedPeriod,
  newSizingRule,
} from './strategyOptions';
import type { Option_Key, Options_Form } from './strategyOptions';

interface Option_Fields_Props {
  option: Option_Key;
  options: Options_Form;
  onChange: (patch: Partial<Options_Form>) => void;
  instrument: Market_Instrument | null;
}

/** Um campo pequeno com a etiqueta por cima (e, se tiver, a unidade à direita). */
const Field = ({ id, label, unit, children }: { id: string; label: string; unit?: string; children: ReactNode }) => (
  <div className="Option_Field">
    <label htmlFor={id}>
      {label}
      {unit && <em> ({unit})</em>}
    </label>
    {children}
  </div>
);

/**
 * Os campos de uma opção geral ligada, conforme a opção, com uma linha a dizer
 * o que acontece com os valores escolhidos.
 */
const Option_Fields = ({ option, options, onChange, instrument }: Option_Fields_Props) => {
  const { t } = useTranslation();
  const quote = instrument?.quote ?? '';
  const id = `option-${option}`;

  switch (option) {
    case 'deposits':
      return (
        <>
          <Field id={id} label={t('trading.depositEvery')}>
            <Segmented
              id={id}
              label={t('trading.depositEvery')}
              value={options.depositEvery}
              options={DEPOSIT_PERIODS.map((period) => ({ value: period, label: t(`trading.depositShort_${period}`) }))}
              onChange={(period) => onChange({ depositEvery: period as Deposit_Period })}
            />
          </Field>
          <Field id={`${id}-amount`} label={t('trading.depositAmount')} unit={quote}>
            <Global_Input
              id={`${id}-amount`}
              type="number"
              value={options.depositAmount}
              onChange={(e) => onChange({ depositAmount: e.target.value })}
            />
          </Field>
          <Field id={`${id}-increase`} label={t('trading.depositIncrease')}>
            <Segmented
              id={`${id}-increase`}
              label={t('trading.depositIncrease')}
              value={options.depositIncreaseEvery || 'none'}
              options={[
                { value: 'none', label: t('trading.increase_none') },
                { value: 'quarter', label: t('trading.increase_quarter') },
                { value: 'year', label: t('trading.increase_year') },
              ]}
              onChange={(every) => onChange({ depositIncreaseEvery: every === 'none' ? '' : every })}
            />
          </Field>
          {options.depositIncreaseEvery && (
            <Field id={`${id}-increase-amount`} label={t('trading.depositIncreaseAmount')} unit={quote}>
              <Global_Input
                id={`${id}-increase-amount`}
                type="number"
                value={options.depositIncreaseAmount}
                onChange={(e) => onChange({ depositIncreaseAmount: e.target.value })}
              />
            </Field>
          )}
          <span className="Simulator_Hint Option_Hint">
            {t(`trading.depositHint_${options.depositEvery}`)}
            {options.depositIncreaseEvery &&
              ` ${t(`trading.depositIncreaseHint_${options.depositIncreaseEvery}`, {
                amount: options.depositIncreaseAmount || 0,
                quote,
              })}`}
          </span>
        </>
      );

    case 'funding':
      return (
        <>
          <Field id={id} label={t('trading.fundingMode')}>
            <Segmented
              id={id}
              label={t('trading.fundingMode')}
              value={options.fundingMode}
              options={[
                {
                  value: 'historical',
                  label: t('trading.funding_historical'),
                  disabled: instrument?.type !== 'perpetual',
                  title: instrument?.type !== 'perpetual' ? t('trading.optError_fundingPerpetual') : undefined,
                },
                { value: 'fixed', label: t('trading.funding_fixed') },
              ]}
              onChange={(mode) => onChange({ fundingMode: mode })}
            />
          </Field>
          {options.fundingMode === 'fixed' && (
            <Field id={`${id}-rate`} label={t('trading.fundingRate')} unit="%">
              <Global_Input
                id={`${id}-rate`}
                type="number"
                value={options.fundingRatePct}
                onChange={(e) => onChange({ fundingRatePct: e.target.value })}
              />
            </Field>
          )}
          <span className="Simulator_Hint Option_Hint">{t(`trading.fundingHint_${options.fundingMode}`)}</span>
        </>
      );

    case 'execution':
      return (
        <>
          <Field id={id} label={t('trading.opt_executionPrice')}>
            <Global_Dropdown
              id={id}
              value={options.executionPrice}
              searchable={false}
              options={EXECUTION_PRICES.map((mode) => ({ value: mode, label: t(`trading.execution_${mode}`) }))}
              onChange={(mode) => onChange({ executionPrice: mode as Execution_Price })}
            />
          </Field>
          <span className="Simulator_Hint Option_Hint">{t(`trading.executionHint_${options.executionPrice}`)}</span>
        </>
      );

    case 'slippage':
      return (
        <>
          <Field id={id} label={t('trading.slippagePct')}>
            <Global_Input id={id} type="number" value={options.slippagePct} onChange={(e) => onChange({ slippagePct: e.target.value })} />
          </Field>
          <span className="Simulator_Hint Option_Hint">{t('trading.slippageHint')}</span>
        </>
      );

    case 'orderSize': {
      const broker = brokerLimits(instrument);
      const hasBroker = Boolean(broker.quantityStep || broker.minQuantity || broker.minNotional);
      return (
        <>
          <Field id={`${id}-step`} label={t('trading.quantityStep')}>
            <Global_Input
              id={`${id}-step`}
              type="number"
              value={options.quantityStep}
              placeholder={t('trading.none')}
              onChange={(e) => onChange({ quantityStep: e.target.value })}
            />
          </Field>
          <Field id={`${id}-min`} label={t('trading.minQuantity')}>
            <Global_Input
              id={`${id}-min`}
              type="number"
              value={options.minQuantity}
              placeholder={t('trading.none')}
              onChange={(e) => onChange({ minQuantity: e.target.value })}
            />
          </Field>
          <Field id={`${id}-notional`} label={t('trading.minNotional')} unit={quote}>
            <Global_Input
              id={`${id}-notional`}
              type="number"
              value={options.minNotional}
              placeholder={t('trading.none')}
              onChange={(e) => onChange({ minNotional: e.target.value })}
            />
          </Field>
          <span className="Simulator_Hint Option_Hint">
            {t('trading.orderSizeHint')}{' '}
            {hasBroker && (
              <button type="button" className="Link_Button" onClick={() => onChange(broker)}>
                {t('trading.useBrokerLimits')}
              </button>
            )}
          </span>
        </>
      );
    }

    case 'outOfSample':
      return (
        <>
          <Field id={id} label={t('trading.inSamplePct')} unit="%">
            <Global_Input id={id} type="number" value={options.outOfSamplePct} onChange={(e) => onChange({ outOfSamplePct: e.target.value })} />
          </Field>
          <span className="Simulator_Hint Option_Hint">
            {t('trading.outOfSampleHint', { pct: options.outOfSamplePct || '…' })}
          </span>
        </>
      );

    case 'propFirm':
      return (
        <>
          <Field id={`${id}-daily`} label={t('trading.propDailyLoss')} unit="%">
            <Global_Input id={`${id}-daily`} type="number" value={options.propDailyLossPct} onChange={(e) => onChange({ propDailyLossPct: e.target.value })} />
          </Field>
          <Field id={`${id}-max`} label={t('trading.propMaxLoss')} unit="%">
            <Global_Input id={`${id}-max`} type="number" value={options.propMaxLossPct} onChange={(e) => onChange({ propMaxLossPct: e.target.value })} />
          </Field>
          <Field id={`${id}-mode`} label={t('trading.propMaxLossMode')}>
            <Segmented
              label={t('trading.propMaxLossMode')}
              value={options.propMaxLossMode}
              options={MAX_LOSS_MODES.map((mode) => ({ value: mode, label: t(`trading.propMaxLoss_${mode}`) }))}
              onChange={(mode) => onChange({ propMaxLossMode: mode as Max_Loss_Mode })}
            />
          </Field>
          <Field id={`${id}-target`} label={t('trading.propTarget')} unit="%">
            <Global_Input id={`${id}-target`} type="number" value={options.propTargetPct} onChange={(e) => onChange({ propTargetPct: e.target.value })} />
          </Field>
          <Field id={`${id}-days`} label={t('trading.propMinDays')}>
            <Global_Input id={`${id}-days`} type="number" value={options.propMinDays} onChange={(e) => onChange({ propMinDays: e.target.value })} />
          </Field>
          <Field id={`${id}-length`} label={t('trading.propDays')}>
            <Global_Input id={`${id}-length`} type="number" value={options.propDays} onChange={(e) => onChange({ propDays: e.target.value })} />
          </Field>
          <span className="Simulator_Hint Option_Hint">{t('trading.propFirmHint', { days: options.propDays || '…' })}</span>
        </>
      );

    case 'positions':
      return (
        <>
          <Field id={id} label={t('trading.maxPositions')}>
            <Global_Input id={id} type="number" value={options.maxPositions} onChange={(e) => onChange({ maxPositions: e.target.value })} />
          </Field>
          <span className="Simulator_Hint Option_Hint">{t('trading.positionsHint')}</span>
        </>
      );

    case 'opposite':
      return (
        <>
          <Field id={id} label={t('trading.oppositeMode')}>
            <Global_Dropdown
              id={id}
              value={options.opposite}
              searchable={false}
              options={OPPOSITE_MODES.map((mode) => ({ value: mode, label: t(`trading.opposite_${mode}`) }))}
              onChange={(mode) => onChange({ opposite: mode as Opposite_Mode })}
            />
          </Field>
          <span className="Simulator_Hint Option_Hint">
            {t(`trading.oppositeHint_${options.opposite}`)}
            {options.opposite === 'hedge' && !options.enabled.includes('positions') && ` ${t('trading.hedgeNeedsPositions')}`}
          </span>
        </>
      );

    case 'cooldown':
      return (
        <>
          <Field id={id} label={t('trading.cooldownBars')}>
            <Global_Input id={id} type="number" value={options.cooldownBars} onChange={(e) => onChange({ cooldownBars: e.target.value })} />
          </Field>
          <Field id={`${id}-after`} label={t('trading.cooldownAfter')}>
            <Segmented
              id={`${id}-after`}
              label={t('trading.cooldownAfter')}
              value={options.cooldownAfter}
              options={(['any', 'loss'] as Cooldown_After[]).map((after) => ({ value: after, label: t(`trading.cooldown_${after}`) }))}
              onChange={(after) => onChange({ cooldownAfter: after as Cooldown_After })}
            />
          </Field>
          <span className="Simulator_Hint Option_Hint">{t('trading.cooldownHint')}</span>
        </>
      );

    case 'sizingRules': {
      const update = (ruleId: number, patch: Partial<Options_Form['sizingRules'][number]>) =>
        onChange({ sizingRules: options.sizingRules.map((rule) => (rule.id === ruleId ? { ...rule, ...patch } : rule)) });
      return (
        <div className="Option_List">
          {options.sizingRules.map((rule) => (
            <div key={rule.id} className="Option_Sentence">
              <span>{t('trading.ruleAfter')}</span>
              <Global_Input
                id={`rule-${rule.id}-count`}
                type="number"
                value={rule.count}
                onChange={(e) => update(rule.id, { count: e.target.value })}
              />
              <Segmented
                label={t('trading.ruleStreak')}
                value={rule.after}
                options={STREAKS.map((streak) => ({ value: streak, label: t(`trading.streak_${streak}`) }))}
                onChange={(after) => update(rule.id, { after: after as Streak })}
              />
              <span>→</span>
              <div className="Option_Sentence_Select">
                <Global_Dropdown
                  id={`rule-${rule.id}-action`}
                  value={rule.action}
                  searchable={false}
                  options={SIZING_ACTIONS.map((action) => ({ value: action, label: t(`trading.ruleAction_${action}`) }))}
                  onChange={(action) => update(rule.id, { action: action as Sizing_Action })}
                />
              </div>
              {rule.action !== 'reset' && (
                <>
                  <Global_Input
                    id={`rule-${rule.id}-value`}
                    type="number"
                    value={rule.value}
                    onChange={(e) => update(rule.id, { value: e.target.value })}
                  />
                  {rule.action === 'multiply' && <span>×</span>}
                  <span>{t('trading.ruleFor')}</span>
                  <Global_Input
                    id={`rule-${rule.id}-trades`}
                    type="number"
                    value={rule.trades}
                    placeholder="∞"
                    onChange={(e) => update(rule.id, { trades: e.target.value })}
                  />
                  <span>{t('trading.ruleTrades')}</span>
                </>
              )}
              <button
                type="button"
                className="Row_Action Danger"
                onClick={() => onChange({ sizingRules: options.sizingRules.filter((item) => item.id !== rule.id) })}
                disabled={options.sizingRules.length <= 1}
                aria-label={t('trading.removeRule')}
                title={t('trading.removeRule')}
              >
                <Trash />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="Add_Condition"
            onClick={() =>
              onChange({ sizingRules: [...options.sizingRules, newSizingRule({ after: 'wins', count: '1', action: 'reset' })] })
            }
            disabled={options.sizingRules.length >= MAX_SIZING_RULES}
          >
            <Plus />
            {t('trading.addRule')}
          </button>
          <span className="Simulator_Hint Option_Hint">{t('trading.sizingRulesHint')}</span>
        </div>
      );
    }

    case 'schedule':
      return (
        <>
          <Schedule_Rules
            rules={options.blockedTimes}
            lead={t('trading.blockOn')}
            onChange={(blockedTimes) => onChange({ blockedTimes })}
          />
          <span className="Simulator_Hint Option_Hint">{t('trading.scheduleHint')}</span>
        </>
      );

    case 'excluded': {
      const update = (periodId: number, patch: Partial<Options_Form['excludedPeriods'][number]>) =>
        onChange({
          excludedPeriods: options.excludedPeriods.map((period) => (period.id === periodId ? { ...period, ...patch } : period)),
        });
      return (
        <div className="Option_List">
          {options.excludedPeriods.map((period) => (
            <div key={period.id} className="Option_Sentence">
              <span>{t('trading.excludeFrom')}</span>
              <Global_Input id={`excluded-${period.id}-from`} type="date" value={period.from} onChange={(e) => update(period.id, { from: e.target.value })} />
              <span>{t('trading.excludeTo')}</span>
              <Global_Input id={`excluded-${period.id}-to`} type="date" value={period.to} onChange={(e) => update(period.id, { to: e.target.value })} />
              <button
                type="button"
                className="Row_Action Danger"
                onClick={() => onChange({ excludedPeriods: options.excludedPeriods.filter((item) => item.id !== period.id) })}
                disabled={options.excludedPeriods.length <= 1}
                aria-label={t('trading.removePeriod')}
                title={t('trading.removePeriod')}
              >
                <Trash />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="Add_Condition"
            onClick={() => onChange({ excludedPeriods: [...options.excludedPeriods, newExcludedPeriod()] })}
            disabled={options.excludedPeriods.length >= MAX_EXCLUDED_PERIODS}
          >
            <Plus />
            {t('trading.addPeriod')}
          </button>
          <span className="Simulator_Hint Option_Hint">{t('trading.excludedHint')}</span>
        </div>
      );
    }
  }
};

export default Option_Fields;
