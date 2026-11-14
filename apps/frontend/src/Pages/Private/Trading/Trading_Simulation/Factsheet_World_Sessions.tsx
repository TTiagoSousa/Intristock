import { useTranslation } from 'react-i18next';
import type { Session_Edges, Session_Summary, Work_Hours, World_Sessions } from '../../../../Hooks/Trading/useSimulation';
import Factsheet_Panel from './Factsheet_Panel';
import { hourLabel, useFactsheetFormat } from './factsheetFormat';

// 5.10 — As três tabelas das sessões mundiais; tudo vem calculado pelo simulador

interface Sessions_Props {
  table: World_Sessions;
  unit: string;
}

// Por sessão mundial aberta na hora (UTC) de entrada: uma hora com duas sessões conta nas duas
export const Factsheet_World_Sessions = ({ table, unit }: Sessions_Props) => {
  const { t } = useTranslation();
  const f = useFactsheetFormat(unit);
  return (
    <Factsheet_Panel title={t('trading.fsWorldTitle')} explain="hoursWorld" note={t('trading.fsWorldNote')}>
      <div className="Factsheet_Table_Scroll">
        <table className="Factsheet_Table">
          <thead>
            <tr>
              <th>{t('trading.fsWorldCol_session')}</th>
              <th>{t('trading.fsWorldCol_hours')}</th>
              <th className="Numeric">{t('trading.fsHourCol_trades')}</th>
              <th className="Numeric">{t('trading.fsHourCol_winRate')}</th>
              <th className="Numeric">{t('trading.fsHourCol_stops')}</th>
              <th className="Numeric">{t('trading.fsHourCol_pnl')}</th>
              <th className="Numeric">{t('trading.fsHourCol_expectancy')}</th>
              <th className="Numeric">{t('trading.fsWorldCol_volatility')}</th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={row.session}>
                <td className="Strong">{t(`trading.fsWorld_${row.session}`)}</td>
                <td className="Numeric Left">{`${hourLabel(row.from)} – ${hourLabel(row.to)}`}</td>
                <td className="Numeric">{f.number(row.trades)}</td>
                <td className="Numeric">{f.percent(row.winRatePct, 0)}</td>
                <td className={`Numeric ${row.stops ? 'Negative' : ''}`}>{f.number(row.stops)}</td>
                <td className={`Numeric Strong ${f.tone(row.pnl)}`}>{row.trades ? f.money(row.pnl) : '—'}</td>
                <td className={`Numeric ${f.tone(row.expectancy)}`}>{f.money(row.expectancy, 2)}</td>
                <td className="Numeric">{f.percent(row.volatilityPct, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Factsheet_Panel>
  );
};

interface Work_Props {
  table: Work_Hours;
  unit: string;
  // O nome do fuso (ex.: "Lisboa")
  zoneName: string;
}

// O horário de trabalho contra as noites, as madrugadas e os fins de semana, e o inverno contra o verão
export const Factsheet_Work_Hours = ({ table, unit, zoneName }: Work_Props) => {
  const { t } = useTranslation();
  const f = useFactsheetFormat(unit);
  const offsets = table.rows.filter((row) => row.period === 'offset').map((row) => row.offset ?? 0);
  const label = (row: Work_Hours['rows'][number]) => {
    if (row.period !== 'offset') return t(`trading.fsWork_${row.period}`);
    const utc = `UTC${(row.offset ?? 0) >= 0 ? '+' : ''}${row.offset ?? 0}`;
    if (offsets.length < 2) return t('trading.fsWork_offsetOnly', { utc });
    return t(row.offset === Math.min(...offsets) ? 'trading.fsWork_winter' : 'trading.fsWork_summer', { utc });
  };
  const offWins = table.offPnl > table.workPnl;

  return (
    <Factsheet_Panel title={t('trading.fsWorkTitle')} explain="hoursWork" note={t('trading.fsWorkNote', { zone: zoneName })}>
      <div className="Factsheet_Table_Scroll">
        <table className="Factsheet_Table">
          <thead>
            <tr>
              <th>{t('trading.fsWorkCol_period')}</th>
              <th className="Numeric">{t('trading.fsWorkCol_hours')}</th>
              <th className="Numeric">{t('trading.fsHourCol_trades')}</th>
              <th className="Numeric">{t('trading.fsWorkCol_perHundred')}</th>
              <th className="Numeric">{t('trading.fsHourCol_winRate')}</th>
              <th className="Numeric">{t('trading.fsHourCol_pnl')}</th>
              <th className="Numeric">{t('trading.fsHourCol_expectancy')}</th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={`${row.period}${row.offset ?? ''}`}>
                <td className="Strong">{label(row)}</td>
                <td className="Numeric">{f.number(row.hours)}</td>
                <td className="Numeric">{f.number(row.trades)}</td>
                <td className="Numeric">{f.number(row.perHundred, 2)}</td>
                <td className="Numeric">{f.percent(row.winRatePct, 0)}</td>
                <td className={`Numeric Strong ${f.tone(row.pnl)}`}>{row.trades ? f.money(row.pnl) : '—'}</td>
                <td className={`Numeric ${f.tone(row.expectancy)}`}>{f.money(row.expectancy, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="Factsheet_Work_Verdict">
        {t(offWins ? 'trading.fsWorkVerdictOff' : 'trading.fsWorkVerdictWork', {
          off: f.money(table.offPnl),
          work: f.money(table.workPnl),
        })}
      </p>
    </Factsheet_Panel>
  );
};

interface Edges_Props {
  table: Session_Edges;
  unit: string;
}

// A primeira e a última hora de cada bolsa contra o resto da sessão
export const Factsheet_Session_Edges = ({ table, unit }: Edges_Props) => {
  const { t } = useTranslation();
  const f = useFactsheetFormat(unit);
  const cells = (value: Session_Summary, key: string) => [
    <td key={`${key}-trades`} className="Numeric">
      {f.number(value.trades)}
    </td>,
    <td key={`${key}-pnl`} className={`Numeric Strong ${f.tone(value.pnl)}`}>
      {value.trades ? f.money(value.pnl) : '—'}
    </td>,
    <td key={`${key}-stops`} className="Numeric">
      {f.percent(value.stopsPct, 0)}
    </td>,
  ];
  return (
    <Factsheet_Panel title={t('trading.fsEdgesTitle')} explain="hoursEdges" note={t('trading.fsEdgesNote')}>
      <div className="Factsheet_Table_Scroll">
        <table className="Factsheet_Table">
          <thead>
            <tr>
              <th>{t('trading.fsWorldCol_session')}</th>
              <th className="Numeric">{t('trading.fsEdgesCol_firstTrades')}</th>
              <th className="Numeric">{t('trading.fsHourCol_pnl')}</th>
              <th className="Numeric">{t('trading.fsHourCol_stopsPct')}</th>
              <th className="Numeric">{t('trading.fsEdgesCol_lastTrades')}</th>
              <th className="Numeric">{t('trading.fsHourCol_pnl')}</th>
              <th className="Numeric">{t('trading.fsHourCol_stopsPct')}</th>
              <th className="Numeric">{t('trading.fsEdgesCol_restTrades')}</th>
              <th className="Numeric">{t('trading.fsHourCol_pnl')}</th>
              <th className="Numeric">{t('trading.fsHourCol_stopsPct')}</th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={row.session}>
                <td className="Strong">{`${t(`trading.fsWorld_${row.session}`)} (${hourLabel(row.first)} / ${hourLabel(row.last)})`}</td>
                {cells(row.firstHour, 'first')}
                {cells(row.lastHour, 'last')}
                {cells(row.rest, 'rest')}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Factsheet_Panel>
  );
};
