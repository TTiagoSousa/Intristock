import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Expense_Category } from '../../../../Hooks/Finances/usePersonalExpense';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import Popover_Shell from '../../../../Components/Popover_Shell/Popover_Shell';

interface Category_Popover_Props {
  category: Expense_Category | null;
  // As mães possíveis (já com o caminho no nome); `movable` deixa mudar de sítio ao editar
  parents: { value: string; label: string }[];
  movable?: boolean;
  defaultParentId?: string | null;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (body: Record<string, unknown>) => void;
}

/** Criar uma categoria (dentro de outra ou principal), ou mudar o nome, o sítio e ativar/desativar. */
const Category_Popover = ({ category, parents, movable, defaultParentId, saving, error, onClose, onSave }: Category_Popover_Props) => {
  const { t } = useTranslation();
  const [name, setName] = useState(category?.name ?? '');
  const [parentId, setParentId] = useState(category?.parentId ?? defaultParentId ?? '');
  const [isActive, setIsActive] = useState(category?.isActive ?? true);

  return (
    <Popover_Shell
      onClose={onClose}
      as="form"
      className="Narrow"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        if (category) onSave({ name: name.trim(), isActive, ...(movable ? { parentId: parentId || null } : {}) });
        else onSave({ name: name.trim(), ...(parentId ? { parentId } : {}) });
      }}
    >
      <div className="Popover_Header">
        <div className="Popover_Header_Text">
          <span className="Popover_Title">{t(category ? 'expenses.categoryEditTitle' : 'expenses.categoryAddTitle')}</span>
        </div>
        <button type="button" className="Popover_Close" onClick={onClose} aria-label={t('common.cancel')}>
          ×
        </button>
      </div>
      <div className="Popover_Body Single_Column">
        <div className="Form_Field">
          <label htmlFor="category-name">{t('expenses.categoryName')} *</label>
          <Global_Input id="category-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        {(!category || movable) && (
          <div className="Form_Field">
            <label htmlFor="category-parent">{t('expenses.categoryParent')}</label>
            <Global_Dropdown
              id="category-parent"
              value={parentId}
              onChange={(value) => setParentId(String(value))}
              options={[{ value: '', label: t('expenses.categoryIsMain') }, ...parents]}
            />
          </div>
        )}
        {category && (
          <div className="Form_Field">
            <div className="Tabs">
              <button type="button" className={isActive ? 'Active' : ''} aria-pressed={isActive} onClick={() => setIsActive(true)}>
                {t('common.active')}
              </button>
              <button type="button" className={isActive ? '' : 'Active'} onClick={() => setIsActive(false)}>
                {t('common.inactive')}
              </button>
            </div>
          </div>
        )}
        {error && <span className="Field_Hint Earnings_Error">{error}</span>}
      </div>
      <div className="Popover_Footer">
        <div className="Form_Action">
          <Simple_Button text={t('common.cancel')} onClick={onClose} variant="Ghost" />
        </div>
        <div className="Form_Action">
          <Simple_Button type="submit" text={t('common.save')} disabled={saving || !name.trim()} />
        </div>
      </div>
    </Popover_Shell>
  );
};

export default Category_Popover;
