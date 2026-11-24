import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Popover_Shell from '../../../../Components/Popover_Shell/Popover_Shell';
import Confirm_Popover from '../../../../Components/Confirm_Popover/Confirm_Popover';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import { getErrorMessage } from '../../../../Hooks/useAsyncRequest';
import {
  DATA_VIEW_FILTERS,
  useDataTables,
  useDataViews,
  type Data_Table,
  type Data_View,
  type Data_View_Filter,
} from '../../../../Hooks/Companies/useCompanyData';
import { leadsApi, type Lead_Board, type Lead_Source_Type } from '../../../../Hooks/Companies/useCompanyLeads';
import { Data_Grid_Toolbar } from './Data_Grid_Tools';
import { useFilterDraft, type Grid_Column } from './useDataGrid';

// O backend aceita até 6 colunas no cartão (`MAX_CARD_COLUMNS`)
const MAX_CARD_COLUMNS = 6;

/** As colunas de uma origem: as da tabela, ou as da tabela unida (`c0`, `c1`…) com o tipo das tabelas de onde vêm. */
const columnsOf = (source: string, tables: Data_Table[], views: Data_View[]): Grid_Column[] => {
  const [type, id] = source.split(':');
  if (type === 'table') {
    return (tables.find((table) => table.id === id)?.columns ?? []).map(({ key, label, type: kind, personal }) => ({ key, label, type: kind, personal }));
  }
  const view = views.find((v) => v.id === id);
  if (!view) return [];
  const left = tables.find((table) => table.id === view.leftTableId)?.columns ?? [];
  const right = tables.find((table) => table.id === view.rightTableId)?.columns ?? [];
  return view.columns.map((c, index) => {
    const origin = (c.side === 'left' ? left : right).find((column) => column.key === c.column);
    return { key: `c${index}`, label: c.label, type: origin?.type ?? 'text', personal: origin?.personal ?? false, side: c.side };
  });
};

/** O que uma origem nova propõe: o primeiro telefone, a primeira coluna como título e as três a seguir no cartão. */
const defaultsOf = (columns: Grid_Column[]) => {
  const phone = columns.find((column) => column.type === 'phone')?.key ?? null;
  const title = columns.find((column) => column.key !== phone)?.key ?? null;
  return {
    phoneColumn: phone,
    titleColumn: title,
    cardColumns: columns.filter((column) => column.key !== phone && column.key !== title).slice(0, 3).map((column) => column.key),
  };
};

const sideMark = (column: Grid_Column) => (column.side ? `${column.side === 'left' ? 'A' : 'B'} · ` : '');

interface Lead_Board_Settings_Props {
  companyId: string;
  // Sem ela, uma secção nova
  board: Lead_Board | null;
  onClose: () => void;
  onSaved: (board: Lead_Board) => void;
  onDeleted?: () => void;
}

/**
 * As definições de uma secção das Leads: o nome, de onde vêm as leads (a tabela ou a tabela unida e os filtros, os
 * mesmos das tabelas) e o que o cartão mostra (o título, o telefone e até 6 colunas).
 */
