import { useTranslation } from 'react-i18next';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import type { useExchangeRate } from '../../../../Hooks/Companies/useExchangeRate';
import { localeOf } from '../../../../utils/locale';

interface Payment_Company_Amount_Field_Props {
  companyAmount: string;
  setCompanyAmount: (value: string) => void;
  suggestedCompanyAmount: number | null;
  manualCompanyAmount: boolean;
  exchange: ReturnType<typeof useExchangeRate>;
  shownDate: string;
  paymentCode: string;
  companyCode: string;
}

// Noutra moeda: o valor na da empresa. Proposto pela cotação do dia
// (em cinzento); escrever outro fixa o do extrato.
const Payment_Company_Amount_Field = ({
  companyAmount,
  setCompanyAmount,
  suggestedCompanyAmount,
  manualCompanyAmount,
  exchange,
  shownDate,
  paymentCode,
  companyCode,
}: Payment_Company_Amount_Field_Props) => {
  const { t, i18n } = useTranslation();

  return (
    <div className="Form_Field">
      <label htmlFor="payment-company-amount">
        {t('payments.companyAmount', { code: companyCode })}
      </label>
      <Global_Input
        id="payment-company-amount"
        type="number"
        value={companyAmount}
        onChange={(e) => setCompanyAmount(e.target.value)}
        placeholder={suggestedCompanyAmount === null ? '0.00' : suggestedCompanyAmount.toFixed(2)}
      />
      {manualCompanyAmount ? (
        <span className="Field_Hint">
          {t('payments.rateManual')}
          {' · '}
          <button type="button" className="Hint_Action" onClick={() => setCompanyAmount('')}>
            {t('payments.rateUseMarket')}
          </button>
        </span>
      ) : exchange.loading ? (
        <span className="Field_Hint">{t('payments.rateLoading', { date: shownDate })}</span>
      ) : exchange.rate !== null ? (
        <span className="Field_Hint">
          {t('payments.rateMarket', {
            date: shownDate,
            from: paymentCode,
            rate: exchange.rate.toLocaleString(localeOf(i18n.language), { maximumFractionDigits: 6 }),
            to: companyCode,
          })}
        </span>
      ) : (
        <span className="Field_Hint Field_Hint_Error">
          {t('payments.rateMissing', { code: companyCode })}
        </span>
      )}
    </div>
  );
};

export default Payment_Company_Amount_Field;
