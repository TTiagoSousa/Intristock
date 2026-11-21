import type { Dispatch, SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import * as Icon from '../../../../Imports/icons';
import type { Tax } from '../../../../Hooks/Companies/useTaxes';
import { roundMoney } from './paymentForm';

interface Payment_Taxes_Field_Props {
  taxes: Tax[];
  loadingTaxes: boolean;
  appliedTaxes: Tax[];
  availableTaxes: Tax[];
  setSelectedTaxIds: Dispatch<SetStateAction<string[]>>;
  companyCountryId: string | null;
  baseAmount: number;
  hasTaxes: boolean;
  pricesIncludeTax: boolean;
  setPricesIncludeTax: (value: boolean) => void;
  formatMoney: (value: number) => string;
}

// O IVA e afins somam-se por cima da base. Os valores que ficam
// gravados são os que o backend calcula — isto aqui é a prévia.
const Payment_Taxes_Field = ({
  taxes,
  loadingTaxes,
  appliedTaxes,
  availableTaxes,
  setSelectedTaxIds,
  companyCountryId,
  baseAmount,
  hasTaxes,
  pricesIncludeTax,
  setPricesIncludeTax,
  formatMoney,
}: Payment_Taxes_Field_Props) => {
  const { t } = useTranslation();

  return (
    <div className="Form_Field Full_Width">
      <div className="Lines_Header">
        <label>{t('payments.taxesTitle')}</label>
      </div>

      {loadingTaxes ? (
        <span className="Lines_Empty">{t('common.loading')}</span>
      ) : taxes.length === 0 ? (
        <span className="Lines_Empty">{t('payments.noTaxesAvailable')}</span>
      ) : (
        <>
          {/* Já escolhidos, pela ordem em que entraram — a ordem conta
              quando um imposto incide sobre a linha anterior */}
          {appliedTaxes.length > 0 && (
            <div className="Tax_Rows">
              {appliedTaxes.map((tax) => (
                <div className="Tax_Row" key={tax.id}>
                  <span className="Tax_Row_Name">
                    {tax.name}
                    {tax.countryId !== companyCountryId && tax.country && (
                      <span className="Tax_Row_Country">{tax.country.name}</span>
                    )}
                  </span>
                  <span className="Tax_Row_Rate">{tax.rate}%</span>
                  <span className="Tax_Row_Value">
                    {formatMoney(roundMoney((baseAmount * tax.rate) / 100))}
                  </span>
                  <button
                    type="button"
                    className="Line_Remove"
                    onClick={() =>
                      setSelectedTaxIds((current) => current.filter((id) => id !== tax.id))
                    }
                    title={t('common.delete')}
                    aria-label={t('common.delete')}
                  >
                    <Icon.Trash />
                  </button>
                </div>
              ))}
            </div>
          )}

          {availableTaxes.length > 0 && (
            <Global_Dropdown
              id="payment-add-tax"
              value=""
              onChange={(value) =>
                setSelectedTaxIds((current) => [...current, value as string])
              }
              placeholder={t('payments.addTax')}
              searchable
              options={availableTaxes.map((tax) => ({
                value: tax.id,
                // O país só aparece quando não é o da empresa, senão
                // repetia-se em todas as linhas sem dizer nada
                label:
                  tax.countryId === companyCountryId || !tax.country
                    ? `${tax.name} (${tax.rate}%)`
                    : `${tax.name} (${tax.rate}%) · ${tax.country.name}`,
              }))}
            />
          )}
        </>
      )}

      {/* A fatura tanto pode vir "100 + IVA" como "123 com IVA incluído".
          Nos dois casos o que fica guardado é 100 + 23. */}
      {hasTaxes && (
        <label className="Checkbox_Field Inclusive_Toggle" htmlFor="payment-inclusive">
          <input
            id="payment-inclusive"
            type="checkbox"
            checked={pricesIncludeTax}
            onChange={(e) => setPricesIncludeTax(e.target.checked)}
          />
          <span>{t('payments.pricesIncludeTax')}</span>
        </label>
      )}
    </div>
  );
};

export default Payment_Taxes_Field;
