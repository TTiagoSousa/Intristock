import { useTranslation } from 'react-i18next';
import type { Capture_Ratios } from '../../../../Hooks/Trading/useSimulation';
import { formatNumber } from '../Trading_Simulator/format';
import Factsheet_Explain from './Factsheet_Explain';

interface Factsheet_Capture_Props {
  table: Capture_Ratios;
  asset: string;
}

/**
 * 1.6 — Captura de subidas e descidas: a estratégia face ao ativo da simulação,
 * nos retornos diários (up e down capture, beta, alpha anual, correlação e batting
 * average). Tudo vem calculado; aqui só se desenha.
 */
const Factsheet_Capture = ({ table, asset }: Factsheet_Capture_Props) => {
  const { t, i18n } = useTranslation();
  const language = i18n.language;

  const minus = (value: number) => (value < 0 ? '−' : '');
  const percent = (value: number | null, signed = false) =>
    value == null ? '—' : `${signed && value > 0 ? '+' : ''}${minus(value)}${formatNumber(Math.abs(value), language, signed ? 1 : 0)}%`;
  const number = (value: number | null) => (value == null ? '—' : `${minus(value)}${formatNumber(Math.abs(value), language, 2)}`);
  const tone = (value: number | null) => (value == null ? '' : value > 0 ? 'Positive' : value < 0 ? 'Negative' : '');

  const rows = [
    { key: 'upCapture', value: percent(table.upCapturePct) },
    { key: 'downCapture', value: percent(table.downCapturePct) },
    { key: 'beta', value: number(table.beta) },
    { key: 'alpha', value: percent(table.alphaPct, true), tone: tone(table.alphaPct) },
    { key: 'correlation', value: number(table.correlation) },
    { key: 'battingAverage', value: percent(table.battingAveragePct) },
  ];

  return (
    <div className="Factsheet_Panel">
      <div className="Factsheet_Panel_Header">
        <div className="Factsheet_Panel_Heading">
          <span className="Factsheet_Panel_Title">
            {t('trading.fsCaptureTitle')}
            <Factsheet_Explain id="sumCapture" title={t('trading.fsCaptureTitle')} />
          </span>
          <span className="Factsheet_Panel_Note">{t('trading.fsCaptureNote', { asset })}</span>
        </div>
      </div>
      <div className="Factsheet_Table_Scroll">
        <table className="Factsheet_Table">
          <thead>
            <tr>
              <th>{t('trading.fsCaptureMetric')}</th>
              <th className="Numeric">{t('trading.fsCaptureValue')}</th>
              <th>{t('trading.fsCaptureReading')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td>{t(`trading.fsCapture_${row.key}`)}</td>
                <td className={`Numeric ${row.tone ?? ''}`}>{row.value}</td>
                <td className="Factsheet_Table_Wrap">{t(`trading.fsCaptureReading_${row.key}`, { asset })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Factsheet_Capture;
