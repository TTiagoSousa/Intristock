import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { Data_View_Filter, Data_View_Result, Data_View_Stats } from '../../../../Hooks/Companies/useCompanyData';
import { localeOf } from '../../../../utils/locale';
import { Data_Cell } from './Data_Table_Page';
import Data_Row_Info from './Data_Row_Info';
import Data_Row_Comments from './Data_Row_Comments';
import Fit_Table_Wrap from './Fit_Table_Wrap';

const Plain_Wrap = ({ children }: { children: ReactNode }) => <div className="Table_Wrap">{children}</div>;
import { useRowCommentCounts } from '../../../../Hooks/Companies/useCompanyLeads';
import { Data_Header_Filter } from './Data_Grid_Tools';
import { DEFAULT_COLUMNS, type Data_Grid } from './useDataGrid';
import { isEmptyValue } from './dataHelpers';

interface Data_View_Stats_Props {
  stats: Data_View_Stats;
  leftName: string;
  rightName: string;
  // Com ele os números são botões que filtram as linhas (a página da tabela unida)
  active?: Data_View_Filter;
  onPick?: (filter: Data_View_Filter) => void;
}

/** Os números da junção: com par, só em A, só em B e repetidas (uma linha de A com mais de um par em B). */
export const Data_View_Stats_Cards = ({ stats, leftName, rightName, active, onPick }: Data_View_Stats_Props) => {
  const { t, i18n } = useTranslation();
  const locale = localeOf(i18n.language);
  const cards: { id: Data_View_Filter; label: string; value: number; foot: string }[] = [
    { id: 'matched', label: t('callCenter.statMatched'), value: stats.matched, foot: t('callCenter.statMatchedFoot') },
    { id: 'leftOnly', label: t('callCenter.statOnly', { name: leftName }), value: stats.leftOnly, foot: t('callCenter.statOf', { count: stats.leftRows }) },
    { id: 'rightOnly', label: t('callCenter.statOnly', { name: rightName }), value: stats.rightOnly, foot: t('callCenter.statOf', { count: stats.rightRows }) },
    { id: 'duplicates', label: t('callCenter.statDuplicates'), value: stats.duplicates, foot: t('callCenter.statDuplicatesFoot') },
  ];

  return (
    <div className="Call_Center_Stats">
      {cards.map((card) => {
        const content = (
          <>
            <span className="Eyebrow">{card.label}</span>
            <span className="Call_Center_Stat_Value">{card.value.toLocaleString(locale)}</span>
            <span className="Call_Center_Sub">{card.foot}</span>
          </>
        );
        return onPick ? (
          <button
            key={card.id}
            type="button"
            className={`Call_Center_Stat Clickable${active === card.id ? ' Active' : ''}`}
            aria-pressed={active === card.id}
            onClick={() => onPick(active === card.id ? 'all' : card.id)}
          >
            {content}
          </button>
        ) : (
          <div key={card.id} className="Call_Center_Stat">
            {content}
          </div>
        );
      })}
    </div>
  );
};

/** As linhas de uma tabela unida, com o estado de cada uma (com par, só de um lado, repetida). */
export const Data_View_Rows = ({
  result,
  grid,
  comments,
}: {
  result: Pick<Data_View_Result, 'columns' | 'rows'>;
  grid?: Data_Grid;
  /// Com ela, cada linha mostra os comentários das Leads (a unida gravada)
  comments?: { companyId: string; viewId: string };
}) => {
  const { t, i18n } = useTranslation();
  const { data: commentCounts } = useRowCommentCounts(comments?.companyId, 'view', comments?.viewId);
  const locale = localeOf(i18n.language);

  // Na tabela as escolhidas (sem escolha, as primeiras); a linha toda fica no «Info»
  const shown = grid ? grid.shown : result.columns.slice(0, DEFAULT_COLUMNS);

  if (result.rows.length === 0) return <span className="Call_Center_Message">{t('callCenter.viewRowsEmpty')}</span>;

  // Na página da unida (com os filtros) a tabela vai até ao fundo do ecrã; na pré-visualização fica como está
  const Wrap = grid ? Fit_Table_Wrap : Plain_Wrap;
  return (
    <Wrap>
      <table className="Table">
        <thead>
          <tr>
            <th>{t('callCenter.match')}</th>
            {shown.map((column) => (
              <th key={column.key} className={column.type === 'number' || column.type === 'money' ? 'Right' : undefined}>
                <span className="Call_Center_Head_Cell">
                  <span className="Call_Center_Side">{column.side === 'left' ? 'A' : 'B'}</span> {column.label}
                  {grid && <Data_Header_Filter grid={grid} column={column} />}
                </span>
              </th>
            ))}
            <th />
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row, index) => (
            <tr key={index}>
              <td>
                <span className={`Pill${row.match === 'matched' ? '' : ' Warn'}`}>{t(`callCenter.match_${row.match}`)}</span>
                {row.duplicate && <span className="Pill Warn Call_Center_Pill">{t('callCenter.matchDuplicate')}</span>}
              </td>
              {shown.map((column) => (
                <td key={column.key} className={column.type === 'number' || column.type === 'money' ? 'Right Num' : undefined}>
                  <Data_Cell value={row.values[column.key]} type={column.type} locale={locale} />
                </td>
              ))}
              <td>
                <div className="Call_Center_Row_Actions">
                  {comments && row.ref && (
                    <Data_Row_Comments
                      companyId={comments.companyId}
                      sourceType="view"
                      sourceId={comments.viewId}
                      row={row.ref}
                      count={commentCounts?.[row.ref] ?? 0}
                    />
                  )}
                  <Data_Row_Info
                    title={t(`callCenter.match_${row.match}`)}
                    fields={result.columns
                      .filter((column) => !isEmptyValue(row.values[column.key]))
                      .map((column) => ({
                        key: column.key,
                        label: (
                          <>
                            <span className="Call_Center_Side">{column.side === 'left' ? 'A' : 'B'}</span> {column.label}
                          </>
                        ),
                        value: <Data_Cell value={row.values[column.key]} type={column.type} locale={locale} />,
                      }))}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Wrap>
  );
};
