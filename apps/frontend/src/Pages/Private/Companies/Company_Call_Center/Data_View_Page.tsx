import { useEffect, useMemo, useState } from 'react';
import { callCenterBase } from '../../../../Containers/Navs/Navigation_Home/Menu_Itins';
import { useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useCompany } from '../../../../Contexts/Company_Context';
import { useBreadcrumbSegmentLabel } from '../../../../Contexts/Breadcrumb_Context';
import { getErrorMessage } from '../../../../Hooks/useAsyncRequest';
import { dataApi, useDataView, useDataViewRows, type Data_View_Filter } from '../../../../Hooks/Companies/useCompanyData';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Global_Pagination from '../../../../Components/Pagination/Global_Pagination/Global_Pagination';
import Confirm_Popover from '../../../../Components/Confirm_Popover/Confirm_Popover';
import { Search } from '../../../../Imports/icons';
import Data_Shell from './Data_Shell';
import { Data_View_Rows, Data_View_Stats_Cards } from './Data_View_Grid';
import { Data_Grid_Toolbar } from './Data_Grid_Tools';
import { DEFAULT_COLUMNS, useDataGrid, type Grid_Column } from './useDataGrid';

const NO_COLUMNS: Grid_Column[] = [];

const PAGE_SIZE = 20;

const View_Body = ({ company }: { company: { id: string; slug: string } }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { viewId } = useParams();
  const { can } = useCompany();
  const canManage = can('data.manage');
  const { data: view, error: viewError } = useDataView(company.id, viewId);
  const [only, setOnly] = useState<Data_View_Filter>('all');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  // As colunas vêm com as linhas (enquanto chega outra página, ficam as de antes)
  const [columnsKey, setColumnsKey] = useState<string | null>(null);
  const columns = useMemo(() => (columnsKey ? (JSON.parse(columnsKey) as Grid_Column[]) : NO_COLUMNS), [columnsKey]);
  const defaultShown = useMemo(() => columns.slice(0, DEFAULT_COLUMNS).map((column) => column.key), [columns]);
  const grid = useDataGrid(`intristock-data-grid.view.${viewId}`, columns, defaultShown, can('data.personal'));
  const { filters } = grid;
  // Outros filtros voltam à primeira página
  const filtersKey = JSON.stringify(filters);
  const [paging, setPaging] = useState({ filtersKey, page: 1 });
  const page = paging.filtersKey === filtersKey ? paging.page : 1;
  const setPage = (next: number) => setPaging({ filtersKey, page: next });
  const { data, error } = useDataViewRows(company.id, viewId, { page, take: PAGE_SIZE, search: query, only, filters });
  const loadedColumns = data ? JSON.stringify(data.columns) : null;
  if (loadedColumns && loadedColumns !== columnsKey) setColumnsKey(loadedColumns);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const base = `${callCenterBase(company.slug)}/dados`;

  useBreadcrumbSegmentLabel(viewId, view?.name);

  // A pesquisa só vai ao servidor quando se para de escrever
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(search);
      setPaging((current) => ({ ...current, page: 1 }));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  if (viewError && !view) return <span className="Call_Center_Message Bad">{viewError}</span>;
  if (!view) return <span className="Call_Center_Message">{t('common.loading')}</span>;

  return (
    <>
      <div className="Page_Head">
        <div>
          <span className="Call_Center_Sub">
            {t('callCenter.viewMeta', {
              left: view.leftTable.name,
              right: view.rightTable.name,
              join: t(`callCenter.join_${view.joinType}`),
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
            <Simple_Button text={t('common.edit')} onClick={() => navigate(`${base}/unida/${view.id}/editar`)} auto />
          </div>
        )}
      </div>

      {data && (
        <Data_View_Stats_Cards
          stats={data.stats}
          leftName={view.leftTable.name}
          rightName={view.rightTable.name}
          active={only}
          onPick={(filter) => {
            setOnly(filter);
            setPage(1);
          }}
        />
      )}

      <div className="Card Call_Center_Card">
        <div className="Card_Header">
          <div className="Card_Header_Text">
            <span className="Card_Title">{t('callCenter.viewRowsTitle')}</span>
            <span className="Card_Subtitle">{t(`callCenter.filter_${only}`)}</span>
          </div>
        </div>
        <div className="Call_Center_Body">
          <div className="Call_Center_Toolbar">
            <div className="Form_Field">
              <Global_Input
                id="data-view-search"
                value={search}
                icon={Search}
                placeholder={t('callCenter.search')}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>
          <Data_Grid_Toolbar grid={grid} values={{ companyId: company.id, source: `views/${viewId}`, search: query, only }} />
          {error && <span className="Call_Center_Message Bad">{error}</span>}
          {!data ? (
            !error && <span className="Call_Center_Message">{t('common.loading')}</span>
          ) : (
            <>
              <Data_View_Rows result={data} grid={grid} comments={can('leads.view') && viewId ? { companyId: company.id, viewId } : undefined} />
              {data.total > 0 && (
                <Global_Pagination
                  page={page}
                  totalPages={Math.max(1, Math.ceil(data.total / PAGE_SIZE))}
                  onPageChange={setPage}
                  totalItems={data.total}
                  pageSize={PAGE_SIZE}
                />
              )}
            </>
          )}
        </div>
      </div>

      {deleting && (
        <Confirm_Popover
          title={t('callCenter.viewDeleteTitle', { name: view.name })}
          message={t('callCenter.viewDeleteText')}
          confirmText={t('common.delete')}
          error={deleteError}
          onClose={() => setDeleting(false)}
          onConfirm={async () => {
            try {
              await dataApi.deleteView(company.id, view.id);
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

/** Uma tabela unida: as contas da junção (que filtram), a pesquisa e as linhas, às páginas. */
const Data_View_Page = () => <Data_Shell>{(company) => <View_Body company={company} />}</Data_Shell>;

export default Data_View_Page;
