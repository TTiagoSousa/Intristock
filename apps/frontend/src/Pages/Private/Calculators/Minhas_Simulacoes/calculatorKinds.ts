import type { ComponentType } from 'react';
import type { TFunction } from 'i18next';
import type { CompoundInterestInputs, CompoundInterestResult } from '../../../../Hooks/Calculators/Compound_Interest/compoundInterest.types';
import * as Icon from '../../../../Imports/icons';

type Format = (value: number) => string;

export interface Calculator_Kind {
  icon: ComponentType<{ color?: string }>;
  titleKey: string;
  // A página da calculadora, que abre a simulação que vier em `state.simulationId`
  path: string;
  // Os dados principais numa linha ("10 000 € · 10 anos · 7% anual")
  summary: (inputs: unknown, t: TFunction, format: Format) => string;
  // O número que interessa do resultado, com o nome dele
  headline: (result: unknown, t: TFunction, format: Format) => { label: string; value: string };
}

// Uma calculadora nova que grave simulações entra aqui, pela `abbreviation` dela
export const CALCULATOR_KINDS: Record<string, Calculator_Kind> = {
  'compound-interest': {
    icon: Icon.Trend,
    titleKey: 'compoundInterest.title',
    path: '/Calculators/compound-interest',
    summary: (raw, t, format) => {
      const inputs = raw as CompoundInterestInputs;
      return [
        format(inputs.initialInvestment),
        inputs.additionalInvestment ? `+${format(inputs.additionalInvestment)}` : null,
        t('calculators.yearsCount', { count: inputs.term }),
        `${inputs.interestRate}% ${t(`compoundInterest.${inputs.interestRatePeriod}`).toLowerCase()}`,
      ]
        .filter(Boolean)
        .join(' · ');
    },
    headline: (raw, t, format) => ({
      label: t('compoundInterest.finalBalance'),
      value: format((raw as CompoundInterestResult).summary.finalBalance),
    }),
  },
};
