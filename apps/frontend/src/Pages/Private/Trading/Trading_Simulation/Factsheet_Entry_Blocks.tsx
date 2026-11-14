import { useTranslation } from 'react-i18next';
import type { Entry_Hour_Blocks, Entry_Payload } from '../../../../Hooks/Trading/useSimulation';
import Factsheet_Entry_Name from './Factsheet_Entry_Name';
import Factsheet_Panel from './Factsheet_Panel';
import { hourLabel, useFactsheetFormat } from './factsheetFormat';

interface Factsheet_Entry_Blocks_Props {
  table: Entry_Hour_Blocks;
  entries: Entry_Payload[];
  unit: string;
}

// A cor mais forte de uma célula (em % da cor do token, sobre o fundo)
const TINT_MAX = 75;

/**
 * 5.6 — Entrada × bloco de 4 horas: em cada célula os trades e a win rate em
 * cima e o P&L em baixo; a cor é a expectancy (laranja a perder, azul a ganhar,
 * mais forte até ao limite que vem do simulador). No fim, o melhor e o pior
 * bloco de cada entrada. Tudo vem calculado.
 */
const Factsheet_Entry_Blocks = ({ table, entries, unit }: Factsheet_Entry_Blocks_Props) => {
  const { t } = useTranslation();
  const f = useFactsheetFormat(unit);
  const blocks = table.rows[0]?.cells.length ?? 24 / table.blockHours;
  const blockLabel = (block: number | null) =>
    block == null ? '—' : `${hourLabel(block * table.blockHours)} – ${hourLabel((block + 1) * table.blockHours - 1)}`;
  const scale = Math.max(1, table.scale ?? 0);
  // A cor de uma célula: a da ponta (azul ou laranja) misturada no fundo, pela expectancy
  const tint = (expectancy: number) => {
    const share = Math.round((Math.min(scale, Math.abs(expectancy)) / scale) * TINT_MAX);
    const token = expectancy < 0 ? 'cell-negative' : 'cell-positive';
    return `color-mix(in srgb, var(--factsheet-${token}) ${share}%, var(--factsheet-cell-empty))`;
  };

  return (
    <Factsheet_Panel
      title={t('trading.fsEntryBlocksTitle')}
      explain="hoursEntryBlocks"
      note={`${t('trading.fsEntryBlocksNote')}${table.minTrades ? ` · ${t('trading.fsSampleFaded', { min: table.minTrades })}` : ''}`}
    >
      <div className="Factsheet_Table_Scroll">
        <table className="Factsheet_Table Factsheet_Entry_Blocks">
          <thead>
            <tr>
              <th>{t('trading.fsEntryBlocksCol_entry')}</th>
              {[...Array(blocks)].map((_, block) => (
                <th key={block} className="Centered">
                  {blockLabel(block)}
                </th>
              ))}
              <th className="Centered">{t('trading.fsEntryBlocksCol_best')}</th>
              <th className="Centered">{t('trading.fsEntryBlocksCol_worst')}</th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={row.rule}>
                <td>
                  <Factsheet_Entry_Name entries={entries} rule={row.rule} />
                </td>
                {row.cells.map((cell, block) =>
                  cell ? (
                    <td
                      key={block}
                      className={`Factsheet_Entry_Block${cell.trades < (table.minTrades ?? 0) ? ' Faded' : ''}`}
                      style={{ backgroundColor: tint(cell.expectancy) }}
                      title={t('trading.fsEntryBlocksCell', {
                        trades: f.number(cell.trades),
                        winRate: f.percent(cell.winRatePct, 0),
                        pnl: f.money(cell.pnl),
                        expectancy: f.money(cell.expectancy, 2),
                      })}
                    >
                      <strong>
                        {f.number(cell.trades)} · {f.percent(cell.winRatePct, 0)}
                      </strong>
                      <span>{f.money(cell.pnl)}</span>
                    </td>
                  ) : (
                    <td key={block} className="Factsheet_Entry_Block Empty">
                      —
                    </td>
                  ),
                )}
                <td className="Centered Positive">{blockLabel(row.best)}</td>
                <td className="Centered Negative">{blockLabel(row.worst)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Factsheet_Panel>
  );
};

export default Factsheet_Entry_Blocks;
