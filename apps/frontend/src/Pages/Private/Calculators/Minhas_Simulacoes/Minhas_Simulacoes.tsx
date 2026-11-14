import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useSavedSimulations, type SavedSimulation } from '../../../../Hooks/Calculators/useSavedSimulations';
import { useCurrencyFormat } from '../../../../Hooks/useCurrencyFormat';
import { CALCULATOR_KINDS } from './calculatorKinds';
import * as Icon from '../../../../Imports/icons';
import './Minhas_Simulacoes.scss';

/**
 * As simulações guardadas de todas as calculadoras, numa lista: a calculadora,
 * os dados principais, o resultado que interessa e a data. Abrir uma leva à
 * calculadora com ela carregada; com mais de uma calculadora, filtra-se por cima.
 */
const Minhas_Simulacoes = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { simulations, loading, deleteSimulation, deletingId } = useSavedSimulations();
  const { formatAmount } = useCurrencyFormat();
  const [filter, setFilter] = useState<string>('all');

  const locale = i18n.language === 'pt' ? 'pt-PT' : 'en-GB';
  const formatDate = (iso: string) => new Date(iso).toLocaleDateString(locale, { dateStyle: 'medium' });
  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString(locale, { timeStyle: 'short' });

  // As calculadoras que têm simulações, pela ordem em que aparecem
  const calculators = [...new Set(simulations.map((simulation) => simulation.calculator.abbreviation))];
  const visible = filter === 'all' ? simulations : simulations.filter((s) => s.calculator.abbreviation === filter);

  const titleOf = (abbreviation: string, name: string) => {
    const kind = CALCULATOR_KINDS[abbreviation];
    return kind ? t(kind.titleKey) : name;
  };

  const open = (simulation: SavedSimulation) => {
    const kind = CALCULATOR_KINDS[simulation.calculator.abbreviation];
    if (kind) navigate(kind.path, { state: { simulationId: simulation.id } });
  };

  return (
    <div className="Minhas_Simulacoes">
      <div className="Card Minhas_Simulacoes_Card">
        <div className="Card_Header">
          <div className="Card_Header_Text">
            <span className="Card_Title">{t('calculators.mySimulationsTitle')}</span>
            <span className="Card_Subtitle">{t('calculators.mySimulationsSubtitle')}</span>
          </div>
          {calculators.length > 1 && (
            <div className="Card_Header_Action">
              <div className="Tabs">
                <button type="button" className={filter === 'all' ? 'Active' : ''} onClick={() => setFilter('all')}>
                  {t('calculators.mySimulationsAll', { count: simulations.length })}
                </button>
                {calculators.map((abbreviation) => {
                  const sample = simulations.find((s) => s.calculator.abbreviation === abbreviation)!;
                  return (
                    <button
                      key={abbreviation}
                      type="button"
                      className={filter === abbreviation ? 'Active' : ''}
                      onClick={() => setFilter(abbreviation)}
                    >
                      {titleOf(abbreviation, sample.calculator.name)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <span className="Minhas_Simulacoes_Message">{t('common.loading')}</span>
        ) : simulations.length === 0 ? (
          <div className="Empty_State">
            <span className="Empty_State_Title">{t('calculators.mySimulationsEmpty')}</span>
            <span className="Empty_State_Text">{t('calculators.mySimulationsEmptyHint')}</span>
          </div>
        ) : (
          <ul className="Saved_List">
            {visible.map((simulation) => {
              const kind = CALCULATOR_KINDS[simulation.calculator.abbreviation];
              const KindIcon = kind?.icon ?? Icon.Calculator;
              const headline = kind?.headline(simulation.result, t, formatAmount);
              return (
                <li key={simulation.id} className={`Saved_Item ${kind ? 'Openable' : ''}`} onClick={() => open(simulation)}>
                  <span className="Saved_Icon" aria-hidden>
                    <KindIcon />
                  </span>

                  <div className="Saved_Main">
                    <span className="Saved_Title">
                      {titleOf(simulation.calculator.abbreviation, simulation.calculator.name)}
                    </span>
                    {kind && <span className="Saved_Summary Num">{kind.summary(simulation.inputs, t, formatAmount)}</span>}
                  </div>

                  {headline && (
                    <div className="Saved_Headline">
                      <span className="Eyebrow">{headline.label}</span>
                      <span className="Saved_Value Num">{headline.value}</span>
                    </div>
                  )}

                  <div className="Saved_Date">
                    <span>{formatDate(simulation.createdAt)}</span>
                    <span className="Dim Num">{formatTime(simulation.createdAt)}</span>
                  </div>

                  <div className="Row_Actions">
                    <button
                      type="button"
                      className="Row_Action Danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSimulation(simulation.id);
                      }}
                      disabled={deletingId === simulation.id}
                      title={t('common.delete')}
                      aria-label={t('common.delete')}
                    >
                      <Icon.Trash />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default Minhas_Simulacoes;
