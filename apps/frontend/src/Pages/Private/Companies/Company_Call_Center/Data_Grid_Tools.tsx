import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { Data_Filter_Op, Data_Row_Filter } from '../../../../Hooks/Companies/useCompanyData';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import { Close, Filter, Plus } from '../../../../Imports/icons';
import { localeOf } from '../../../../utils/locale';
import Data_Anchor_Panel from './Data_Anchor_Panel';
import Data_Filter_Values, { type Values_Source } from './Data_Filter_Values';
import { formatCell } from './dataHelpers';
import { filterIsComplete, filterKindOf, MAX_FILTERS, opNeedsValue, OPS_BY_KIND, type Data_Grid, type Grid_Column } from './useDataGrid';

const sideMark = (column: Grid_Column) => (column.side ? `${column.side === 'left' ? 'A' : 'B'} · ` : '');

/** O nome de uma condição: nas datas «depois de», «antes de»; no resto «maior que», «menor que». */
const useOpLabel = () => {
  const { t } = useTranslation();
  return (op: Data_Filter_Op, column: Grid_Column | undefined) =>
    column && filterKindOf(column.type) === 'date' && ['gt', 'gte', 'lt', 'lte'].includes(op)
      ? t(`callCenter.filterOpDate_${op}`)
      : t(`callCenter.filterOp_${op}`);
};

/** As colunas que a tabela mostra: escolhem-se aqui (pelo menos uma); o «Info» mostra sempre todas. */
const Columns_Picker = ({ grid, anchor, onClose }: { grid: Data_Grid; anchor: HTMLElement; onClose: () => void }) => {
  const { t } = useTranslation();
  const picked = new Set(grid.shownKeys);

  const toggle = (key: string) => {
    const next = picked.has(key) ? grid.shownKeys.filter((k) => k !== key) : [...grid.shownKeys, key];
    if (next.length) grid.setShownKeys(next);
  };

  return (
    <Data_Anchor_Panel anchor={anchor} onClose={onClose} label={t('callCenter.gridColumns')} className="Call_Center_Picker" align="left">
      <div className="Call_Center_Panel_Head">
        <span className="Call_Center_Panel_Title">{t('callCenter.gridColumnsTitle', { count: picked.size, total: grid.columns.length })}</span>
        <button type="button" className="Call_Center_Text_Button" disabled={grid.isDefaultColumns} onClick={() => grid.setShownKeys(null)}>
          {t('callCenter.gridColumnsReset')}
        </button>
      </div>
      <div className="Call_Center_Picker_List">
        {grid.columns.map((column) => (
          <label key={column.key} className="Call_Center_Check">
            <input
              type="checkbox"
              checked={picked.has(column.key)}
              disabled={picked.has(column.key) && picked.size === 1}
              onChange={() => toggle(column.key)}
            />
            <span>
              {column.side && <span className="Call_Center_Side">{column.side === 'left' ? 'A' : 'B'}</span>} {column.label}
            </span>
          </label>
        ))}
      </div>
    </Data_Anchor_Panel>
  );
};

/**
 * Um filtro novo ou a editar: a coluna, a condição e o valor (número ou data conforme a
 * coluna) ou, no «é um de», os valores escolhidos da lista dos que a coluna tem.
 */
