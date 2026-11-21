import { useRef, type Dispatch, type SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import * as Icon from '../../../../Imports/icons';
import { formatSize } from './paymentForm';

interface Payment_Files_Field_Props {
  files: File[];
  setFiles: Dispatch<SetStateAction<File[]>>;
  saving: boolean;
}

// Ficam em espera: um documento agarra-se a um pagamento, e o
// pagamento só existe depois de gravar
const Payment_Files_Field = ({ files, setFiles, saving }: Payment_Files_Field_Props) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="Form_Field Full_Width">
      <div className="Documents_Header">
        <label>{t('documents.title')}</label>
        <div className="Documents_Action">
          <Simple_Button
            text={t('documents.add')}
            onClick={() => fileInputRef.current?.click()}
            disabled={saving}
          />
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.png,.jpg,.jpeg,.webp"
        className="Documents_Input"
        onChange={(e) => {
          const chosen = e.target.files;

          if (chosen) setFiles((current) => [...current, ...Array.from(chosen)]);

          // Sem isto, escolher o mesmo ficheiro outra vez não dispara o onChange
          if (fileInputRef.current) fileInputRef.current.value = '';
        }}
      />

      {files.length === 0 ? (
        <span className="Lines_Empty">{t('documents.emptyForm')}</span>
      ) : (
        <div className="Documents_List">
          {files.map((file, index) => (
            <div className="Document_Row" key={`${file.name}-${index}`}>
              {/* Ainda não há nada para descarregar — é só a lista do
                  que vai ser enviado */}
              <div className="Document_Info">
                <span className="Document_Name">{file.name}</span>
                <span className="Document_Meta">{formatSize(file.size)}</span>
              </div>

              <div className="Document_Actions">
                <button
                  type="button"
                  className="Row_Action Danger"
                  onClick={() =>
                    setFiles((current) => current.filter((_, i) => i !== index))
                  }
                  title={t('common.delete')}
                  aria-label={t('common.delete')}
                >
                  <Icon.Trash />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Payment_Files_Field;
