import { useEffect, useMemo, useState } from 'react';
import { callCenterBase } from '../../../../Containers/Navs/Navigation_Home/Menu_Itins';
import { useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useAlert } from '../../../../Contexts/Alert_Context';
import { useCompany } from '../../../../Contexts/Company_Context';
import { useBreadcrumbSegmentLabel } from '../../../../Contexts/Breadcrumb_Context';
import { getErrorMessage } from '../../../../Hooks/useAsyncRequest';
import {
  dataApi,
  MASKED,
  useDataImports,
  useDataRows,
  useDataTable,
  type Data_Row,
  type Data_Table_Detail,
  type Data_Value,
} from '../../../../Hooks/Companies/useCompanyData';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Global_Pagination from '../../../../Components/Pagination/Global_Pagination/Global_Pagination';
import Confirm_Popover from '../../../../Components/Confirm_Popover/Confirm_Popover';
import { Search } from '../../../../Imports/icons';
import { localeOf } from '../../../../utils/locale';
import Data_Shell from './Data_Shell';
import Data_Import_Popover from './Data_Import_Popover';
import Data_Row_Popover from './Data_Row_Popover';
import Data_Columns_Editor from './Data_Columns_Editor';
import Data_Row_Info from './Data_Row_Info';
import Data_Row_Comments from './Data_Row_Comments';
import Fit_Table_Wrap from './Fit_Table_Wrap';
import { useRowCommentCounts } from '../../../../Hooks/Companies/useCompanyLeads';
import { Data_Grid_Toolbar, Data_Header_Filter } from './Data_Grid_Tools';
import { DEFAULT_COLUMNS, useDataGrid } from './useDataGrid';
import { draftFromColumn, draftsProblem, draftsToColumns, type Column_Draft } from './columnDrafts';
import { formatCell, isEmptyValue } from './dataHelpers';

const TABS = ['rows', 'imports', 'columns'] as const;
type Tab = (typeof TABS)[number];
const PAGE_SIZE = 20;

/** Uma célula: o valor escondido de um dado pessoal fica cinzento, o resto no formato do tipo. */
export const Data_Cell = ({ value, type, locale }: { value: Data_Value | undefined; type: string; locale: string }) =>
  value === MASKED ? <span className="Call_Center_Masked">{MASKED}</span> : <>{formatCell(value, type, locale)}</>;