export const Data_Filter_Editor = ({ grid, values: source }: { grid: Data_Grid; values: Values_Source }) => {
  const { t } = useTranslation();
  const opLabel = useOpLabel();
  const editing = grid.editor;
  const existing = editing && editing.index !== null ? grid.filters[editing.index] : undefined;
  const firstColumn = existing?.column ?? editing?.column ?? grid.filterable[0]?.key ?? '';
  const [columnKey, setColumnKey] = useState(firstColumn);
  const column = grid.filterable.find((c) => c.key === columnKey);
  const ops = column ? OPS_BY_KIND[filterKindOf(column.type)] : [];
  const [op, setOp] = useState<Data_Filter_Op>(existing?.op ?? (column ? OPS_BY_KIND[filterKindOf(column.type)][0] : 'contains'));
  const [value, setValue] = useState(existing?.value ?? '');
  const [picked, setPicked] = useState<string[]>(existing?.values ?? []);

  if (!editing) return null;

  const kind = column ? filterKindOf(column.type) : 'text';
  const needsValue = opNeedsValue(op);
  const draft: Data_Row_Filter | null = column
    ? op === 'in'
      ? { column: column.key, op, values: picked }
      : needsValue
        ? { column: column.key, op, value: value.trim() }
        : { column: column.key, op }
    : null;
  const ready = Boolean(draft) && ops.includes(op) && filterIsComplete(draft!);
  // A lista vê as linhas dos outros filtros (não o que se está a editar)
  const otherFilters = grid.filters.filter((_, index) => index !== editing.index);

  const pickColumn = (key: string) => {
    setColumnKey(key);
    const next = grid.filterable.find((c) => c.key === key);
    const nextOps = next ? OPS_BY_KIND[filterKindOf(next.type)] : [];
    if (!nextOps.includes(op)) setOp(nextOps[0] ?? 'contains');
    if (next && filterKindOf(next.type) !== kind) setValue('');
    setPicked([]);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!ready || !draft) return;
    const filter = draft;
    const next = [...grid.filters];
    if (editing.index !== null) next[editing.index] = filter;
    else next.push(filter);
    grid.setFilters(next);
    grid.closeEditor();
  };

  const remove = () => {
    if (editing.index === null) return;
    grid.setFilters(grid.filters.filter((_, index) => index !== editing.index));
    grid.closeEditor();
  };

  return (
    <Data_Anchor_Panel anchor={editing.anchor} onClose={grid.closeEditor} label={t('callCenter.filterTitle')} className="Call_Center_Filter_Panel" align="left">
      <form className="Call_Center_Filter_Form" onSubmit={submit}>
        <span className="Call_Center_Panel_Title">{t(existing ? 'callCenter.filterEdit' : 'callCenter.filterTitle')}</span>
        <div className="Form_Field">
          <label htmlFor="data-filter-column">{t('callCenter.filterColumn')}</label>
          <Global_Dropdown
            id="data-filter-column"
            value={columnKey}
            onChange={(key) => pickColumn(String(key))}
            options={grid.filterable.map((c) => ({ value: c.key, label: `${sideMark(c)}${c.label}` }))}
            searchable
          />
        </div>
        <div className="Form_Field">
          <label htmlFor="data-filter-op">{t('callCenter.filterOp')}</label>
          <Global_Dropdown
            id="data-filter-op"
            value={op}
            onChange={(next) => setOp(next as Data_Filter_Op)}
            options={ops.map((o) => ({ value: o, label: opLabel(o, column) }))}
          />
        </div>
        {op === 'in' && column && (
          <div className="Form_Field">
            <label htmlFor="data-filter-values-search">{t('callCenter.filterValues')}</label>
            <Data_Filter_Values values={source} column={column.key} filters={otherFilters} selected={picked} onChange={setPicked} />
          </div>
        )}
        {needsValue && (
          <div className="Form_Field">
            <label htmlFor="data-filter-value">{t('callCenter.filterValue')}</label>
            <Global_Input
              id="data-filter-value"
              type={kind === 'date' && op !== 'contains' ? 'date' : 'text'}
              value={value}
              maxLength={200}
              autoComplete="off"
              placeholder={kind === 'number' ? '0,00' : undefined}
              onChange={(event) => setValue(event.target.value)}
            />
          </div>
        )}
        <div className="Call_Center_Filter_Actions">
          {existing && (
            <Simple_Button text={t('callCenter.filterRemove')} onClick={remove} variant="Quiet" auto small />
          )}
          <Simple_Button text={t('callCenter.filterApply')} type="submit" disabled={!ready} auto small />
        </div>
      </form>
    </Data_Anchor_Panel>
  );
};

/**
 * Por cima da tabela: escolher as colunas, juntar um filtro e os filtros ativos (clicar edita, × tira). Sem
 * `showColumns` só os filtros (as definições de uma secção das Leads).
 */
