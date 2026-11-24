import { useRef, type ReactNode } from 'react';
import { useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useCompany } from '../../../../Contexts/Company_Context';
import { useBreadcrumbSegmentLabel } from '../../../../Contexts/Breadcrumb_Context';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import './Call_Center.scss';

type Company = NonNullable<ReturnType<typeof useCompany>['company']>;

/**
 * O que as páginas dos dados (módulo call center) têm em comum: a empresa a carregar ou não
 * encontrada. A permissão e o módulo ligado vê-os o `Company_Permission_Gate` da rota.
 */
const Data_Shell = ({ children }: { children: (company: Company) => ReactNode }) => {
  const { slug } = useParams();
  const { t } = useTranslation();
  const { company, loading } = useCompany();

  useBreadcrumbSegmentLabel(slug, company?.name);

  if (loading || !company) {
    return (
      <div className="Call_Center">
        <span className="Call_Center_Message">{loading ? t('common.loading') : t('companies.notFound')}</span>
      </div>
    );
  }

  return <div className="Call_Center">{children(company)}</div>;
};

export default Data_Shell;

/** O botão que abre o seletor de um ficheiro (.xlsx ou .csv); o campo nativo fica escondido. */
export const File_Pick = ({
  file,
  onPick,
  disabled,
}: {
  file: File | null;
  onPick: (file: File) => void;
  disabled?: boolean;
}) => {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="Call_Center_File">
      <Simple_Button
        text={file ? t('callCenter.fileChange') : t('callCenter.fileChoose')}
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        variant="Ghost"
        small
        auto
      />
      <span className="Call_Center_Sub">{file ? file.name : t('callCenter.fileHint')}</span>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
        className="Call_Center_File_Input"
        onChange={(event) => {
          const picked = event.target.files?.[0];
          event.target.value = '';
          if (picked) onPick(picked);
        }}
      />
    </div>
  );
};