const Rows_Tab = ({ companyId, table, canManage, onChanged }: { companyId: string; table: Data_Table_Detail; canManage: boolean; onChanged: () => void }) => {
  const { t, i18n } = useTranslation();
  const { setAlert } = useAlert();
  const { can } = useCompany();
  const locale = localeOf(i18n.language);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');

  const visible = useMemo(() => table.columns.filter((column) => !column.hidden), [table.columns]);
  // Até se escolherem outras, a chave à frente e as primeiras; a linha toda fica no «Info»
  const defaultShown = useMemo(
    () =>
      [...visible.filter((column) => column.key === table.keyColumn), ...visible.filter((column) => column.key !== table.keyColumn)]
        .slice(0, DEFAULT_COLUMNS)
        .map((column) => column.key),
    [visible, table.keyColumn],
  );
  const grid = useDataGrid(`intristock-data-grid.table.${table.id}`, visible, defaultShown, can('data.personal'));
  // Os comentários das Leads em cada linha (só para quem as vê)
  const { data: commentCounts } = useRowCommentCounts(can('leads.view') ? companyId : undefined, 'table', table.id);
  const { shown, filters } = grid;
  // Outros filtros voltam à primeira página
  const filtersKey = JSON.stringify(filters);
  const [paging, setPaging] = useState({ filtersKey, page: 1 });
  const page = paging.filtersKey === filtersKey ? paging.page : 1;
  const setPage = (next: number) => setPaging({ filtersKey, page: next });
  const { data, error, reload } = useDataRows(companyId, table.id, { page, take: PAGE_SIZE, search: query, filters });
  const [editing, setEditing] = useState<Data_Row | 'new' | null>(null);
  const [saving, setSaving] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Data_Row | null>(null);

  // A pesquisa só vai ao servidor quando se para de escrever
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(search);
      setPaging((current) => ({ ...current, page: 1 }));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);


  const save = async (values: Record<string, Data_Value>) => {
    if (!editing) return;
    setSaving(true);
    setRowError(null);
    try {
      if (editing === 'new') await dataApi.createRow(companyId, table.id, values);
      else await dataApi.updateRow(companyId, table.id, editing.id, values);
      setAlert({ open: true, message: t('callCenter.rowSaved'), type: 'success' });
      setEditing(null);
      reload();
      onChanged();
    } catch (reason) {
      setRowError(getErrorMessage(reason));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="Call_Center_Body">
      <div className="Call_Center_Toolbar">
        <div className="Form_Field">
          <Global_Input
            id="data-rows-search"
            value={search}
            icon={Search}
            placeholder={t('callCenter.search')}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        {canManage && (
          <Simple_Button
            text={t('callCenter.rowAdd')}
            onClick={() => {
              setRowError(null);
              setEditing('new');
            }}
            variant="Ghost"
            auto
          />
        )}
      </div>
      <Data_Grid_Toolbar grid={grid} values={{ companyId, source: `tables/${table.id}`, search: query }} />
      {data && !data.personalVisible && table.columns.some((column) => column.personal) && (
        <span className="Field_Hint">{t('callCenter.personalHiddenHint')}</span>
      )}
      {error && <span className="Call_Center_Message Bad">{error}</span>}
      {!data ? (
        !error && <span className="Call_Center_Message">{t('common.loading')}</span>
      ) : data.rows.length === 0 ? (
        <span className="Call_Center_Message">{query || filters.length ? t('callCenter.rowsNoMatch') : t('callCenter.rowsEmpty')}</span>
      ) : (
        <>
          <Fit_Table_Wrap>
            <table className="Table">
              <thead>
                <tr>
                  {shown.map((column) => (
                    <th key={column.key} className={column.type === 'number' || column.type === 'money' ? 'Right' : undefined}>
                      <span className="Call_Center_Head_Cell">
                        {column.label}
                        <Data_Header_Filter grid={grid} column={column} />
                      </span>
                    </th>
                  ))}
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.id}>
                    {shown.map((column) => (
                      <td
                        key={column.key}
                        className={column.type === 'number' || column.type === 'money' ? 'Right Num' : column.key === table.keyColumn ? 'Call_Center_Strong' : undefined}
                      >
                        <Data_Cell value={row.data[column.key]} type={column.type} locale={locale} />
                      </td>
                    ))}
                    <td>
                      <div className="Call_Center_Row_Actions">
                        {canManage && (
                          <>
                            <button
                              type="button"
                              className="Call_Center_Action"
                              onClick={() => {
                                setRowError(null);
                                setEditing(row);
                              }}
                            >
                              {t('common.edit')}
                            </button>
                            <button type="button" className="Call_Center_Action Danger" onClick={() => setDeleting(row)}>
                              {t('common.delete')}
                            </button>
                          </>
                        )}
                        <Data_Row_Comments
                          companyId={companyId}
                          sourceType="table"
                          sourceId={table.id}
                          row={row.key ?? row.id}
                          count={commentCounts?.[row.key ?? row.id] ?? 0}
                        />
                        <Data_Row_Info
                          title={table.keyColumn ? formatCell(row.data[table.keyColumn], 'text', locale) : table.name}
                          fields={visible
                            .filter((column) => !isEmptyValue(row.data[column.key]))
                            .map((column) => ({
                              key: column.key,
                              label: column.label,
                              value: <Data_Cell value={row.data[column.key]} type={column.type} locale={locale} />,
                            }))}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Fit_Table_Wrap>
          <Global_Pagination
            page={page}
            totalPages={Math.max(1, Math.ceil(data.total / PAGE_SIZE))}
            onPageChange={setPage}
            totalItems={data.total}
            pageSize={PAGE_SIZE}
          />
        </>
      )}

      {editing && (
        <Data_Row_Popover
          columns={table.columns}
          keyColumn={table.keyColumn}
          row={editing === 'new' ? null : editing}
          personalVisible={data?.personalVisible ?? false}
          saving={saving}
          error={rowError}
          onClose={() => setEditing(null)}
          onSave={(values) => void save(values)}
        />
      )}
      {deleting && (
        <Confirm_Popover
          title={t('callCenter.rowDeleteTitle')}
          message={t('callCenter.rowDeleteText')}
          confirmText={t('common.delete')}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            try {
              await dataApi.deleteRow(companyId, table.id, deleting.id);
              setDeleting(null);
              reload();
              onChanged();
            } catch (reason) {
              setAlert({ open: true, message: getErrorMessage(reason), type: 'error' });
            }
          }}
        />
      )}
    </div>
  );
};

