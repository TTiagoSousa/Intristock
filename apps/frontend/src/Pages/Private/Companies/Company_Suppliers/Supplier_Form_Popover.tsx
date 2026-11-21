import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import type { CompanySupplier } from '../../../../Hooks/Companies/useCompanySuppliers';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import { useSupplierForm } from '../../../../Hooks/Companies/useSupplierForm';
import Supplier_Form_Fields, { Supplier_Form_Popovers } from './Supplier_Form_Fields';
import type { New_Supplier_State } from './Company_Supplier';
import Supplier_Catalog from './Supplier_Catalog';
import Popover_Shell from '../../../../Components/Popover_Shell/Popover_Shell';

interface Supplier_Form_Popover_Props {
  companyId: string;
  companyName: string;
  // Quando vem preenchido, o formulário está em modo de edição
  supplier?: CompanySupplier;
  onClose: () => void;
  onSaved: () => void;
}

const Supplier_Form_Popover = ({
  companyId,
  companyName,
  supplier,
  onClose,
  onSaved,
}: Supplier_Form_Popover_Props) => {
  const { t } = useTranslation();
  const { slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // A criar: escrever um novo ou tirá-lo do catálogo (as prop firms…)
  const [mode, setMode] = useState<'new' | 'catalog'>('new');
  const form = useSupplierForm({ companyId, supplier, onSaved: () => onSaved() });

  // A página leva o que já foi escrito aqui, e no fim volta para onde se estava
  const openAdvanced = () => {
    const state: New_Supplier_State = { values: form.values, returnTo: location.pathname };
    navigate(`/Companies/${slug}/compras/fornecedores/new-supplier`, { state });
  };

  const openSupplier = (created: { slug: string }) => {
    onSaved();
    navigate(`/Companies/${slug}/compras/fornecedores/${created.slug}`);
  };

  return (
    <>
      <Popover_Shell onClose={onClose} as="form" onSubmit={form.submit}>
        <div className="Popover_Header">
          <div className="Popover_Header_Text">
            <span className="Popover_Title">
              {t(supplier ? 'suppliers.editTitle' : 'suppliers.createTitle')}
            </span>
            <span className="Popover_Subtitle">{companyName}</span>
          </div>

          <button type="button" className="Popover_Close" onClick={onClose} aria-label={t('common.cancel')}>
            ×
          </button>
        </div>

        <div className="Popover_Body">
          {!supplier && (
            <div className="Tabs Supplier_Form_Mode" role="tablist">
              {(['new', 'catalog'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  role="tab"
                  aria-selected={mode === option}
                  className={mode === option ? 'Active' : ''}
                  onClick={() => setMode(option)}
                >
                  {t(option === 'new' ? 'suppliers.modeNew' : 'suppliers.modeCatalog')}
                </button>
              ))}
            </div>
          )}
          {mode === 'catalog' ? (
            <Supplier_Catalog companyId={companyId} onOpen={openSupplier} />
          ) : (
            <Supplier_Form_Fields form={form} />
          )}
        </div>

        <div className="Popover_Footer">
          <div className="Form_Action">
            <Simple_Button text={t('common.cancel')} onClick={onClose} />
          </div>
          {/* Só a criar: a edição continua toda no popover */}
          {!supplier && mode === 'new' && (
            <div className="Form_Action">
              <Simple_Button text={t('common.advanced')} variant="Ghost" onClick={openAdvanced} />
            </div>
          )}
          {mode === 'new' && (
          <div className="Form_Action">
            <Simple_Button
              type="submit"
              text={t('common.save')}
              disabled={form.saving}
            />
          </div>
          )}
        </div>
      </Popover_Shell>

      <Supplier_Form_Popovers form={form} companyId={companyId} companyName={companyName} />
    </>
  );
};

export default Supplier_Form_Popover;