const Lead_Board_Settings = ({ companyId, board, onClose, onSaved, onDeleted }: Lead_Board_Settings_Props) => {
  const { t } = useTranslation();
  const { data: tables } = useDataTables(companyId);
  const { data: views } = useDataViews(companyId);
  const [name, setName] = useState(board?.name ?? '');
  const [source, setSource] = useState(board ? `${board.sourceType}:${board.tableId ?? board.viewId}` : '');
  const [only, setOnly] = useState<Data_View_Filter>(board?.only ?? 'all');
  const [search, setSearch] = useState(board?.search ?? '');
  const [phoneColumn, setPhoneColumn] = useState<string | null>(board?.phoneColumn ?? null);
  const [titleColumn, setTitleColumn] = useState<string | null>(board?.titleColumn ?? null);
  const [cardColumns, setCardColumns] = useState<string[]>(board?.cardColumns ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const columns = useMemo(() => columnsOf(source, tables ?? [], views ?? []), [source, tables, views]);
  const grid = useFilterDraft(columns, board?.filters ?? []);
  const [sourceType, sourceId] = source.split(':') as [Lead_Source_Type | '', string | undefined];
  const isView = sourceType === 'view';

  const sourceOptions = [
    ...(tables ?? []).map((table) => ({ value: `table:${table.id}`, label: table.name, group: t('callCenter.leadsSourceTables') })),
    ...(views ?? []).map((view) => ({ value: `view:${view.id}`, label: view.name, group: t('callCenter.leadsSourceViews') })),
  ];
  const columnOptions = [
    { value: '', label: t('callCenter.leadsNoColumn') },
    ...columns.map((column) => ({ value: column.key, label: `${sideMark(column)}${column.label}` })),
  ];

  const pickSource = (next: string) => {
    if (next === source) return;
    setSource(next);
    const nextColumns = columnsOf(next, tables ?? [], views ?? []);
    const defaults = defaultsOf(nextColumns);
    setPhoneColumn(defaults.phoneColumn);
    setTitleColumn(defaults.titleColumn);
    setCardColumns(defaults.cardColumns);
    setOnly('all');
    grid.setFilters([]);
  };

  const toggleCard = (key: string) =>
    setCardColumns((current) => (current.includes(key) ? current.filter((k) => k !== key) : [...current, key].slice(0, MAX_CARD_COLUMNS)));

  const ready = Boolean(name.trim() && sourceType && sourceId) && !saving;

  const submit = async () => {
    if (!ready || !sourceType || !sourceId) return;
    setSaving(true);
    setError(null);
    const body = {
      name: name.trim(),
      sourceType,
      sourceId,
      filters: grid.filters,
      search: search.trim() || null,
      only: isView && only !== 'all' ? only : null,
      phoneColumn,
      titleColumn,
      cardColumns,
    };
    try {
      const saved = board ? await leadsApi.updateBoard(companyId, board.id, body) : await leadsApi.createBoard(companyId, body);
      onSaved(saved);
    } catch (reason) {
      setError(getErrorMessage(reason));
      setSaving(false);
    }
  };

  return (
    <>
      <Popover_Shell
        onClose={onClose}
        className="Wide"
        as="form"
        dirty
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="Popover_Header">
          <div className="Popover_Header_Text">
            <span className="Popover_Title">{board ? t('callCenter.leadsSettingsTitle', { name: board.name }) : t('callCenter.leadsNewBoard')}</span>
            <span className="Popover_Subtitle">{t('callCenter.leadsSettingsHint')}</span>
          </div>
          <button type="button" className="Popover_Close" onClick={onClose} aria-label={t('common.cancel')}>
            ×
          </button>
        </div>

        <div className="Popover_Body Single_Column Leads_Settings">
          <div className="Form_Field">
            <label htmlFor="lead-board-name">{t('callCenter.leadsBoardName')}</label>
            <Global_Input
              id="lead-board-name"
              value={name}
              maxLength={80}
              autoComplete="off"
              placeholder={t('callCenter.leadsBoardNamePlaceholder')}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="Form_Field">
            <label htmlFor="lead-board-source">{t('callCenter.leadsSource')}</label>
            <Global_Dropdown
              id="lead-board-source"
              value={source}
              onChange={(next) => pickSource(String(next))}
              options={sourceOptions}
              placeholder={t('callCenter.leadsSourcePlaceholder')}
              searchable
            />
          </div>

          {sourceId && (
            <>
              {isView && (
                <div className="Form_Field">
                  <label htmlFor="lead-board-only">{t('callCenter.leadsOnly')}</label>
                  <Global_Dropdown
                    id="lead-board-only"
                    value={only}
                    onChange={(next) => setOnly(next as Data_View_Filter)}
                    options={DATA_VIEW_FILTERS.map((filter) => ({ value: filter, label: t(`callCenter.filter_${filter}`) }))}
                  />
                </div>
              )}

              <div className="Form_Field">
                <span className="Leads_Field_Label">{t('callCenter.leadsFilters')}</span>
                <span className="Field_Hint">{t('callCenter.leadsFiltersHint')}</span>
                <Data_Grid_Toolbar
                  grid={grid}
                  showColumns={false}
                  values={{ companyId, source: `${isView ? 'views' : 'tables'}/${sourceId}`, search: search.trim(), only: isView ? only : undefined }}
                />
              </div>

              <div className="Form_Field">
                <label htmlFor="lead-board-search">{t('callCenter.leadsSearch')}</label>
                <Global_Input
                  id="lead-board-search"
                  value={search}
                  maxLength={120}
                  autoComplete="off"
                  placeholder={t('callCenter.leadsSearchPlaceholder')}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>

              <div className="Leads_Settings_Pair">
                <div className="Form_Field">
                  <label htmlFor="lead-board-title">{t('callCenter.leadsTitleColumn')}</label>
                  <Global_Dropdown
                    id="lead-board-title"
                    value={titleColumn ?? ''}
                    onChange={(next) => setTitleColumn(String(next) || null)}
                    options={columnOptions}
                    searchable
                  />
                </div>
                <div className="Form_Field">
                  <label htmlFor="lead-board-phone">{t('callCenter.leadsPhoneColumn')}</label>
                  <Global_Dropdown
                    id="lead-board-phone"
                    value={phoneColumn ?? ''}
                    onChange={(next) => setPhoneColumn(String(next) || null)}
                    options={columnOptions}
                    searchable
                  />
                </div>
              </div>

              <fieldset className="Form_Field Leads_Card_Columns">
                <legend className="Leads_Field_Label">
                  {t('callCenter.leadsCardColumns', { count: cardColumns.length, max: MAX_CARD_COLUMNS })}
                </legend>
                <div className="Leads_Card_Columns_List">
                  {columns.map((column) => {
                    const checked = cardColumns.includes(column.key);
                    return (
                      <label key={column.key} className="Call_Center_Check">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!checked && cardColumns.length >= MAX_CARD_COLUMNS}
                          onChange={() => toggleCard(column.key)}
                        />
                        <span>
                          {column.side && <span className="Call_Center_Side">{column.side === 'left' ? 'A' : 'B'}</span>} {column.label}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            </>
          )}

          {error && <span className="Call_Center_Message Bad">{error}</span>}
        </div>

        <div className="Popover_Footer">
          {board && onDeleted && (
            <div className="Form_Action Leads_Settings_Delete">
              <Simple_Button text={t('callCenter.leadsDeleteBoard')} onClick={() => setDeleting(true)} variant="Quiet" />
            </div>
          )}
          <div className="Form_Action">
            <Simple_Button text={t('common.cancel')} onClick={onClose} variant="Ghost" />
          </div>
          <div className="Form_Action">
            <Simple_Button text={board ? t('common.save') : t('callCenter.leadsCreateBoard')} type="submit" disabled={!ready} />
          </div>
        </div>
      </Popover_Shell>

      {deleting && board && (
        <Confirm_Popover
          title={t('callCenter.leadsDeleteTitle', { name: board.name })}
          message={t('callCenter.leadsDeleteText')}
          confirmText={t('common.delete')}
          error={error}
          onClose={() => setDeleting(false)}
          onConfirm={async () => {
            try {
              await leadsApi.deleteBoard(companyId, board.id);
              onDeleted?.();
            } catch (reason) {
              setError(getErrorMessage(reason));
              setDeleting(false);
            }
          }}
        />
      )}
    </>
  );
};

export default Lead_Board_Settings;
