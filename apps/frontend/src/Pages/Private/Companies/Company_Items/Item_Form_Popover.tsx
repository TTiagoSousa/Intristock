import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import type { CompanyItem } from '../../../../Hooks/Companies/useCompanyItems';
import { NEW_ITEM_SEGMENT, useItemForm } from '../../../../Hooks/Companies/useItemForm';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import Item_Form_Fields from './Item_Form_Fields';
import type { New_Item_State } from './Company_Item';
import Item_Catalog from './Item_Catalog';
import Popover_Shell from '../../../../Components/Popover_Shell/Popover_Shell';

interface Item_Form_Popover_Props {
  companyId: string;
  companyName: string;
  // Quando vem preenchido, o formulário está em modo de edição
  item?: CompanyItem;
  onClose: () => void;
  // Sem item: entraram vários do catálogo
  onSaved: (item?: CompanyItem) => void;
}

const Item_Form_Popover = ({
  companyId,
  companyName,
  item,
  onClose,
  onSaved,
}: Item_Form_Popover_Props) => {
  const { t } = useTranslation();
  const { slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // A criar: escrever um novo ou juntar os planos de uma firma do catálogo
  const [mode, setMode] = useState<'new' | 'catalog'>('new');
  const form = useItemForm({ companyId, item, onSaved });

  // A página leva o que já foi escrito aqui, e no fim volta para onde se estava
  const openAdvanced = () => {
    const state: New_Item_State = { values: form.values, returnTo: location.pathname };
    navigate(`/Companies/${slug}/compras/itens/${NEW_ITEM_SEGMENT}`, { state });
  };

  return (
    <Popover_Shell onClose={onClose} as="form" onSubmit={form.submit}>
      <div className="Popover_Header">
        <div className="Popover_Header_Text">
          <span className="Popover_Title">
            {t(item ? 'items.editTitle' : 'items.createTitle')}
          </span>
          <span className="Popover_Subtitle">{companyName}</span>
        </div>

        <button type="button" className="Popover_Close" onClick={onClose} aria-label={t('common.cancel')}>
          ×
        </button>
      </div>

      <div className="Popover_Body">
        {!item && (
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
          <Item_Catalog companyId={companyId} onAdded={() => onSaved()} />
        ) : (
          <Item_Form_Fields form={form} />
        )}
      </div>

      <div className="Popover_Footer">
        <div className="Form_Action">
          <Simple_Button text={t('common.cancel')} onClick={onClose} />
        </div>
        {/* Só a criar: a edição é na página do item */}
        {!item && mode === 'new' && (
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
  );
};

export default Item_Form_Popover;
