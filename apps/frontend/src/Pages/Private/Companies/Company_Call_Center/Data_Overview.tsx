import { useNavigate } from 'react-router';
import { callCenterBase } from '../../../../Containers/Navs/Navigation_Home/Menu_Itins';
import { useTranslation } from 'react-i18next';
import { useCompany } from '../../../../Contexts/Company_Context';
import { useDataTables, useDataViews } from '../../../../Hooks/Companies/useCompanyData';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import { localeOf } from '../../../../utils/locale';
import Data_Shell from './Data_Shell';
import Data_Connections from './Data_Connections';

interface Overview_Row {
  id: string;
  name: string;
  path: string;
  kind: string;
  // A chave de uma tabela, ou as duas tabelas de uma unida
  detail: string | null;
  rows: number | null;
  columns: number;
  updatedAt: string | null;
}

/**
 * Os dados do call center numa lista só: as tabelas (de um ficheiro ou escritas
 * à mão) e as tabelas unidas. Clicar numa linha abre-a.
 */
const Overview_Body = ({ company }: { company: { id: string; slug: string } }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { can } = useCompany();
  const canManage = can('data.manage');
  const locale = localeOf(i18n.language);
  const { data: tables, error: tablesError, reload: reloadTables } = useDataTables(company.id);
  const { data: views, error: viewsError } = useDataViews(company.id);
  const base = `${callCenterBase(company.slug)}/dados`;
  const error = tablesError ?? viewsError;
  const loaded = tables && views;

  const rows: Overview_Row[] = loaded
    ? [
        ...tables.map((table) => ({
          id: table.id,
          name: table.name,
          path: `${base}/tabela/${table.id}`,
          kind: t(`callCenter.source_${table.source}`),
          detail: table.keyColumn
            ? t('callCenter.keyIs', {
                column: table.columns.find((column) => column.key === table.keyColumn)?.label ?? table.keyColumn,
              })
            : null,
          rows: table.rowCount,
          columns: table.columns.length,
          updatedAt: table.lastImportAt ?? table.updatedAt,
        })),
        ...views.map((view) => ({
          id: view.id,
          name: view.name,
          path: `${base}/unida/${view.id}`,
          kind: t('callCenter.crumbView'),
          detail: `${view.leftTable.name} + ${view.rightTable.name} · ${t(`callCenter.join_${view.joinType}`)}`,
          rows: null,
          columns: view.columns.length,
          updatedAt: view.updatedAt,
        })),
      ].sort((a, b) => a.name.localeCompare(b.name, locale))
    : [];

  return (
    <>
      <div className="Page_Head">
        {canManage && (
          <div className="Call_Center_Head_Actions">
            <Simple_Button
              text={t('callCenter.newView')}
              onClick={() => navigate(`${base}/unida/nova`)}
              disabled={!tables || tables.length === 0}
              variant="Ghost"
              auto
            />
            <Simple_Button text={t('callCenter.newTable')} onClick={() => navigate(`${base}/tabela/nova`)} auto />
          </div>
        )}
      </div>

      <div className="Card Call_Center_Card">
        <div className="Card_Header">
          <div className="Card_Header_Text">
            <span className="Card_Title">{t('callCenter.tablesTitle')}</span>
            <span className="Card_Subtitle">{t('callCenter.tablesAllSubtitle')}</span>
          </div>
        </div>
        <div className="Call_Center_Body">
          {error && <span className="Call_Center_Message Bad">{error}</span>}
          {!loaded ? (
            !error && <span className="Call_Center_Message">{t('common.loading')}</span>
          ) : rows.length === 0 ? (
            <div className="Empty_State">
              <span className="Empty_State_Title">{t('callCenter.tablesEmptyTitle')}</span>
              <span className="Empty_State_Text">{t('callCenter.tablesEmptyText')}</span>
            </div>
          ) : (
            <div className="Table_Wrap">
              <table className="Table">
                <thead>
                  <tr>
                    <th>{t('callCenter.tableName')}</th>
                    <th>{t('callCenter.kind')}</th>
                    <th className="Right">{t('callCenter.rows')}</th>
                    <th className="Right">{t('callCenter.columnsCount')}</th>
                    <th>{t('callCenter.updated')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="Call_Center_Row_Link" onClick={() => navigate(row.path)}>
                      <td>
                        <button
                          type="button"
                          className="Call_Center_Link"
                          onClick={(event) => {
                            event.stopPropagation();
                            navigate(row.path);
                          }}
                        >
                          {row.name}
                        </button>
                        {row.detail && <div className="Call_Center_Sub">{row.detail}</div>}
                      </td>
                      <td>{row.kind}</td>
                      <td className="Right Num">{row.rows === null ? '—' : row.rows.toLocaleString(locale)}</td>
                      <td className="Right Num">{row.columns}</td>
                      <td className="Num">
                        {row.updatedAt ? new Date(row.updatedAt).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Data_Connections companyId={company.id} tables={tables ?? []} canManage={canManage} onChanged={reloadTables} />
    </>
  );
};

const Data_Overview = () => <Data_Shell>{(company) => <Overview_Body company={company} />}</Data_Shell>;

export default Data_Overview;
