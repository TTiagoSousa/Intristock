import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Popover_Shell from '../../../../Components/Popover_Shell/Popover_Shell';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import { getErrorMessage } from '../../../../Hooks/useAsyncRequest';
import {
  dataApi,
  type Data_File_Preview,
  type Data_Import,
  type Data_Table_Detail,
} from '../../../../Hooks/Companies/useCompanyData';
import { File_Pick } from './Data_Shell';
import { cleanMapping, suggestMapping } from './dataHelpers';

interface Data_Import_Popover_Props {
  companyId: string;
  table: Data_Table_Detail;
  onClose: () => void;
  // Acabou (bem ou com erros nas linhas): a página volta a pedir as linhas e o histórico
  onImported: () => void;
}

/** O resultado de uma importação: quantas novas, atualizadas, iguais, ignoradas, e os erros. */
export const Import_Result = ({ result }: { result: Data_Import }) => {
  const { t } = useTranslation();
  return (
    <div className="Call_Center_Columns">
      <div className="Call_Center_Results">
        <span>
          {t('callCenter.resultCreated')} <strong>{result.created}</strong>
        </span>
        <span>
          {t('callCenter.resultUpdated')} <strong>{result.updated}</strong>
        </span>
        <span>
          {t('callCenter.resultUnchanged')} <strong>{result.unchanged}</strong>
        </span>
        <span>
          {t('callCenter.resultSkipped')} <strong>{result.skipped}</strong>
        </span>
      </div>
      {result.errors && result.errors.length > 0 && (
        <ul className="Call_Center_Errors">
          {result.errors.map((error, index) => (
            <li key={`${error.row}-${index}`}>{t('callCenter.resultError', { row: error.row, message: error.message })}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

/**
 * Importar um ficheiro para uma tabela: escolhê-lo, ligar cada cabeçalho a uma coluna (ou ignorá-lo;
 * vem preenchido com a importação anterior e com os nomes iguais) e ver o resultado. As linhas com
 * uma chave que já existe atualizam-se.
 */
const Data_Import_Popover = ({ companyId, table, onClose, onImported }: Data_Import_Popover_Props) => {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Data_File_Preview | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [skipTotals, setSkipTotals] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Data_Import | null>(null);

  const pick = async (picked: File) => {
    setFile(picked);
    setPreview(null);
    setResult(null);
    setError(null);
    setBusy(true);
    try {
      const read = await dataApi.preview(companyId, picked);
      setPreview(read);
      setMapping(suggestMapping(read.headers, table.columns, table.importConfig?.mapping));
      setSkipTotals(read.totalsRowDetected || !!table.importConfig?.skipTotals);
    } catch (reason) {
      setFile(null);
      setError(getErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  };

  const chosen = cleanMapping(mapping);
  const used = Object.values(chosen);
  const keyMapped = !table.keyColumn || used.includes(table.keyColumn);
  const repeated = new Set(used).size !== used.length;
  const ready = !!file && !!preview && used.length > 0 && keyMapped && !repeated;

  const run = async () => {
    if (!file || !ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await dataApi.importFile(companyId, table.id, file, chosen, skipTotals));
      onImported();
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  };

  const options = [
    { value: '', label: t('callCenter.mappingIgnore') },
    ...table.columns.map((column) => ({ value: column.key, label: column.label })),
  ];
  const sampleOf = (header: string) => preview?.columns.find((column) => column.header === header)?.samples.slice(0, 2).join(' | ');

  return (
    <Popover_Shell onClose={onClose} className="Wide" closeOnBackdrop={!busy} closeOnEscape={!busy}>
      <div className="Popover_Header">
        <div className="Popover_Header_Text">
          <span className="Popover_Title">{t('callCenter.importTitle')}</span>
          <span className="Popover_Subtitle">{table.name}</span>
        </div>
        <button type="button" className="Popover_Close" onClick={onClose} aria-label={t('common.cancel')}>
          ×
        </button>
      </div>

      <div className="Popover_Body Single_Column">
        {result ? (
          <Import_Result result={result} />
        ) : (
          <>
            <div className="Form_Field">
              <label>{t('callCenter.file')}</label>
              <File_Pick file={file} onPick={(picked) => void pick(picked)} disabled={busy} />
              {preview && (
                <span className="Field_Hint">
                  {t('callCenter.previewFound', { rows: preview.totalRows, columns: preview.headers.length })}
                </span>
              )}
            </div>

            {preview && (
              <>
                <div className="Table_Wrap Call_Center_Scroll">
                  <table className="Table Call_Center_Mapping">
                    <thead>
                      <tr>
                        <th>{t('callCenter.mappingHeader')}</th>
                        <th>{t('callCenter.mappingSamples')}</th>
                        <th>{t('callCenter.mappingColumn')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.headers.map((header) => (
                        <tr key={header}>
                          <td className="Call_Center_Strong">{header}</td>
                          <td className="Call_Center_Sub">{sampleOf(header) || '—'}</td>
                          <td className="Call_Center_Mapping_Pick">
                            <Global_Dropdown
                              id={`data-mapping-${header}`}
                              value={mapping[header] ?? ''}
                              onChange={(value) => setMapping((current) => ({ ...current, [header]: String(value) }))}
                              options={options}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <label className="Call_Center_Check">
                  <input type="checkbox" checked={skipTotals} onChange={(event) => setSkipTotals(event.target.checked)} />
                  {t('callCenter.skipTotals')}
                </label>
                {!keyMapped && (
                  <span className="Call_Center_Message Bad">
                    {t('callCenter.mappingNeedsKey', {
                      column: table.columns.find((column) => column.key === table.keyColumn)?.label ?? table.keyColumn,
                    })}
                  </span>
                )}
                {repeated && <span className="Call_Center_Message Bad">{t('callCenter.mappingRepeated')}</span>}
                {!table.keyColumn && <span className="Field_Hint">{t('callCenter.importNoKeyHint')}</span>}
              </>
            )}
          </>
        )}
        {error && <span className="Call_Center_Message Bad">{error}</span>}
      </div>

      <div className="Popover_Footer">
        {result ? (
          <div className="Form_Action">
            <Simple_Button text={t('common.close')} onClick={onClose} />
          </div>
        ) : (
          <>
            <div className="Form_Action">
              <Simple_Button text={t('common.cancel')} onClick={onClose} variant="Ghost" disabled={busy} />
            </div>
            <div className="Form_Action">
              <Simple_Button text={t('callCenter.importRun')} onClick={() => void run()} disabled={!ready || busy} />
            </div>
          </>
        )}
      </div>
    </Popover_Shell>
  );
};

export default Data_Import_Popover;
