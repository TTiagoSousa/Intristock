import { useTranslation } from 'react-i18next';
import type { Profile_Cards, Profile_Groups, Simulation_Run } from '../../../../Hooks/Trading/useSimulation';
import Factsheet_Card from './Factsheet_Card';
import Factsheet_Heading from './Factsheet_Heading';
import Factsheet_Hour_Bars from './Factsheet_Hour_Bars';
import type { Hour_Bars_Part } from './Factsheet_Hour_Bars';
import Factsheet_Panel from './Factsheet_Panel';
import { moneyUnit, useFactsheetFormat } from './factsheetFormat';

interface Factsheet_Profile_Props {
  cards: Profile_Cards;
  position: Profile_Groups | null | undefined;
  distance: Profile_Groups | null | undefined;
  run: Simulation_Run;
}

// Abaixo disto, a barra da distância ao POC fica esbatida (amostra pequena)
const MIN_TRADES = 5;

/**
 * 4.10 — O perfil de volume que a estratégia usa: os cartões (as sessões, as
 * que abrem fora da área de valor da anterior e se voltam a ela e ao POC, as que
 * abrem dentro e rompem, os POC virgens que o preço voltou a tocar e as entradas
 * dentro da área de valor), os trades por onde entraram face à área de valor
 * anterior e o R médio pela distância ao POC anterior. Tudo do simulador.
 */
