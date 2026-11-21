import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCompanySupplierOptions } from '../../../../Hooks/Companies/useCompanyOptions';
import type { CompanySupplierGroup } from '../../../../Hooks/Companies/useCompanySupplierGroups';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import './Company_Supplier_Groups.scss';
import Popover_Shell from '../../../../Components/Popover_Shell/Popover_Shell';

interface Group_Suppliers_Popover_Props {
  companyId: string;
  group: CompanySupplierGroup;
  onClose: () => void;
  onSave: (supplierIds: string[]) => Promise<void>;
}

const Group_Suppliers_Popover = ({
  companyId,
  group,
  onClose,
  onSave,
}: Group_Suppliers_Popover_Props) => {
  const { t } = useTranslation();
  const { suppliers, loading } = useCompanySupplierOptions(companyId);

  const [selectedIds, setSelectedIds] = useState<string[]>(
    group.suppliers.map((supplier) => supplier.id),
  );
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const toggleSupplier = (supplierId: string) => {
    setSelectedIds((current) =>
      current.includes(supplierId)
        ? current.filter((id) => id !== supplierId)
        : [...current, supplierId],
    );
  };

  const visibleSuppliers = suppliers.filter((supplier) =>
    supplier.name.toLowerCase().includes(search.toLowerCase()),
  );

  const handleSave = async () => {
    setSaving(true);
    await onSave(selectedIds);
    setSaving(false);
  };

  return (
    <Popover_Shell onClose={onClose} className="Narrow">
      <div className="Popover_Header">
        <div className="Popover_Header_Text">
          <span className="Popover_Title">{t('supplierGroups.manageSuppliers')}</span>
          <span className="Popover_Subtitle">{group.name}</span>
        </div>

        <button type="button" className="Popover_Close" onClick={onClose} aria-label={t('common.cancel')}>
          ×
        </button>
      </div>

      <div className="Popover_Body Single_Column">
        {loading ? (
          <span className="Groups_Message">{t('common.loading')}</span>
        ) : suppliers.length === 0 ? (
          <span className="Groups_Message">{t('suppliers.empty')}</span>
        ) : (
          <>
            <div className="Form_Field">
              <Global_Input
                id="group-suppliers-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('common.search')}
              />
            </div>

            <div className="Suppliers_Picker">
              {visibleSuppliers.length === 0 ? (
                <span className="Groups_Message">{t('common.noResults')}</span>
              ) : (
                visibleSuppliers.map((supplier) => (
                  <label key={supplier.id} className="Checkbox_Field Picker_Row">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(supplier.id)}
                      onChange={() => toggleSupplier(supplier.id)}
                    />
                    <span>{supplier.name}</span>
                    {supplier.group && supplier.group.id !== group.id && (
                      <span className="Picker_Hint">
                        {t('supplierGroups.inOtherGroup', { name: supplier.group.name })}
                      </span>
                    )}
                  </label>
                ))
              )}
            </div>
          </>
        )}
      </div>

      <div className="Popover_Footer">
        <div className="Form_Action">
          <Simple_Button text={t('common.cancel')} onClick={onClose} />
        </div>
        <div className="Form_Action">
          <Simple_Button
            text={t('common.save')}
            onClick={handleSave}
            disabled={saving || loading}
          />
        </div>
      </div>
    </Popover_Shell>
  );
};

export default Group_Suppliers_Popover;
