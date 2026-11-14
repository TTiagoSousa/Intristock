import { useTranslation } from 'react-i18next';
import type { Signal_Funnel } from '../../../../Hooks/Trading/useSimulation';
import { formatNumber } from '../Trading_Simulator/format';
import Factsheet_Explain from './Factsheet_Explain';

interface Factsheet_Funnel_Props {
  funnel: Signal_Funnel;
}

// A cor de cada barra: velas, sinais, bloqueados, ordens, trades e trades com lucro
type Funnel_Tone = 'Bars' | 'Signals' | 'Blocked' | 'Orders' | 'Trades' | 'Wins';

interface Funnel_Row {
  key: string;
  value: number;
  tone: Funnel_Tone;
}

/**
 * 2.2 — Funil de sinais: do sinal ao trade. Uma barra por contagem; as velas
 * simuladas enchem a sua, as outras medem-se pelos sinais. Cada sinal conta uma
 * vez, no primeiro motivo que o parou. Tudo vem contado pelo motor.
 */
const Factsheet_Funnel = ({ funnel }: Factsheet_Funnel_Props) => {
  const { t, i18n } = useTranslation();
  const language = i18n.language;

  const rows: Funnel_Row[] = [
    { key: 'simulatedBars', value: funnel.simulatedBars, tone: 'Bars' },
    { key: 'signals', value: funnel.signals, tone: 'Signals' },
    { key: 'blockedSchedule', value: funnel.blockedSchedule, tone: 'Blocked' },
    { key: 'blockedCooldown', value: funnel.blockedCooldown, tone: 'Blocked' },
    { key: 'blockedPyramid', value: funnel.blockedPyramid, tone: 'Blocked' },
    { key: 'blockedMaxPositions', value: funnel.blockedMaxPositions, tone: 'Blocked' },
    { key: 'blockedOpposite', value: funnel.blockedOpposite, tone: 'Blocked' },
    { key: 'blockedDaily', value: funnel.blockedDaily, tone: 'Blocked' },
    { key: 'blockedGuards', value: funnel.blockedGuards, tone: 'Blocked' },
    // Só com condições da conta («só entra se») que travaram algum sinal
    ...((funnel.blockedContext ?? 0) > 0
      ? [{ key: 'blockedContext', value: funnel.blockedContext ?? 0, tone: 'Blocked' as const }]
      : []),
    // Só aparece quando aconteceu (o capital acabou)
    ...(funnel.noCapital > 0 ? [{ key: 'noCapital', value: funnel.noCapital, tone: 'Blocked' as const }] : []),
    { key: 'ordersPlaced', value: funnel.ordersPlaced, tone: 'Orders' },
    { key: 'ordersExpired', value: funnel.ordersExpired, tone: 'Orders' },
    { key: 'rejectedMinimum', value: funnel.rejectedMinimum, tone: 'Blocked' },
    // Só com o stop na mínima/máxima ou num nível, quando ficava do lado errado do preço
    ...((funnel.invalidStop ?? 0) > 0 ? [{ key: 'invalidStop', value: funnel.invalidStop ?? 0, tone: 'Blocked' as const }] : []),
    { key: 'trades', value: funnel.trades, tone: 'Trades' },
    { key: 'winningTrades', value: funnel.winningTrades, tone: 'Wins' },
  ];
  const width = (row: Funnel_Row) => {
    if (row.key === 'simulatedBars') return row.value > 0 ? 100 : 0;
    return funnel.signals > 0 ? Math.min(100, (row.value / funnel.signals) * 100) : 0;
  };

  return (
    <div className="Factsheet_Panel">
      <div className="Factsheet_Panel_Header">
        <div className="Factsheet_Panel_Heading">
          <span className="Factsheet_Panel_Title">
            {t('trading.fsFunnelTitle')}
            <Factsheet_Explain id="setupFunnel" title={t('trading.fsFunnelTitle')} />
          </span>
          <span className="Factsheet_Panel_Note">{t('trading.fsFunnelNote')}</span>
        </div>
      </div>
      <div className="Factsheet_Funnel">
        {rows.map((row) => (
          <div key={row.key} className="Factsheet_Funnel_Row">
            <span className="Factsheet_Funnel_Label">{t(`trading.fsFunnel_${row.key}`)}</span>
            <span className="Factsheet_Funnel_Track">
              <span className={`Factsheet_Funnel_Fill ${row.tone}`} style={{ width: `${width(row)}%` }} />
            </span>
            <span className="Factsheet_Funnel_Value">{formatNumber(row.value, language, 0)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Factsheet_Funnel;
