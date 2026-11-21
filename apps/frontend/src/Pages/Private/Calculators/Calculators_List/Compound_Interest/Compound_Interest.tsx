import { useState } from 'react';
import { useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import Line_Chart from '../../../../../Components/Charts/Line_Chart/Line_Chart';
import Global_Input from '../../../../../Components/Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import Simple_Button from '../../../../../Components/Buttons/Simple_Button/Simple_Button';
import { COMPOUND_LIMITS, useCompoundInterestSimulation } from '../../../../../Hooks/Calculators/Compound_Interest/useCompoundInterestSimulation';
import { useSavedCompoundInterestSimulations } from '../../../../../Hooks/Calculators/Compound_Interest/useSavedCompoundInterestSimulations';
import type { SavedCompoundInterestSimulation } from '../../../../../Hooks/Calculators/Compound_Interest/useSavedCompoundInterestSimulations';
import { useCurrencyFormat } from '../../../../../Hooks/useCurrencyFormat';
import * as Icon from '../../../../../Imports/icons';
import './Compound_Interest.scss';
import { localeOf } from '../../../../../utils/locale';
import { activateOnKey } from '../../../../../utils/rowKeyboard';

type BreakdownTab = 'yearly' | 'quarterly' | 'monthly';

const BREAKDOWN_TAB_LABEL_KEY: Record<BreakdownTab, string> = {
  yearly: 'compoundInterest.annual',
  quarterly: 'compoundInterest.quarterly',
  monthly: 'compoundInterest.monthly',
};

const Compound_Interest = () => {
  const { t, i18n } = useTranslation();

  const {
    savedSimulations,
    loading: loadingSaved,
    refresh: refreshSaved,
    deleteSimulation,
    deletingId,
  } = useSavedCompoundInterestSimulations();

  const {
    initialInvestment,
    setInitialInvestment,
    term,
    setTerm,
    additionalInvestment,
    setAdditionalInvestment,
    compoundingFrequency,
    setCompoundingFrequency,
    interestRate,
    setInterestRate,
    interestRatePeriod,
    setInterestRatePeriod,
    transactionFeeType,
    setTransactionFeeType,
    transactionFeeValue,
    setTransactionFeeValue,
    maintenanceFeeType,
    setMaintenanceFeeType,
    maintenanceFeeValue,
    setMaintenanceFeeValue,
    missedPeriods,
    setMissedPeriods,
    inflationRate,
    setInflationRate,
    result,
    loading,
    simulate,
    saving,
    save,
    loadSimulation,
  } = useCompoundInterestSimulation(refreshSaved);

  const { formatAmount, symbol } = useCurrencyFormat();

  const [activeTab, setActiveTab] = useState<BreakdownTab>('yearly');

  const missedPeriodsLabelKey = (() => {
    const frequency = Number(compoundingFrequency);
    if (frequency === 12) return 'compoundInterest.missedPeriodsMonthly';
    if (frequency === 4) return 'compoundInterest.missedPeriodsQuarterly';
    return 'compoundInterest.missedPeriodsYearly';
  })();

  const handleLoadSavedSimulation = (simulation: SavedCompoundInterestSimulation) => {
    loadSimulation(simulation.inputs, simulation.result);
    setActiveTab(simulation.result.nativeGranularity ?? 'yearly');
  };

  // Vinda das Minhas Simulações: abre a escolhida quando a lista chega
  const location = useLocation();
  const requestedId = (location.state as { simulationId?: string } | null)?.simulationId;
  // Uma vez só, durante o render (não num efeito): a lista pode chegar depois
  const [openedRequest, setOpenedRequest] = useState(false);
  const requested = !openedRequest && requestedId
    ? savedSimulations.find((simulation) => simulation.id === requestedId)
    : undefined;
  if (requested) {
    setOpenedRequest(true);
    handleLoadSavedSimulation(requested);
  }

  const handleDeleteSavedSimulation = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteSimulation(id);
  };

  const activeTableData = result?.breakdown[activeTab];
  const isInterpolated = !!result && activeTab !== result.nativeGranularity;

  const chartData = (() => {
    if (!activeTableData) return [];

    let cumulativeInvested = Number(initialInvestment) || 0;

    return activeTableData.map((row) => {
      cumulativeInvested += row.contribution;

      return {
        period: row.period,
        invested: Math.round(cumulativeInvested * 100) / 100,
        balance: row.balance,
        realBalance: row.realBalance,
      };
    });
  })();

  // Os números do resultado abrem a página, a toda a largura: são o assunto,
  // e assim vêem-se sem ter de passar pelo formulário todo
  const summary = result?.summary;

  return (
    <div className="Compound_Interest">
      <div className="Page_Head">
        <div>
          <h1>{t('compoundInterest.title')}</h1>
          <div className="Page_Head_Sub">{t('compoundInterest.description')}</div>
        </div>
      </div>

      <div className="Compound_Interest_Content">
        <form className="Simulation_Form">
          {/* O título da calculadora já está no cabeçalho da página — aqui
              o cartão diz só o que contém */}
          <div className="Calculator_Header">
            <span className="Calculator_Title">{t('compoundInterest.parameters')}</span>
          </div>

          <div className="Simulation_Form_Body">
            <div className="Form_Field">
              <label htmlFor="initialInvestment">{t('compoundInterest.initialInvestment')}</label>
              <Global_Input
                id="initialInvestment"
                type="number"
                min={COMPOUND_LIMITS.amount.min}
                max={COMPOUND_LIMITS.amount.max}
                placeholder="10000"
                value={initialInvestment}
                onChange={(e) => setInitialInvestment(e.target.value)}
              />
            </div>

            <div className="Form_Field">
              <label htmlFor="term">{t('compoundInterest.term')}</label>
              <Global_Input
                id="term"
                type="number"
                min={COMPOUND_LIMITS.term.min}
                max={COMPOUND_LIMITS.term.max}
                placeholder="5"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
              />
            </div>

            <div className="Form_Field">
              <label htmlFor="additionalInvestment">{t('compoundInterest.additionalInvestment')}</label>
              <Global_Input
                id="additionalInvestment"
                type="number"
                min={COMPOUND_LIMITS.amount.min}
                max={COMPOUND_LIMITS.amount.max}
                placeholder="100"
                value={additionalInvestment}
                onChange={(e) => setAdditionalInvestment(e.target.value)}
              />
            </div>

            <div className="Form_Field">
              <label htmlFor="compoundingFrequency">{t('compoundInterest.compoundingFrequency')}</label>
              <Global_Dropdown
                id="compoundingFrequency"
                value={compoundingFrequency}
                onChange={(value) => setCompoundingFrequency(String(value))}
                options={[
                  { value: 1, label: t('compoundInterest.annual') },
                  { value: 4, label: t('compoundInterest.quarterly') },
                  { value: 12, label: t('compoundInterest.monthly') },
                ]}
              />
            </div>

            <div className="Form_Field">
              <label htmlFor="interestRate">{t('compoundInterest.interestRate')}</label>
              <Global_Input
                id="interestRate"
                type="number"
                min={COMPOUND_LIMITS.interestRate.min}
                max={COMPOUND_LIMITS.interestRate.max}
                placeholder="5"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
              />
            </div>

            <div className="Form_Field">
              <label htmlFor="interestRatePeriod">{t('compoundInterest.interestRatePeriod')}</label>
              <Global_Dropdown
                id="interestRatePeriod"
                value={interestRatePeriod}
                onChange={(value) => setInterestRatePeriod(String(value))}
                options={[
                  { value: 'annual', label: t('compoundInterest.annual') },
                  { value: 'quarterly', label: t('compoundInterest.quarterly') },
                  { value: 'monthly', label: t('compoundInterest.monthly') },
                ]}
              />
            </div>

            <div className="Form_Field">
              <label htmlFor="transactionFeeValue">{t('compoundInterest.transactionFee')}</label>
              <div className="Fee_Field">
                <Global_Input
                  id="transactionFeeValue"
                  type="number"
                  min={COMPOUND_LIMITS.amount.min}
                  max={COMPOUND_LIMITS.amount.max}
                  placeholder="0"
                  value={transactionFeeValue}
                  onChange={(e) => setTransactionFeeValue(e.target.value)}
                />
                <Global_Dropdown
                  value={transactionFeeType}
                  onChange={(value) => setTransactionFeeType(value as 'percentage' | 'fixed')}
                  options={[
                    { value: 'percentage', label: t('compoundInterest.feeTypePercentage') },
                    { value: 'fixed', label: t('compoundInterest.feeTypeFixed', { symbol }) },
                  ]}
                />
              </div>
            </div>

            <div className="Form_Field">
              <label htmlFor="maintenanceFeeValue">{t('compoundInterest.maintenanceFee')}</label>
              <div className="Fee_Field">
                <Global_Input
                  id="maintenanceFeeValue"
                  type="number"
                  min={COMPOUND_LIMITS.amount.min}
                  max={COMPOUND_LIMITS.amount.max}
                  placeholder="0"
                  value={maintenanceFeeValue}
                  onChange={(e) => setMaintenanceFeeValue(e.target.value)}
                />
                <Global_Dropdown
                  value={maintenanceFeeType}
                  onChange={(value) => setMaintenanceFeeType(value as 'percentage' | 'fixed')}
                  options={[
                    { value: 'percentage', label: t('compoundInterest.feeTypePercentage') },
                    { value: 'fixed', label: t('compoundInterest.feeTypeFixed', { symbol }) },
                  ]}
                />
              </div>
            </div>

            <div className="Form_Field">
              <label htmlFor="missedPeriods">{t(missedPeriodsLabelKey)}</label>
              <Global_Input
                id="missedPeriods"
                type="number"
                min={COMPOUND_LIMITS.missedPeriods.min}
                max={COMPOUND_LIMITS.missedPeriods.max}
                placeholder="0"
                value={missedPeriods}
                onChange={(e) => setMissedPeriods(e.target.value)}
              />
            </div>

            <div className="Form_Field">
              <label htmlFor="inflationRate">{t('compoundInterest.inflationRate')}</label>
              <Global_Input
                id="inflationRate"
                type="number"
                min={COMPOUND_LIMITS.inflationRate.min}
                max={COMPOUND_LIMITS.inflationRate.max}
                placeholder="2"
                value={inflationRate}
                onChange={(e) => setInflationRate(e.target.value)}
              />
            </div>

            <div className="Simulate_Button">
              <div className="Simulate_Button_Item">
                <Simple_Button
                  text={t('compoundInterest.simulate')}
                  onClick={simulate}
                  disabled={loading}
                />
              </div>
              <div className="Simulate_Button_Item">
                <Simple_Button
                  text={t('compoundInterest.save')}
                  onClick={save}
                  disabled={saving || !result}
                />
              </div>
            </div>
          </div>
        </form>

      {summary && (
        <div className="Grid Auto_190 Compound_Interest_Tiles">
          <div className="Card Tile Big">
            <span className="Eyebrow">{t('compoundInterest.finalBalance')}</span>
            <span className="Tile_Value">{formatAmount(summary.finalBalance)}</span>
            <div className="Tile_Foot">
              {t('compoundInterest.totalInvested')}: {formatAmount(summary.totalInvested)}
            </div>
          </div>

          <div className="Card Tile">
            <span className="Eyebrow">{t('compoundInterest.totalInterestEarned')}</span>
            <span className="Tile_Value">{formatAmount(summary.totalInterestEarned)}</span>
            <div className="Tile_Foot">
              {Math.round((summary.totalInterestEarned / summary.finalBalance) * 100)}%{' '}
              {t('compoundInterest.ofFinalBalance')}
            </div>
          </div>

          <div className="Card Tile">
            <span className="Eyebrow">{t('compoundInterest.totalFeesPaid')}</span>
            <span className="Tile_Value">{formatAmount(summary.totalFeesPaid)}</span>
            <div className="Tile_Foot">{t('compoundInterest.feesNote')}</div>
          </div>

          <div className="Card Tile">
            <span className="Eyebrow">{t('compoundInterest.finalBalanceReal')}</span>
            <span className="Tile_Value">{formatAmount(summary.finalBalanceReal)}</span>
            <div className="Tile_Foot">{t('compoundInterest.realNote')}</div>
          </div>
        </div>
      )}


      {/* Sem simulação, o lado direito diz o que falta fazer em vez de ficar
          um vazio do tamanho do ecrã ao lado do formulário */}
      {!result && (
        <div className="Simulation_Placeholder">
          <span className="Simulation_Placeholder_Icon"><Icon.Calculator /></span>
          <span className="Simulation_Placeholder_Title">{t('compoundInterest.placeholderTitle')}</span>
          <span className="Simulation_Placeholder_Text">{t('compoundInterest.placeholderText')}</span>
        </div>
      )}

      {result && (
        <div className="Granularity_Tabs">
          <div className="Tab_Buttons">
            <button
              type="button"
              className={`Tab_Button ${activeTab === 'yearly' ? 'active' : ''}`}
              onClick={() => setActiveTab('yearly')}
            >
              {t('compoundInterest.annual')}
            </button>
            <button
              type="button"
              className={`Tab_Button ${activeTab === 'quarterly' ? 'active' : ''}`}
              onClick={() => setActiveTab('quarterly')}
            >
              {t('compoundInterest.quarterly')}
            </button>
            <button
              type="button"
              className={`Tab_Button ${activeTab === 'monthly' ? 'active' : ''}`}
              onClick={() => setActiveTab('monthly')}
            >
              {t('compoundInterest.monthly')}
            </button>
          </div>

          {isInterpolated && (
            <span className="Interpolated_Hint">{t('compoundInterest.interpolatedHint')}</span>
          )}
        </div>
      )}

      {result && (
        <div className="Results_Overview">
          <div className="Overview_Chart_Card">
            <Line_Chart
              key={activeTab}
              title={t('compoundInterest.chartTitle')}
              subtitle={t(BREAKDOWN_TAB_LABEL_KEY[activeTab])}
              data={chartData}
              formatValue={formatAmount}
              series={[
                {
                  dataKey: 'invested',
                  name: t('compoundInterest.invested'),
                  color: 'var(--cards-base-letter-color)',
                  dashed: true,
                },
                {
                  dataKey: 'balance',
                  name: t('compoundInterest.balance'),
                  color: 'var(--compound-interest-chart-balance-color)',
                },
                {
                  dataKey: 'realBalance',
                  name: t('compoundInterest.realBalance'),
                  color: 'var(--compound-interest-chart-real-balance-color)',
                },
              ]}
            />
          </div>

          <div className="Overview_Summary_Card">
            <div className="Calculator_Header">
              <span className="Calculator_Title">{t('compoundInterest.summaryTitle')}</span>
            </div>

            <div className="Overview_Summary_Body">
              <div className="Summary_Row">
                <span>{t('compoundInterest.totalInvested')}</span>
                <span>{formatAmount(result.summary.totalInvested)}</span>
              </div>
              <div className="Summary_Row">
                <span>{t('compoundInterest.totalContributions')}</span>
                <span>{formatAmount(result.summary.totalContributions)}</span>
              </div>
              <div className="Summary_Row">
                <span>{t('compoundInterest.totalInterestEarned')}</span>
                <span>{formatAmount(result.summary.totalInterestEarned)}</span>
              </div>
              <div className="Summary_Row">
                <span>{t('compoundInterest.transactionFee')}</span>
                <span>{formatAmount(result.summary.totalTransactionFeesPaid)}</span>
              </div>
              <div className="Summary_Row">
                <span>{t('compoundInterest.maintenanceFee')}</span>
                <span>{formatAmount(result.summary.totalMaintenanceFeesPaid)}</span>
              </div>
              <div className="Summary_Row">
                <span>{t('compoundInterest.totalFeesPaid')}</span>
                <span>{formatAmount(result.summary.totalFeesPaid)}</span>
              </div>
              <div className="Summary_Row">
                <span>{t('compoundInterest.finalBalance')}</span>
                <span>{formatAmount(result.summary.finalBalance)}</span>
              </div>
              <div className="Summary_Row">
                <span>{t('compoundInterest.finalBalanceReal')}</span>
                <span>{formatAmount(result.summary.finalBalanceReal)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {result && activeTableData && (
        <div className="Results_Section">
          <div className="Results_Card">
            <div className="Results_Body">
              <div className="Results_Table_Scroll">
                <table className="Results_Table">
                  <thead>
                    <tr>
                      <th>{t('compoundInterest.period')}</th>
                      <th>{t('compoundInterest.contribution')}</th>
                      <th>{t('compoundInterest.interest')}</th>
                      <th>{t('compoundInterest.transactionFee')}</th>
                      <th>{t('compoundInterest.maintenanceFee')}</th>
                      <th>{t('compoundInterest.fees')}</th>
                      <th>{t('compoundInterest.balance')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeTableData.map((row) => (
                      <tr key={row.period}>
                        <td>{row.period}</td>
                        <td>{formatAmount(row.contribution)}</td>
                        <td>{formatAmount(row.interest)}</td>
                        <td>{formatAmount(row.transactionFee)}</td>
                        <td>{formatAmount(row.maintenanceFee)}</td>
                        <td>{formatAmount(row.fees)}</td>
                        <td>{formatAmount(row.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
        )}
      </div>

      <div className="Results_Section">
        <div className="Results_Card">
          <div className="Calculator_Header">
            <span className="Calculator_Title">{t('compoundInterest.savedSimulationsTitle')}</span>
          </div>

          <div className="Results_Body">
            {loadingSaved ? (
              <span className="Results_Empty_State">{t('common.loading')}</span>
            ) : savedSimulations.length === 0 ? (
              <span className="Results_Empty_State">{t('compoundInterest.savedSimulationsEmpty')}</span>
            ) : (
              <div className="Results_Table_Scroll">
                <table className="Results_Table">
                  <thead>
                    <tr>
                      <th>{t('compoundInterest.date')}</th>
                      <th>{t('compoundInterest.initialInvestment')}</th>
                      <th>{t('compoundInterest.term')}</th>
                      <th>{t('compoundInterest.transactionFee')}</th>
                      <th>{t('compoundInterest.maintenanceFee')}</th>
                      <th>{t('compoundInterest.fees')}</th>
                      <th>{t('compoundInterest.finalBalance')}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {savedSimulations.map((simulation) => (
                      <tr
                        key={simulation.id}
                        className="Saved_Simulation_Row"
                        onClick={() => handleLoadSavedSimulation(simulation)} tabIndex={0} onKeyDown={activateOnKey}
                      >
                        <td>{new Date(simulation.createdAt).toLocaleDateString(localeOf(i18n.language))}</td>
                        <td>{formatAmount(simulation.inputs.initialInvestment)}</td>
                        <td>{simulation.inputs.term}</td>
                        <td>{formatAmount(simulation.result.summary.totalTransactionFeesPaid ?? 0)}</td>
                        <td>{formatAmount(simulation.result.summary.totalMaintenanceFeesPaid ?? 0)}</td>
                        <td>{formatAmount(simulation.result.summary.totalFeesPaid ?? 0)}</td>
                        <td>{formatAmount(simulation.result.summary.finalBalance)}</td>
                        <td>
                          <button
                            type="button"
                            className="Delete_Simulation_Button"
                            onClick={(e) => handleDeleteSavedSimulation(e, simulation.id)}
                            disabled={deletingId === simulation.id}
                          >
                            {t('compoundInterest.delete')}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Compound_Interest;
