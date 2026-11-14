import { useTranslation } from 'react-i18next';
import type { Entry_Payload, Sensitivity_Kind, Sensitivity_Param, Verdict_Value } from '../../../../Hooks/Trading/useSimulation';
import { entryLabel } from '../Trading_Simulator/labels';
import { useFactsheetFormat } from './factsheetFormat';

/**
 * Escreve os números das conclusões e do veredicto (calculados no simulador)
 * conforme o que são: %, dinheiro, × a comissão, uma entrada, um filtro, uma
 * regra ou regimes. Também dá o nome de um parâmetro da sensibilidade e de
 * uma variante ('<parâmetro>@<passo>').
 */
// Os parâmetros que são velas e os que são R (os outros são %)
const BAR_KINDS: Sensitivity_Kind[] = ['indicator', 'stopLossBars', 'setupBars', 'stopRuleBars', 'window', 'profileRows'];
const R_KINDS: Sensitivity_Kind[] = ['takeProfitR', 'stopRuleR', 'scaleInR'];

export const useVerdictFormat = (entries: Entry_Payload[], unit: string) => {
  const { t } = useTranslation();
  const f = useFactsheetFormat(unit);

  const value = (item: Verdict_Value): string => {
    const raw = item.value;
    if (raw == null) return '—';
    switch (item.kind) {
      case 'pct':
        return f.percent(raw as number, 1);
      case 'number':
        return f.number(raw as number);
      case 'money':
        return f.money(raw as number);
      case 'mult':
        return `×${f.number(raw as number, 2)}`;
      case 'entry':
        return entryLabel(entries, raw as number, t);
      case 'filter':
        return t(`trading.fsFilter_${raw}`);
      case 'rule':
        return t(`trading.fsRule_${raw}`);
      case 'regimes':
        return (raw as string[]).length ? (raw as string[]).map((key) => t(`trading.fsRegime_${key}`)).join(', ') : '—';
      default:
        return String(raw);
    }
  };

  const values = (items: Record<string, Verdict_Value>) =>
    Object.fromEntries(Object.entries(items).map(([key, item]) => [key, value(item)]));

  // O nome de um parâmetro: a média pelo nome, as últimas N velas pelo valor, o stop/take/… com a
  // entrada e, nos ajustes do stop e nos reforços, o número deles
  const paramLabel = (param: Pick<Sensitivity_Param, 'kind' | 'ref' | 'name' | 'index' | 'operand'>) => {
    if (param.kind === 'indicator') return param.name ?? String(param.ref);
    // O perfil de volume pelo nome e o que se mexe nele
    if (param.kind === 'profileVa' || param.kind === 'profileRows') {
      return `${param.name ?? String(param.ref)} · ${t(`trading.fsSensKind_${param.kind}`)}`;
    }
    if (param.kind === 'window') {
      const kind = param.operand?.kind ?? String(param.ref).split('.')[0];
      // O campo só quando não é o habitual (a máxima na máxima de N velas, a mínima na mínima)
      const usual = kind === 'lowest' ? 'low' : 'high';
      const own = param.operand?.field;
      const field = own && own !== usual && !['bullish', 'bearish'].includes(kind) ? ` · ${t(`trading.field_${own}`)}` : '';
      return `${t(`trading.window_${kind}`)}${field}`;
    }
    return t(`trading.fsSensKind_${param.kind}`, { entry: entryLabel(entries, Number(param.ref), t), position: param.index ?? 1 });
  };

  // O valor de um parâmetro: o período da média, as velas (da mínima do stop, da preparação, do
  // ajuste, das últimas N), o R ou a %
  const paramValue = (param: Pick<Sensitivity_Param, 'kind'>, number: number) =>
    BAR_KINDS.includes(param.kind)
      ? f.number(number)
      : R_KINDS.includes(param.kind)
        ? `${f.number(number, 2)}R`
        : f.percent(number, 2);

  return { f, value, values, paramLabel, paramValue };
};