export const Data_Grid_Toolbar = ({ grid, values, showColumns = true }: { grid: Data_Grid; values: Values_Source; showColumns?: boolean }) => {
  const { t, i18n } = useTranslation();
  const opLabel = useOpLabel();
  const locale = localeOf(i18n.language);
  const [columnsAnchor, setColumnsAnchor] = useState<HTMLElement | null>(null);
  const byKey = new Map(grid.columns.map((column) => [column.key, column]));

  const valueText = (filter: Data_Row_Filter, column: Grid_Column | undefined) => {
    if (filter.op === 'in') {
      const list = (filter.values ?? []).map((v) => v || t('callCenter.filterValuesEmpty'));
      return list.length > 2 ? `${list.slice(0, 2).join(', ')} ${t('callCenter.filterValuesMore', { count: list.length - 2 })}` : list.join(', ');
    }
    if (!filter.value) return '';
    return column && filterKindOf(column.type) === 'date' ? String(formatCell(filter.value, 'date', locale)) : filter.value;
  };

  return (
    <>
      <div className="Call_Center_Grid_Tools">
        {showColumns && (
          <button
            type="button"
            className={`Call_Center_Tool${columnsAnchor ? ' Active' : ''}`}
            aria-expanded={Boolean(columnsAnchor)}
            onClick={(event) => {
              const target = event.currentTarget;
              setColumnsAnchor((current) => (current ? null : target));
            }}
          >
            {t('callCenter.gridColumnsButton', { count: grid.shown.length, total: grid.columns.length })}
          </button>
        )}
        <button
          type="button"
          className="Call_Center_Tool"
          disabled={grid.filters.length >= MAX_FILTERS || grid.filterable.length === 0}
          onClick={(event) => grid.openEditor({ anchor: event.currentTarget, index: null })}
        >
          <span className="Call_Center_Tool_Icon"><Plus /></span>
          {t('callCenter.filterAdd')}
        </button>

        {grid.filters.map((filter, index) => {
          const column = byKey.get(filter.column);
          return (
            <span key={`${filter.column}-${index}`} className="Call_Center_Chip">
              <button
                type="button"
                className="Call_Center_Chip_Body"
                onClick={(event) => grid.openEditor({ anchor: event.currentTarget, index })}
              >
                <span className="Call_Center_Chip_Column">{column ? `${sideMark(column)}${column.label}` : filter.column}</span>{' '}
                {opLabel(filter.op, column)} {Boolean(filter.value || filter.values?.length) && <span className="Call_Center_Strong">{valueText(filter, column)}</span>}
              </button>
              <button
                type="button"
                className="Call_Center_Chip_Remove"
                aria-label={t('callCenter.filterRemove')}
                title={t('callCenter.filterRemove')}
                onClick={() => grid.setFilters(grid.filters.filter((_, i) => i !== index))}
              >
                <Close />
              </button>
            </span>
          );
        })}
        {grid.filters.length > 1 && (
          <button type="button" className="Call_Center_Text_Button" onClick={() => grid.setFilters([])}>
            {t('callCenter.filterClear')}
          </button>
        )}
      </div>

      {columnsAnchor && <Columns_Picker grid={grid} anchor={columnsAnchor} onClose={() => setColumnsAnchor(null)} />}
      {/* A chave muda a cada abertura, para o formulário começar do filtro escolhido */}
      {grid.editor && <Data_Filter_Editor key={`${grid.editor.index}-${grid.editor.column}-${grid.filters.length}`} grid={grid} values={values} />}
    </>
  );
};

/** O funil no cabeçalho de uma coluna: abre um filtro novo nela (aceso se ela já tiver um). */
export const Data_Header_Filter = ({ grid, column }: { grid: Data_Grid; column: Grid_Column }) => {
  const { t } = useTranslation();
  if (!grid.filterable.some((c) => c.key === column.key)) return null;
  const active = grid.filters.some((filter) => filter.column === column.key);
  return (
    <button
      type="button"
      className={`Call_Center_Header_Filter${active ? ' Active' : ''}`}
      aria-label={t('callCenter.filterColumnButton', { column: column.label })}
      title={t('callCenter.filterColumnButton', { column: column.label })}
      disabled={grid.filters.length >= MAX_FILTERS}
      onClick={(event) => grid.openEditor({ anchor: event.currentTarget, index: null, column: column.key })}
    >
      <Filter />
    </button>
  );
};
