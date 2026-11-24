import { useId, useState } from 'react';
import { callCenterBase } from '../../../../Containers/Navs/Navigation_Home/Menu_Itins';
import { useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useAlert } from '../../../../Contexts/Alert_Context';
import { useBreadcrumbSegmentLabel } from '../../../../Contexts/Breadcrumb_Context';
import { getErrorMessage } from '../../../../Hooks/useAsyncRequest';
import {
  dataApi,
  DATA_JOIN_TYPES,
  DATA_NORMALIZE,
  useDataTables,
  useDataView,
  type Data_Join_Pair,
  type Data_Join_Type,
  type Data_Normalize,
  type Data_Table,
  type Data_View,
  type Data_View_Column,
  type Data_View_Result,
} from '../../../../Hooks/Companies/useCompanyData';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import Data_Shell from './Data_Shell';
import { Data_View_Rows, Data_View_Stats_Cards } from './Data_View_Grid';
import { moveItem } from './dataHelpers';

const emptyPair = (): Data_Join_Pair => ({ left: '', right: '', normalize: ['trim', 'lower'] });

interface Form_Props {
  company: { id: string; slug: string };
  tables: Data_Table[];
  view: Data_View | null;
}

const View_Form = ({ company, tables, view }: Form_Props) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setAlert } = useAlert();
  const groupId = useId();
  const base = `${callCenterBase(company.slug)}/dados`;

  const [name, setName] = useState(view?.name ?? '');
  const [leftId, setLeftId] = useState(view?.leftTableId ?? '');
  const [rightId, setRightId] = useState(view?.rightTableId ?? '');
  const [pairs, setPairs] = useState<Data_Join_Pair[]>(view?.joinOn ?? [emptyPair()]);
  const [joinType, setJoinType] = useState<Data_Join_Type>(view?.joinType ?? 'left');
  const [columns, setColumns] = useState<Data_View_Column[]>(view?.columns ?? []);
  // A pré-visualização vale para o que estava escolhido quando se pediu (`signature`); mudar alguma coisa esconde-a
  const [previewState, setPreview] = useState<{ signature: string; result: Data_View_Result } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const left = tables.find((table) => table.id === leftId);
  const right = tables.find((table) => table.id === rightId);
  const tableOf = (side: 'left' | 'right') => (side === 'left' ? left : right);

  // Mudar uma das tabelas deixa os pares e as colunas dela sem sentido: saem
  const pickTable = (side: 'left' | 'right', id: string) => {
    if (side === 'left') setLeftId(id);
    else setRightId(id);
    setPairs((current) => current.map((pair) => ({ ...pair, [side]: '' })));
    setColumns((current) => current.filter((column) => column.side !== side));
  };

  const updatePair = (index: number, patch: Partial<Data_Join_Pair>) =>
    setPairs((current) => current.map((pair, i) => (i === index ? { ...pair, ...patch } : pair)));

  const toggleNormalize = (index: number, option: Data_Normalize) =>
    updatePair(index, {
      normalize: pairs[index].normalize.includes(option)
        ? pairs[index].normalize.filter((item) => item !== option)
        : [...pairs[index].normalize, option],
    });

  const isPicked = (side: 'left' | 'right', key: string) => columns.some((column) => column.side === side && column.column === key);
  const addColumn = (side: 'left' | 'right', key: string) => {
    const source = tableOf(side)?.columns.find((column) => column.key === key);
    if (!source || isPicked(side, key)) return;
    setColumns((current) => [...current, { side, column: key, label: source.label }]);
  };
  const addAll = (side: 'left' | 'right') => {
    const table = tableOf(side);
    if (!table) return;
    setColumns((current) => [
      ...current,
      ...table.columns
        .filter((column) => !current.some((picked) => picked.side === side && picked.column === column.key))
        .map((column) => ({ side, column: column.key, label: column.label })),
    ]);
  };

  const pairsValid = pairs.length > 0 && pairs.every((pair) => pair.left && pair.right);
  const valid = !!leftId && !!rightId && leftId !== rightId && pairsValid && columns.length > 0 && columns.every((column) => column.label.trim());
  const input = () => ({
    leftTableId: leftId,
    rightTableId: rightId,
    joinOn: pairs,
    joinType,
    columns: columns.map((column) => ({ ...column, label: column.label.trim() })),
  });

  const signature = JSON.stringify(input());
  const preview = previewState?.signature === signature ? previewState.result : null;

  const runPreview = async () => {
    if (!valid || previewing) return;
    setPreviewing(true);
    setPreviewError(null);
    const body = input();
    try {
      setPreview({ signature: JSON.stringify(body), result: await dataApi.previewView(company.id, body) });
    } catch (reason) {
      setPreviewError(getErrorMessage(reason));
    } finally {
      setPreviewing(false);
    }
  };

  const save = async () => {
    if (!valid || !name.trim() || saving) return;
    setSaving(true);
    try {
      const body = { name: name.trim(), ...input() };
      const saved = view ? await dataApi.updateView(company.id, view.id, body) : await dataApi.createView(company.id, body);
      setAlert({ open: true, message: t('callCenter.viewSaved'), type: 'success' });
      navigate(`${base}/unida/${saved.id}`);
    } catch (reason) {
      setAlert({ open: true, message: getErrorMessage(reason), type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const tableOptions = tables.map((table) => ({ value: table.id, label: table.name }));
  const columnOptions = (table: Data_Table | undefined) => [
    { value: '', label: t('callCenter.pickColumn') },
    ...(table?.columns ?? []).map((column) => ({ value: column.key, label: column.label })),
  ];
  const labelOf = (side: 'left' | 'right', key: string) => tableOf(side)?.columns.find((column) => column.key === key)?.label ?? key;

  return (
    <>
      <div className="Page_Head">
        <div className="Call_Center_Head_Actions">
          <Simple_Button text={t('common.cancel')} onClick={() => navigate(view ? `${base}/unida/${view.id}` : base)} variant="Ghost" auto />
          <Simple_Button text={t('common.save')} onClick={() => void save()} disabled={!valid || !name.trim() || saving} auto />
        </div>
      </div>

      <div className="Card Call_Center_Card">
        <div className="Card_Header">
          <div className="Card_Header_Text">
            <span className="Card_Title">{t('callCenter.viewTablesTitle')}</span>
            <span className="Card_Subtitle">{t('callCenter.viewTablesSubtitle')}</span>
          </div>
        </div>
        <div className="Call_Center_Body">
          <div className="Form_Field">
            <label htmlFor="data-view-name">{t('callCenter.viewName')}</label>
            <Global_Input id="data-view-name" value={name} maxLength={120} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="Call_Center_Two">
            <div className="Form_Field">
              <label htmlFor="data-view-left">{t('callCenter.tableA')}</label>
              <Global_Dropdown
                id="data-view-left"
                value={leftId}
                placeholder={t('callCenter.pickTable')}
                onChange={(value) => pickTable('left', String(value))}
                options={tableOptions}
              />
            </div>
            <div className="Form_Field">
              <label htmlFor="data-view-right">{t('callCenter.tableB')}</label>
              <Global_Dropdown
                id="data-view-right"
                value={rightId}
                placeholder={t('callCenter.pickTable')}
                onChange={(value) => pickTable('right', String(value))}
                options={tableOptions}
              />
            </div>
          </div>
          {leftId && leftId === rightId && <span className="Call_Center_Message Bad">{t('callCenter.sameTable')}</span>}
        </div>
      </div>

      {left && right && leftId !== rightId && (
        <>
          <div className="Card Call_Center_Card">
            <div className="Card_Header">
              <div className="Card_Header_Text">
                <span className="Card_Title">{t('callCenter.pairsTitle')}</span>
                <span className="Card_Subtitle">{t('callCenter.pairsSubtitle')}</span>
              </div>
            </div>
            <div className="Call_Center_Body">
              {pairs.map((pair, index) => (
                <div key={index} className="Call_Center_Pair">
                  <div className="Call_Center_Pair_Fields">
                    <div className="Form_Field">
                      <label htmlFor={`data-pair-left-${index}`}>{t('callCenter.columnOf', { name: left.name })}</label>
                      <Global_Dropdown
                        id={`data-pair-left-${index}`}
                        value={pair.left}
                        onChange={(value) => updatePair(index, { left: String(value) })}
                        options={columnOptions(left)}
                      />
                    </div>
                    <span className="Call_Center_Equals">=</span>
                    <div className="Form_Field">
                      <label htmlFor={`data-pair-right-${index}`}>{t('callCenter.columnOf', { name: right.name })}</label>
                      <Global_Dropdown
                        id={`data-pair-right-${index}`}
                        value={pair.right}
                        onChange={(value) => updatePair(index, { right: String(value) })}
                        options={columnOptions(right)}
                      />
                    </div>
                    <button
                      type="button"
                      className="Call_Center_Action Danger"
                      disabled={pairs.length === 1}
                      onClick={() => setPairs((current) => current.filter((_, i) => i !== index))}
                    >
                      {t('callCenter.pairRemove')}
                    </button>
                  </div>
                  <div className="Call_Center_Pair_Normalize">
                    {DATA_NORMALIZE.map((option) => (
                      <label key={option} className="Call_Center_Check">
                        <input type="checkbox" checked={pair.normalize.includes(option)} onChange={() => toggleNormalize(index, option)} />
                        {t(`callCenter.normalize_${option}`)}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <div className="Call_Center_Head_Actions">
                <Simple_Button text={t('callCenter.pairAdd')} onClick={() => setPairs((current) => [...current, emptyPair()])} variant="Ghost" small auto />
              </div>
              <span className="Field_Hint">{t('callCenter.pairsHint')}</span>

              <div className="Form_Field">
                <label id={`${groupId}-join`}>{t('callCenter.joinType')}</label>
                <div className="Tabs" role="group" aria-labelledby={`${groupId}-join`}>
                  {DATA_JOIN_TYPES.map((option) => (
                    <button key={option} type="button" className={joinType === option ? 'Active' : ''} aria-pressed={joinType === option} onClick={() => setJoinType(option)}>
                      {t(`callCenter.join_${option}`)}
                    </button>
                  ))}
                </div>
                <span className="Field_Hint">{t(`callCenter.joinHint_${joinType}`, { left: left.name, right: right.name })}</span>
              </div>
            </div>
          </div>

          <div className="Card Call_Center_Card">
            <div className="Card_Header">
              <div className="Card_Header_Text">
                <span className="Card_Title">{t('callCenter.viewColumnsTitle')}</span>
                <span className="Card_Subtitle">{t('callCenter.viewColumnsSubtitle')}</span>
              </div>
            </div>
            <div className="Call_Center_Body">
              <div className="Call_Center_Two">
                {(['left', 'right'] as const).map((side) => {
                  const table = tableOf(side)!;
                  return (
                    <div key={side} className="Form_Field">
                      <label>
                        <span className="Call_Center_Side">{side === 'left' ? 'A' : 'B'}</span> {table.name}
                      </label>
                      <div className="Call_Center_Available">
                        {table.columns
                          .filter((column) => !isPicked(side, column.key))
                          .map((column) => (
                            <button key={column.key} type="button" className="Call_Center_Action" onClick={() => addColumn(side, column.key)}>
                              + {column.label}
                            </button>
                          ))}
                        {table.columns.some((column) => !isPicked(side, column.key)) && (
                          <button type="button" className="Call_Center_Action" onClick={() => addAll(side)}>
                            {t('callCenter.addAllColumns')}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {columns.length === 0 ? (
                <span className="Call_Center_Message">{t('callCenter.viewColumnsEmpty')}</span>
              ) : (
                <div className="Call_Center_Columns">
                  {columns.map((column, index) => (
                    <div key={`${column.side}-${column.column}`} className="Call_Center_Picked">
                      <span className="Call_Center_Side">{column.side === 'left' ? 'A' : 'B'}</span>
                      <span className="Call_Center_Sub">{labelOf(column.side, column.column)}</span>
                      <Global_Input
                        id={`data-view-col-${column.side}-${column.column}`}
                        value={column.label}
                        placeholder={t('callCenter.columnLabel')}
                        onChange={(event) =>
                          setColumns((current) => current.map((item, i) => (i === index ? { ...item, label: event.target.value } : item)))
                        }
                      />
                      <div className="Call_Center_Row_Actions">
                        <button
                          type="button"
                          className="Call_Center_Action"
                          disabled={index === 0}
                          onClick={() => setColumns((current) => moveItem(current, index, -1))}
                          aria-label={t('callCenter.moveUp')}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="Call_Center_Action"
                          disabled={index === columns.length - 1}
                          onClick={() => setColumns((current) => moveItem(current, index, 1))}
                          aria-label={t('callCenter.moveDown')}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className="Call_Center_Action Danger"
                          onClick={() => setColumns((current) => current.filter((_, i) => i !== index))}
                        >
                          {t('callCenter.columnRemove')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="Card Call_Center_Card">
            <div className="Card_Header">
              <div className="Card_Header_Text">
                <span className="Card_Title">{t('callCenter.previewTitle')}</span>
                <span className="Card_Subtitle">{t('callCenter.previewSubtitle')}</span>
              </div>
              <div className="Call_Center_Head_Actions">
                <Simple_Button text={t('callCenter.previewRun')} onClick={() => void runPreview()} disabled={!valid || previewing} variant="Ghost" small auto />
              </div>
            </div>
            <div className="Call_Center_Body">
              {previewError && <span className="Call_Center_Message Bad">{previewError}</span>}
              {previewing && <span className="Call_Center_Message">{t('common.loading')}</span>}
              {!preview && !previewing && !previewError && (
                <span className="Call_Center_Message">{valid ? t('callCenter.previewIdle') : t('callCenter.previewIncomplete')}</span>
              )}
              {preview && (
                <>
                  <Data_View_Stats_Cards stats={preview.stats} leftName={left.name} rightName={right.name} />
                  <Data_View_Rows result={preview} />
                </>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
};

const Form_Loader = ({ company }: { company: { id: string; slug: string } }) => {
  const { t } = useTranslation();
  const { viewId } = useParams();
  const { data: tables, error: tablesError } = useDataTables(company.id);
  const { data: view, error: viewError } = useDataView(company.id, viewId);

  useBreadcrumbSegmentLabel(viewId, view?.name);

  const error = tablesError ?? viewError;
  if (error) return <span className="Call_Center_Message Bad">{error}</span>;
  if (!tables || (viewId && !view)) return <span className="Call_Center_Message">{t('common.loading')}</span>;
  return <View_Form key={view?.id ?? 'new'} company={company} tables={tables} view={view} />;
};

/**
 * Uma tabela unida, nova ou a editar: as duas tabelas, os pares de colunas que têm de bater (com a
 * limpeza antes de comparar), que linhas ficam e que colunas, e a pré-visualização com as contas.
 */
const Data_View_Form = () => <Data_Shell>{(company) => <Form_Loader company={company} />}</Data_Shell>;

export default Data_View_Form;
