import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { createGauge } from 'openchartscandle/gauge';
import 'openchartscandle/style.css';
import { useTheme } from '../../../../Contexts/ThemeContext';
import type { Score_Label, Score_Part, Strategy_Score } from '../../../../Hooks/Trading/useSimulation';
import { formatNumber } from '../Trading_Simulator/format';
import Factsheet_Explain from './Factsheet_Explain';

interface Factsheet_Score_Props {
  score: Strategy_Score;
}

// A cor de cada rótulo (o anel e o número) e de cada barra (pela fração da parte)
const LABEL_TONE: Record<Score_Label, string> = { solid: 'High', promising: 'Mid', notReady: 'Low' };
const toneOf = (fraction: number) => (fraction >= 0.7 ? 'High' : fraction >= 0.4 ? 'Mid' : 'Low');

/**
 * A nota da estratégia (1.1): o anel com a nota de 0 a 100, o rótulo e o que
 * quer dizer, as seis partes (pontos / peso) e, ao abrir, como se calcula cada
 * uma com os números desta simulação. Tudo vem calculado; aqui só se desenha.
 */
const Factsheet_Score = ({ score }: Factsheet_Score_Props) => {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const { theme } = useTheme();
  const rootRef = useRef<HTMLDivElement>(null);
  const gaugeRef = useRef<HTMLDivElement>(null);
  const tone = LABEL_TONE[score.label];

  useEffect(() => {
    const element = gaugeRef.current;
    const root = rootRef.current;
    if (!element || !root) return;
    let gauge: ReturnType<typeof createGauge> | null = null;
    // Na frame seguinte: o data-theme do <html> muda depois deste efeito
    const frame = requestAnimationFrame(() => {
      const style = getComputedStyle(root);
      const token = (name: string) => style.getPropertyValue(`--factsheet-${name}`).trim();
      const color = token(`score-${tone.toLowerCase()}`);
      gauge = createGauge(element, {
        value: score.value,
        min: 0,
        max: 100,
        shape: 'full',
        thickness: 0.13,
        padding: 4,
        needle: false,
        progress: { color },
        ticks: { show: false },
        showMinMax: false,
        valueColorByZone: false,
        valueFormatter: (value) => formatNumber(value, language, 0),
        title: t('trading.fsScoreOf'),
        tooltip: false,
        theme: {
          background: 'transparent',
          text: color,
          muted: token('detail'),
          track: token('score-track'),
          font: getComputedStyle(document.body).fontFamily,
        },
        animation: { duration: 700, easing: 'smooth' },
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      gauge?.destroy();
    };
  }, [score.value, tone, language, t, theme]);

  const num = (value: number | null | undefined, digits: number) => (value == null ? '—' : formatNumber(value, language, digits));
  const pct = (value: number | null | undefined, digits = 0) => (value == null ? '—' : `${num(value, digits)}%`);
  const signedPct = (value: number | null | undefined, digits = 1) =>
    value == null
      ? '—'
      : `${value > 0 ? '+' : value < 0 ? '−' : ''}${formatNumber(Math.abs(value), language, digits)}%`;
  const scales = score.scales;

  // A fórmula de cada parte com os números desta simulação
  const formula = (part: Score_Part) => {
    switch (part.key) {
      case 'profitability':
        return t('trading.fsScoreFormula_profitability', {
          sharpe: num(part.sharpe, 2),
          sharpeFull: num(scales.sharpeFull, 1),
          cagr: pct(part.cagrPct),
          cagrFull: pct(scales.cagrFullPct),
        });
      case 'risk':
        return t('trading.fsScoreFormula_risk', {
          drawdown: pct(part.maxDrawdownPct),
          drawdownZero: pct(scales.drawdownZeroPct),
          volatility: pct(part.volatilityPct),
          volatilityZero: pct(scales.volatilityZeroPct),
        });
      case 'outOfSample':
        return t('trading.fsScoreFormula_outOfSample', {
          ret: signedPct(part.returnPct),
          pfOut: num(part.profitFactorOut, 2),
          pfIn: num(part.profitFactorIn, 2),
          pct: num(part.outOfSamplePct, 0),
        });
      case 'significance':
        return t('trading.fsScoreFormula_significance', {
          trades: num(part.trades, 0),
          tradesFull: num(scales.tradesFull, 0),
          psr: part.psr == null ? '—' : pct(part.psr * 100),
        });
      case 'stability':
        return t('trading.fsScoreFormula_stability', { r2: num(part.r2, 2) });
      case 'costs':
        return t('trading.fsScoreFormula_costs', { share: pct(part.costsPct), zero: pct(scales.costsZeroPct) });
    }
  };

  return (
    <div className="Factsheet_Score" ref={rootRef}>
      <div className="Factsheet_Score_Gauge" ref={gaugeRef} />

      <div className="Factsheet_Score_Body">
        <div className="Factsheet_Score_Heading">
          <strong className="Factsheet_Score_Label">
            {t(`trading.fsScoreLabel_${score.label}`)}
            <Factsheet_Explain id="sumScore" title={t(`trading.fsScoreLabel_${score.label}`)} />
          </strong>
          <span className="Factsheet_Score_Meaning">{t(`trading.fsScoreMeaning_${score.label}`)}</span>
        </div>

        <ul className="Factsheet_Score_Parts">
          {score.parts.map((part) => (
            <li key={part.key} className="Factsheet_Score_Part">
              <span className="Factsheet_Score_Name">{t(`trading.fsScorePart_${part.key}`)}</span>
              <span className="Factsheet_Score_Track">
                <span
                  className={`Factsheet_Score_Bar ${toneOf(part.fraction)}`}
                  style={{ width: `${Math.max(0, Math.min(1, part.fraction)) * 100}%` }}
                />
              </span>
              <span className="Factsheet_Score_Points">
                {formatNumber(Math.round(part.points), language, 0)} / {part.weight}
              </span>
            </li>
          ))}
        </ul>

        <details className="Factsheet_Score_How">
          <summary>{t('trading.fsScoreHow')}</summary>
          <p>{t('trading.fsScoreHowIntro')}</p>
          <dl>
            {score.parts.map((part) => (
              <div key={part.key} className="Factsheet_Score_Formula">
                <dt>{t(`trading.fsScorePart_${part.key}`)}</dt>
                <dd>{formula(part)}</dd>
              </div>
            ))}
          </dl>
          <p>{t('trading.fsScoreHowLabels')}</p>
        </details>
      </div>
    </div>
  );
};

export default Factsheet_Score;
