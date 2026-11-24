import { useId, useState } from 'react';
import { callCenterBase } from '../../../../Containers/Navs/Navigation_Home/Menu_Itins';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useAlert } from '../../../../Contexts/Alert_Context';
import { getErrorMessage } from '../../../../Hooks/useAsyncRequest';
import { dataApi, type Data_File_Preview } from '../../../../Hooks/Companies/useCompanyData';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import Data_Shell, { File_Pick } from './Data_Shell';
import Data_Columns_Editor from './Data_Columns_Editor';
import {
  draftsProblem,
  draftsToColumns,
  emptyDraft,
  newDraftId,
  type Column_Draft,
} from './columnDrafts';

type Source = 'file' | 'manual';

const New_Table_Body = ({ company }: { company: { id: string; slug: string } }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setAlert } = useAlert();
  const groupId = useId();
  const base = `${callCenterBase(company.slug)}/dados`;

  const [name, setName] = useState('');
  const [source, setSource] = useState<Source>('file');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Data_File_Preview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [skipTotals, setSkipTotals] = useState(false);
  const [drafts, setDrafts] = useState<Column_Draft[]>([]);
  const [keyDraftId, setKeyDraftId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const changeSource = (next: Source) => {
    setSource(next);
    setKeyDraftId(null);
    if (next === 'manual') {
      setFile(null);
      setPreview(null);
      setDrafts([emptyDraft()]);
    } else {
      setDrafts([]);
    }
  };

  const pick = async (picked: File) => {
    setFile(picked);
    setPreview(null);
    setDrafts([]);
    setKeyDraftId(null);
    setPreviewing(true);
    try {
      const result = await dataApi.preview(company.id, picked);
      setPreview(result);
      setSkipTotals(result.totalsRowDetected);
      setDrafts(
        result.columns.map((column) => ({
          draftId: newDraftId(),
          key: '',
          label: column.header,
          type: column.type,
          personal: false,
          hidden: false,
          sourceHeader: column.header,
          keep: true,
          samples: column.samples,
        })),
      );
      // O nome da tabela, se ainda não tem, vem do ficheiro (sem a extensão)
      if (!name.trim()) setName(picked.name.replace(/\.[^.]+$/, ''));
    } catch (reason) {
      setFile(null);
      setAlert({ open: true, message: getErrorMessage(reason), type: 'error' });
    } finally {
      setPreviewing(false);
    }
  };

  const problem = draftsProblem(drafts);
  const ready = !!name.trim() && problem === 'none' && (source === 'manual' || (!!file && !!preview));

  const save = async () => {
    if (!ready || saving) return;
    setSaving(true);
    const { columns, keyColumn } = draftsToColumns(drafts, keyDraftId);
    try {
      const table = await dataApi.createTable(company.id, { name: name.trim(), source, columns, keyColumn });
      if (source === 'file' && file) {
        // O mesmo ficheiro entra logo: cada cabeçalho que ficou vai para a coluna que saiu dele
        const mapping = Object.fromEntries(
          columns.filter((column) => column.sourceHeader).map((column) => [column.sourceHeader as string, column.key]),
        );
        try {
          const result = await dataApi.importFile(company.id, table.id, file, mapping, skipTotals);
          setAlert({
            open: true,
            message: t('callCenter.createdWithImport', { created: result.created, skipped: result.skipped }),
            type: result.errors?.length ? 'warning' : 'success',
          });
        } catch (reason) {
          // A tabela fica criada; a importação pode repetir-se na página dela
          setAlert({ open: true, message: t('callCenter.createdImportFailed', { error: getErrorMessage(reason) }), type: 'error' });
        }
      } else {
        setAlert({ open: true, message: t('callCenter.tableCreated'), type: 'success' });
      }
      navigate(`${base}/tabela/${table.id}`);
    } catch (reason) {
      setAlert({ open: true, message: getErrorMessage(reason), type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="Page_Head">
        <div className="Call_Center_Head_Actions">
          <Simple_Button text={t('common.cancel')} onClick={() => navigate(base)} variant="Ghost" auto />
          <Simple_Button text={t('callCenter.createTable')} onClick={() => void save()} disabled={!ready || saving} auto />
        </div>
      </div>

      <div className="Card Call_Center_Card">
        <div className="Call_Center_Body">
          <div className="Call_Center_Two">
            <div className="Form_Field">
              <label htmlFor="data-table-name">{t('callCenter.tableName')}</label>
              <Global_Input id="data-table-name" value={name} maxLength={120} onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="Form_Field">
              <label id={`${groupId}-source`}>{t('callCenter.source')}</label>
              <div className="Tabs" role="group" aria-labelledby={`${groupId}-source`}>
                {(['file', 'manual'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={source === option ? 'Active' : ''}
                    aria-pressed={source === option}
                    onClick={() => changeSource(option)}
                  >
                    {t(`callCenter.source_${option}`)}
                  </button>
                ))}
              </div>
              <span className="Field_Hint">{t(`callCenter.sourceHint_${source}`)}</span>
            </div>
          </div>

          {source === 'file' && (
            <div className="Form_Field">
              <label>{t('callCenter.file')}</label>
              <File_Pick file={file} onPick={(picked) => void pick(picked)} disabled={previewing || saving} />
              {previewing && <span className="Call_Center_Message">{t('callCenter.reading')}</span>}
              {preview && (
                <>
                  <span className="Field_Hint">
                    {t('callCenter.previewFound', { rows: preview.totalRows, columns: preview.headers.length })}
                  </span>
                  <label className="Call_Center_Check">
                    <input type="checkbox" checked={skipTotals} onChange={(event) => setSkipTotals(event.target.checked)} />
                    {t('callCenter.skipTotals')}
                  </label>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {drafts.length > 0 && (
        <div className="Card Call_Center_Card">
          <div className="Card_Header">
            <div className="Card_Header_Text">
              <span className="Card_Title">{t('callCenter.columnsTitle')}</span>
              <span className="Card_Subtitle">{t(source === 'file' ? 'callCenter.columnsFileSubtitle' : 'callCenter.columnsManualSubtitle')}</span>
            </div>
          </div>
          <div className="Call_Center_Body">
            <Data_Columns_Editor
              drafts={drafts}
              onChange={setDrafts}
              keyDraftId={keyDraftId}
              onKeyChange={setKeyDraftId}
              fromFile={source === 'file'}
              disabled={saving}
            />
            {problem !== 'none' && <span className="Call_Center_Message Bad">{t(`callCenter.columnsProblem_${problem}`)}</span>}
          </div>
        </div>
      )}
    </>
  );
};

/** Uma tabela nova: de um ficheiro (as colunas vêm dele e escolhem-se) ou escrita à mão. */
const Data_Table_New = () => <Data_Shell>{(company) => <New_Table_Body company={company} />}</Data_Shell>;

export default Data_Table_New;
