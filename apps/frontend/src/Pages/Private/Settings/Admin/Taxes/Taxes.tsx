import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAdminTaxes } from '../../../../../Hooks/Admin/useAdminTaxes';
import Simple_Button from '../../../../../Components/Buttons/Simple_Button/Simple_Button';
import Global_Dropdown from '../../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import Create_Tax_Popover from './Create_Tax_Popover';
import '../Admin.scss';

const ALL = 'all';

const Taxes = () => {
  const { t } = useTranslation();
  const { taxes, loading, saving, createTax } = useAdminTaxes();
  const [countryFilter, setCountryFilter] = useState(ALL);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Só os países que têm impostos: a lista de 250 não ajudava a filtrar
  const countriesWithTaxes = useMemo(() => {
    const byId = new Map<string, string>();
    taxes.forEach((tax) => tax.country && byId.set(tax.country.id, tax.country.name));
    return [...byId.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [taxes]);

  const visible = taxes
    .filter((tax) => countryFilter === ALL || tax.countryId === countryFilter)
    .sort((a, b) => (a.country?.name ?? '').localeCompare(b.country?.name ?? '') || b.rate - a.rate);

  return (
    <div className="Admin_Page">
      <div className="Page_Head">
        <div>
          <h1>{t('adminTaxes.title')}</h1>
          <div className="Page_Head_Sub">{t('adminTaxes.subtitle')}</div>
        </div>
        <div className="Page_Head_Actions">
          <Simple_Button text={t('adminTaxes.new')} onClick={() => setIsCreateOpen(true)} auto />
        </div>
      </div>

      <div className="Card Admin_Block Full">
        {loading ? (
          <span className="Admin_Message">{t('common.loading')}</span>
        ) : taxes.length === 0 ? (
          <div className="Admin_Block_Body">
            <div className="Empty_State">
              <span className="Empty_State_Title">{t('adminTaxes.empty')}</span>
              <span className="Empty_State_Text">{t('adminTaxes.emptyHint')}</span>
            </div>
          </div>
        ) : (
          <div className="Admin_Block_Body">
            <div className="Admin_Filter">
              <Global_Dropdown
                id="tax-country-filter"
                value={countryFilter}
                onChange={(value) => setCountryFilter(String(value))}
                options={[
                  { value: ALL, label: t('adminTaxes.allCountries') },
                  ...countriesWithTaxes.map(([id, name]) => ({ value: id, label: name })),
                ]}
              />
            </div>

            <div className="Table_Wrap">
              <table className="Table">
                <thead>
                  <tr>
                    <th>{t('adminTaxes.name')}</th>
                    <th>{t('adminTaxes.country')}</th>
                    <th className="Right">{t('adminTaxes.rate')}</th>
                    <th>{t('adminTaxes.category')}</th>
                    <th>{t('adminTaxes.origin')}</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((tax) => (
                    <tr key={tax.id}>
                      <td>
                        {tax.name}
                        {tax.description && <div className="Admin_Muted_Cell">{tax.description}</div>}
                      </td>
                      <td>{tax.country?.name ?? '—'}</td>
                      <td className="Num Right">{tax.rate}%</td>
                      <td className="Num">{tax.category}</td>
                      <td>
                        <span className={`Pill ${tax.type === 'system' ? 'Info' : 'Gold'}`}>
                          {tax.type === 'system' ? t('adminTaxes.system') : t('adminTaxes.custom')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {isCreateOpen && (
        <Create_Tax_Popover saving={saving} onClose={() => setIsCreateOpen(false)} onSubmit={createTax} />
      )}
    </div>
  );
};

export default Taxes;
