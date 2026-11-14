import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Operator, Simulation_Run } from '../../../../Hooks/Trading/useSimulation';
import { formatNumber } from '../Trading_Simulator/format';
import { fromRun } from '../Trading_Simulator/simulationForm';
import type { Condition_Form } from '../Trading_Simulator/simulationForm';
import { contextTexts, scaleInTexts, setupTexts, stopRuleTexts } from '../Trading_Simulator/valueLabels';

// As comparações escrevem-se como sinais; os cruzamentos por extenso
const OPERATOR_SIGNS: Partial<Record<Operator, string>> = { gt: '>', gte: '≥', lt: '<', lte: '≤' };

// As regras de uma entrada escritas como na ficha (2.1), uma frase por regra
export interface Entry_Rule_Texts {
  setup: string[];
  context: string[];
  stopRules: string[];
  scaleIns: string[];
}

/**
 * As regras da entrada (preparação, «só entra se», ajustes do stop e reforços)
 * escritas por extenso, por entrada: lê a estratégia gravada como o formulário
 * (`fromRun`), para as tabelas da 2.2 e da 4.9 dizerem o mesmo que a ficha.
 */
export const useRuleTexts = (run: Simulation_Run): Entry_Rule_Texts[] => {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  return useMemo(() => {
    const form = fromRun(run);
    // Sem casas a mais: 2 e não 2,0; os textos do formulário podem vir com vírgula
    const short = (value: number) => {
      const digits = Number.isInteger(value) ? 0 : Number.isInteger(value * 10) ? 1 : Number.isInteger(value * 100) ? 2 : 4;
      return formatNumber(value, language, digits);
    };
    const pct = (text: string) => `${short(Number(text.replace(',', '.')))}%`;
    const format = {
      operator: ({ operator }: Condition_Form) => OPERATOR_SIGNS[operator] ?? t(`trading.operator_${operator}`),
      pct: (value: number) => `${value > 0 ? '+' : '−'}${short(Math.abs(value))}%`,
    };
    return form.entries.map((entry) => ({
      setup: setupTexts(entry, form.indicators, t, format),
      context: contextTexts(entry, t),
      stopRules: stopRuleTexts(entry, form.indicators, t, format, pct),
      scaleIns: scaleInTexts(entry, form.indicators, t, format, pct),
    }));
  }, [run, t, language]);
};