const Factsheet_Profile = ({ cards, position, distance, run }: Factsheet_Profile_Props) => {
  const { t } = useTranslation();
  const f = useFactsheetFormat(moneyUnit(run.instrument.quote));
  const pct = (value: number | null | undefined) => (value == null ? '—' : f.percent(value, 0));

  // As distâncias ao POC: "<-2" → "< −2%", "-2:-1" → "−2 a −1%"
  const distanceLabel = (key: string) => {
    if (key.startsWith('<') || key.startsWith('>')) return `${key[0]} ${f.signed(Number(key.slice(1)), 1)}%`;
    const [low, high] = key.split(':').map(Number);
    return t('trading.fsProfileRange', { from: f.signed(low, 1), to: f.signed(high, 1) });
  };
  const rows = distance?.rows ?? [];
  const parts: Hour_Bars_Part[] = [
    { id: 'gain', name: t('trading.fsBarsGain'), colorToken: 'chart-strategy' },
    { id: 'loss', name: t('trading.fsBarsLoss'), colorToken: 'chart-drawdown' },
  ];

  return (
    <section className="Factsheet_Section">
      <Factsheet_Heading
        title={t('trading.fsProfileTitle')}
        info={t('trading.fsProfileInfo', { name: cards.name || t('trading.kindLong_svp') })}
      />
      <div className="Factsheet_Cards">
        <Factsheet_Card
          label={t('trading.fsProfileCard_sessions')}
          help={t('trading.fsProfileHelp_sessions')}
          explain="entryProfileSessions"
          value={f.number(cards.sessions ?? 0)}
          detail={t('trading.fsProfileCard_sessionsDetail', { width: cards.vaWidthPct == null ? '—' : f.percent(cards.vaWidthPct, 2) })}
        />
        <Factsheet_Card
          label={t('trading.fsProfileCard_outside')}
          help={t('trading.fsProfileHelp_outside')}
          explain="entryProfileOutside"
          value={pct(cards.openedOutsidePct)}
          detail={t('trading.fsProfileCard_outsideDetail', { above: f.number(cards.openedAbove ?? 0), below: f.number(cards.openedBelow ?? 0) })}
        />
        <Factsheet_Card
          label={t('trading.fsProfileCard_returned')}
          help={t('trading.fsProfileHelp_returned')}
          explain="entryProfileReturned"
          value={pct(cards.returnedInsidePct)}
          detail={t('trading.fsProfileCard_returnedDetail', { poc: pct(cards.reachedPocPct) })}
        />
        <Factsheet_Card
          label={t('trading.fsProfileCard_brokeOut')}
          help={t('trading.fsProfileHelp_brokeOut')}
          explain="entryProfileBrokeOut"
          value={pct(cards.brokeOutPct)}
          detail={t('trading.fsProfileCard_brokeOutDetail', { count: cards.openedInside ?? 0 })}
        />
        <Factsheet_Card
          label={t('trading.fsProfileCard_naked')}
          help={t('trading.fsProfileHelp_naked')}
          explain="entryProfileNaked"
          value={pct(cards.nakedTouchedPct)}
          detail={t('trading.fsProfileCard_nakedDetail', {
            bars: cards.nakedMedianBars == null ? '—' : f.number(cards.nakedMedianBars),
            open: f.number(cards.nakedUntouched ?? 0),
          })}
        />
        <Factsheet_Card
          label={t('trading.fsProfileCard_inside')}
          help={t('trading.fsProfileHelp_inside')}
          explain="entryProfileInside"
          value={pct(cards.tradesInsidePct)}
          detail={t('trading.fsProfileCard_insideDetail', { count: cards.trades ?? 0 })}
        />
      </div>

      <div className="Factsheet_Grid Two">
        {position?.available && position.rows && (
          <Factsheet_Panel title={t('trading.fsProfilePositionTitle')} explain="entryProfilePosition" note={t('trading.fsProfilePositionNote')}>
            <div className="Factsheet_Table_Scroll">
              <table className="Factsheet_Table">
                <thead>
                  <tr>
                    <th>{t('trading.fsProfilePositionWhere')}</th>
                    <th className="Numeric">{t('trading.fsHourTrades')}</th>
                    <th className="Numeric">{t('trading.fsHourWinRate')}</th>
                    <th className="Numeric">{t('trading.fsProfileAvgR')}</th>
                    <th className="Numeric">{t('trading.fsProfileAvgPnl')}</th>
                    <th className="Numeric">{t('trading.fsProfilePnl')}</th>
                  </tr>
                </thead>
                <tbody>
                  {position.rows.map((row) => (
                    <tr key={row.key}>
                      <td>{t(`trading.fsProfilePosition_${row.key}`)}</td>
                      <td className="Numeric">{f.number(row.trades)}</td>
                      <td className="Numeric">{row.trades ? f.percent(row.winRatePct, 0) : '—'}</td>
                      <td className={`Numeric ${f.tone(row.avgR)}`}>{row.trades ? f.r(row.avgR) : '—'}</td>
                      <td className={`Numeric ${f.tone(row.avgPnl)}`}>{row.trades ? f.money(row.avgPnl) : '—'}</td>
                      <td className={`Numeric Strong ${f.tone(row.pnl)}`}>{row.trades ? f.money(row.pnl) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Factsheet_Panel>
        )}

        {distance?.available && rows.length > 0 && (
          <Factsheet_Hour_Bars
            title={t('trading.fsProfileDistanceTitle')}
            explain="entryProfileDistance"
            note={t('trading.fsProfileDistanceNote', { count: MIN_TRADES })}
            parts={parts}
            categories={rows.map((row) => distanceLabel(row.key))}
            values={rows.map((row) => (row.trades ? (row.avgR ?? 0) : null))}
            labels={rows.map((row) => (row.trades ? f.r(row.avgR) : ''))}
            faded={rows.map((row) => row.trades < MIN_TRADES)}
            partOf={(_, value) => (value < 0 ? 'loss' : 'gain')}
            tooltip={(index) => {
              const row = rows[index];
              return `<strong>${distanceLabel(row.key)}</strong><br>${t('trading.fsHourTrades')}: <strong>${f.number(row.trades)}</strong><br>${t('trading.fsHourWinRate')}: <strong>${f.percent(row.winRatePct, 0)}</strong><br>${t('trading.fsProfileAvgR')}: <strong>${f.r(row.avgR)}</strong><br>${t('trading.fsProfilePnl')}: <strong>${f.money(row.pnl)}</strong>`;
            }}
          />
        )}
      </div>
    </section>
  );
};

export default Factsheet_Profile;
