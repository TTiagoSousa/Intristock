import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Table_Monthly_Detail, Table_Period_Returns } from '../../../../Hooks/Trading/useSimulation';
import Segmented from '../Trading_Simulator/Segmented';
import Factsheet_Monthly_Detail from './Factsheet_Monthly_Detail';
import Factsheet_Panel from './Factsheet_Panel';
import Factsheet_Returns_Grid from './Factsheet_Returns_Grid';
import type { Returns_Cell } from './Factsheet_Returns_Grid';

interface Factsheet_Returns_Props {
  table: Table_Period_Returns;
  // A vista avançada (mês a mês), se a simulação a tiver
  detail?: Table_Monthly_Detail | null;
  // Como se escreve a moeda cotada ("$")
  quoteLabel: string;
}

type Returns_View = 'month' | 'quarter' | 'year';

const VIEWS: Returns_View[] = ['month', 'quarter', 'year'];

/**
 * 1.3 — Tabela de retornos: o retorno em % de cada mês, trimestre ou ano (a
 * escolher no cabeçalho) num mapa de calor da biblioteca (`Factsheet_Returns_Grid`),
 * azul a subir e laranja a descer. Os períodos parciais (o primeiro e o último)
 * vêm marcados. A vista
 * avançada troca-a pela tabela mês a mês; o painel abre em ecrã inteiro. Tudo
 * vem calculado; aqui só se desenha.
 */
const Factsheet_Returns = ({ table, detail, quoteLabel }: Factsheet_Returns_Props) => {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const [view, setView] = useState<Returns_View>('month');
  const [advanced, setAdvanced] = useState(false);
  const showDetail = advanced && !!detail;

  const years = useMemo(() => table.years.map((row) => row.year), [table]);

  // Os nomes curtos dos meses na língua da app ("Jan", "Fev"…)
  const monthNames = useMemo(() => {
    const format = new Intl.DateTimeFormat(language, { month: 'short', timeZone: 'UTC' });
    return Array.from({ length: 12 }, (_, i) => {
      const name = format.format(new Date(Date.UTC(2000, i, 1))).replace('.', '');
      return name.charAt(0).toUpperCase() + name.slice(1);
    });
  }, [language]);

  // As colunas, as linhas e as células da vista escolhida (por ano: uma linha sem
  // nome, com os anos e o período todo)
  const grid = useMemo(() => {
    const largest = (rows: { pct: number }[]) => Math.max(...rows.map((row) => Math.abs(row.pct)), 0.0001);
    if (view === 'year') {
      const cells: Returns_Cell[] = table.years.map((row, x) => ({ x, y: 0, pct: row.pct, partial: row.partial }));
      cells.push({ x: years.length, y: 0, pct: table.totalPct, partial: false });
      return { columns: [...years.map(String), t('trading.fsReturnsTotal')], rows: [''], cells, scale: largest(cells) };
    }
    const names = view === 'month' ? monthNames : [1, 2, 3, 4].map((n) => t('trading.fsReturnsQuarter', { n }));
    const periods =
      view === 'month'
        ? table.months.map((row) => ({ ...row, n: row.month }))
        : table.quarters.map((row) => ({ ...row, n: row.quarter }));
    const cells: Returns_Cell[] = periods.map((row) => ({
      x: row.n - 1,
      y: years.indexOf(row.year),
      pct: row.pct,
      partial: row.partial,
    }));
    table.years.forEach((row) => cells.push({ x: names.length, y: years.indexOf(row.year), pct: row.pct, partial: row.partial }));
    return { columns: [...names, t('trading.fsReturnsYear')], rows: years.map(String), cells, scale: largest(periods) };
  }, [view, table, years, monthNames, t]);

  return (
    <Factsheet_Panel
      explain={showDetail ? 'sumMonthlyDetail' : 'sumReturns'}
      title={showDetail ? t('trading.fsMonthlyTitle') : t(`trading.fsReturnsTitle_${view}`)}
      note={showDetail ? t('trading.fsMonthlyNote') : t('trading.fsReturnsNote')}
      actions={
        <>
          {!showDetail && (
            <Segmented
              value={view}
              onChange={setView}
              label={t('trading.fsReturnsViewLabel')}
              options={VIEWS.map((value) => ({ value, label: t(`trading.fsReturnsView_${value}`) }))}
            />
          )}
          {detail && (
            <button
              type="button"
              className={`Factsheet_Panel_Button${advanced ? ' Active' : ''}`}
              aria-pressed={advanced}
              onClick={() => setAdvanced((value) => !value)}
            >
              {t(advanced ? 'trading.fsReturnsExitAdvanced' : 'trading.fsReturnsAdvanced')}
            </button>
          )}
        </>
      }
    >
      {showDetail && detail ? (
        <Factsheet_Monthly_Detail table={detail} quoteLabel={quoteLabel} />
      ) : (
        <Factsheet_Returns_Grid columns={grid.columns} rows={grid.rows} cells={grid.cells} scale={grid.scale} />
      )}
    </Factsheet_Panel>
  );
};

export default Factsheet_Returns;
