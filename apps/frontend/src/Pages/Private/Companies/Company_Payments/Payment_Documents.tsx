import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useCompanyPaymentDocuments,
  type CompanyPaymentDocument,
} from '../../../../Hooks/Companies/useCompanyPaymentDocuments';
import { useCompany } from '../../../../Contexts/Company_Context';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import * as Icon from '../../../../Imports/icons';
import { localeOf } from '../../../../utils/locale';

interface Payment_Documents_Props {
  companyId: string;
  paymentId: string;
}

// KB até 1 MB, depois MB — números com sete dígitos não dizem nada a ninguém
const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const Payment_Documents = ({ companyId, paymentId }: Payment_Documents_Props) => {
  const { t, i18n } = useTranslation();
  const { can } = useCompany();
  const inputRef = useRef<HTMLInputElement>(null);
  // Confirmação antes de apagar — um documento apagado não volta
  const [documentToDelete, setDocumentToDelete] = useState<CompanyPaymentDocument | null>(null);

  const {
    documents,
    loading,
    uploading,
    uploadDocument,
    deleteDocument,
    downloadDocument,
  } = useCompanyPaymentDocuments(companyId, paymentId);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    // Um a um, para uma falha a meio não levar as outras atrás
    for (const file of Array.from(files)) {
      await uploadDocument(file);
    }

    // Sem isto, escolher o mesmo ficheiro outra vez não dispara o onChange
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="Detail_Section">
      <div className="Documents_Header">
        <span className="Detail_Section_Title">{t('documents.title')}</span>

        <div className="Documents_Action">
          {can('payments.edit') && (
            <Simple_Button
              text={t('documents.add')}
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              variant="Ghost"
              small
              auto
            />
          )}
        </div>

      </div>

      {/* Escondido: quem abre o seletor é o botão acima. Visível, o campo
          nativo punha um segundo botão "Escolher ficheiros" ao lado. */}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.png,.jpg,.jpeg,.webp"
        className="Documents_Input"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {loading ? (
        <span className="Lines_Empty">{t('common.loading')}</span>
      ) : documents.length === 0 ? (
        <span className="Lines_Empty">{t('documents.empty')}</span>
      ) : (
        <div className="Documents_List">
          {documents.map((document) => (
            <div className="Document_Row" key={document.id}>
              <div className="Document_Info">
                <span className="Document_Name">{document.fileName}</span>
                <span className="Document_Meta">
                  {formatSize(document.size)} ·{' '}
                  {new Date(document.createdAt).toLocaleDateString(localeOf(i18n.language))}
                </span>
              </div>

              <div className="Document_Actions">
                <button
                  type="button"
                  className="Row_Action"
                  onClick={() => downloadDocument(document)}
                  title={t('documents.download')}
                  aria-label={t('documents.download')}
                >
                  <Icon.Download />
                </button>

                {can('payments.edit') && (
                  <button
                    type="button"
                    className="Row_Action Danger"
                    onClick={() => setDocumentToDelete(document)}
                    title={t('common.delete')}
                    aria-label={t('common.delete')}
                  >
                    <Icon.Trash />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {documentToDelete && (
        <div className="Document_Confirm">
          <span className="Document_Confirm_Text">
            {t('documents.deleteConfirm', { name: documentToDelete.fileName })}
          </span>

          <div className="Document_Confirm_Actions">
            <Simple_Button
              text={t('common.cancel')}
              onClick={() => setDocumentToDelete(null)}
              variant="Ghost"
              small
              auto
            />
            <Simple_Button
              text={t('common.delete')}
              variant="Danger"
              small
              auto
              onClick={async () => {
                const deleted = await deleteDocument(documentToDelete.id);

                if (deleted) setDocumentToDelete(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Payment_Documents;