const Imports_Tab = ({ companyId, tableId, version }: { companyId: string; tableId: string; version: number }) => {
  const { t, i18n } = useTranslation();
  const locale = localeOf(i18n.language);
  const { data, error, reload } = useDataImports(companyId, tableId);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    if (version) reload();
  }, [version, reload]);

  if (error) return <div className="Call_Center_Body"><span className="Call_Center_Message Bad">{error}</span></div>;
  if (!data) return <div className="Call_Center_Body"><span className="Call_Center_Message">{t('common.loading')}</span></div>;

  return (
    <div className="Call_Center_Body">
      {data.length === 0 ? (
        <span className="Call_Center_Message">{t('callCenter.importsEmpty')}</span>
      ) : (
        <div className="Table_Wrap">
          <table className="Table">
            <thead>
              <tr>
                <th>{t('callCenter.importWhen')}</th>
                <th>{t('callCenter.file')}</th>
                <th className="Right">{t('callCenter.resultCreated')}</th>
                <th className="Right">{t('callCenter.resultUpdated')}</th>
                <th className="Right">{t('callCenter.resultUnchanged')}</th>
                <th className="Right">{t('callCenter.resultSkipped')}</th>
                <th>{t('callCenter.importErrors')}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item) => (
                <tr key={item.id}>
                  <td className="Num">{new Date(item.createdAt).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td>
                    {item.fileName}
                    {item.status === 'failed' && <span className="Pill Warn Call_Center_Pill">{t('callCenter.importFailed')}</span>}
                  </td>
                  <td className="Right Num">{item.created}</td>
                  <td className="Right Num">{item.updated}</td>
                  <td className="Right Num">{item.unchanged}</td>
                  <td className="Right Num">{item.skipped}</td>
                  <td>
                    {item.errors?.length ? (
                      <>
                        <button type="button" className="Call_Center_Action" onClick={() => setOpen(open === item.id ? null : item.id)}>
                          {t('callCenter.importErrorsCount', { count: item.errors.length })}
                        </button>
                        {open === item.id && (
                          <ul className="Call_Center_Errors">
                            {item.errors.map((entry, index) => (
                              <li key={`${entry.row}-${index}`}>{t('callCenter.resultError', { row: entry.row, message: entry.message })}</li>
                            ))}
                          </ul>
                        )}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const Columns_Tab = ({ companyId, table, canManage, onSaved }: { companyId: string; table: Data_Table_Detail; canManage: boolean; onSaved: () => void }) => {
  const { t } = useTranslation();
  const { setAlert } = useAlert();
  const [name, setName] = useState(table.name);
  const [drafts, setDrafts] = useState<Column_Draft[]>(() => table.columns.map(draftFromColumn));
  const [keyDraftId, setKeyDraftId] = useState<string | null>(
    () => drafts.find((draft) => draft.key === table.keyColumn)?.draftId ?? null,
  );
  const [saving, setSaving] = useState(false);
  const problem = draftsProblem(drafts);

  const save = async () => {
    if (problem !== 'none' || !name.trim() || saving) return;
    setSaving(true);
    const { columns, keyColumn } = draftsToColumns(drafts, keyDraftId);
    try {
      await dataApi.updateTable(companyId, table.id, {
        name: name.trim(),
        columns,
        ...(keyColumn !== table.keyColumn ? { keyColumn } : {}),
      });
      setAlert({ open: true, message: t('callCenter.tableSaved'), type: 'success' });
      onSaved();
    } catch (reason) {
      setAlert({ open: true, message: getErrorMessage(reason), type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="Call_Center_Body">
      <div className="Form_Field">
        <label htmlFor="data-table-rename">{t('callCenter.tableName')}</label>
        <Global_Input id="data-table-rename" value={name} maxLength={120} disabled={!canManage} onChange={(event) => setName(event.target.value)} />
      </div>
      <Data_Columns_Editor
        drafts={drafts}
        onChange={setDrafts}
        keyDraftId={keyDraftId}
        onKeyChange={setKeyDraftId}
        keyLocked={table.rowCount > 0}
        disabled={!canManage || saving}
      />
      {problem !== 'none' && <span className="Call_Center_Message Bad">{t(`callCenter.columnsProblem_${problem}`)}</span>}
      {canManage && (
        <div className="Call_Center_Head_Actions">
          <Simple_Button text={t('common.save')} onClick={() => void save()} disabled={problem !== 'none' || !name.trim() || saving} auto />
        </div>
      )}
    </div>
  );
};

const Table_Body = ({ company }: { company: { id: string; slug: string } }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { tableId } = useParams();
  const { can } = useCompany();
  const canManage = can('data.manage');
  const locale = localeOf(i18n.language);
  const { data: table, error, reload } = useDataTable(company.id, tableId);
  const [tab, setTab] = useState<Tab>('rows');
  const [importing, setImporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // Sobe a cada importação: as linhas e o histórico voltam a pedir-se
  const [version, setVersion] = useState(0);
  const base = `${callCenterBase(company.slug)}/dados`;

  useBreadcrumbSegmentLabel(tableId, table?.name);

  if (error && !table) return <span className="Call_Center_Message Bad">{error}</span>;
  if (!table) return <span className="Call_Center_Message">{t('common.loading')}</span>;

  return (
    <>
      <div className="Page_Head">
        <div>
          <span className="Call_Center_Sub">
            {t('callCenter.tableMeta', {
              rows: table.rowCount.toLocaleString(locale),
              columns: table.columns.length,
              source: t(`callCenter.source_${table.source}`),
            })}
          </span>
        </div>
        {canManage && (
          <div className="Call_Center_Head_Actions">
            <Simple_Button
              text={t('common.delete')}
              onClick={() => {
                setDeleteError(null);
                setDeleting(true);
              }}
              variant="Quiet"
              auto
            />
            <Simple_Button text={t('callCenter.importAction')} onClick={() => setImporting(true)} auto />
          </div>
        )}
      </div>

      <div className="Card Call_Center_Card">
        <div className="Card_Header">
          <div className="Tabs" role="tablist">
            {TABS.map((option) => (
              <button
                key={option}
                type="button"
                role="tab"
                className={tab === option ? 'Active' : ''}
                aria-selected={tab === option}
                onClick={() => setTab(option)}
              >
                {t(`callCenter.tab_${option}`)}
              </button>
            ))}
          </div>
        </div>
        {tab === 'rows' && <Rows_Tab key={version} companyId={company.id} table={table} canManage={canManage} onChanged={reload} />}
        {tab === 'imports' && <Imports_Tab companyId={company.id} tableId={table.id} version={version} />}
        {tab === 'columns' && <Columns_Tab key={table.updatedAt} companyId={company.id} table={table} canManage={canManage} onSaved={reload} />}
      </div>

      {importing && (
        <Data_Import_Popover
          companyId={company.id}
          table={table}
          onClose={() => setImporting(false)}
          onImported={() => {
            setVersion((value) => value + 1);
            reload();
          }}
        />
      )}
      {deleting && (
        <Confirm_Popover
          title={t('callCenter.tableDeleteTitle', { name: table.name })}
          message={t('callCenter.tableDeleteText', { rows: table.rowCount })}
          confirmText={t('common.delete')}
          error={deleteError}
          onClose={() => setDeleting(false)}
          onConfirm={async () => {
            try {
              await dataApi.deleteTable(company.id, table.id);
              navigate(base);
            } catch (reason) {
              setDeleteError(getErrorMessage(reason));
            }
          }}
        />
      )}
    </>
  );
};

/** Uma tabela: as linhas (com a pesquisa e as escritas à mão), as importações e as colunas. */
const Data_Table_Page = () => <Data_Shell>{(company) => <Table_Body company={company} />}</Data_Shell>;

export default Data_Table_Page;
