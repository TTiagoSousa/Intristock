import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAlert } from '../../../../Contexts/Alert_Context';
import { useCurrency } from '../../../../Contexts/Currency_Context';
import { useCompanyPaymentOptions } from '../../../../Hooks/Companies/useCompanyPaymentOptions';
import {
  ASSET_CATEGORIES,
  ASSET_STATUSES,
  type AssetCategory,
  type AssetStatus,
  type CompanyAsset,
  type CompanyAssetPayload,
} from '../../../../Hooks/Companies/useCompanyAssets';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';

// Opção que deixa o ativo sem compra de origem — o valor vazio é filtrado
// antes de ir para a API
const NO_PAYMENT_OPTION = '';

interface Asset_Form_Popover_Props {
  companyId: string;
  companyName: string;
  // Quando vem preenchido, o formulário está em modo de edição
  asset?: CompanyAsset;
  onClose: () => void;
  onSubmit: (payload: CompanyAssetPayload) => Promise<void>;
  // A moeda base da empresa, para um ativo novo já nascer nela em vez de
  // obrigar a escolher — escolher à mão é como um ativo pago em euros acaba
  // gravado em dólares sem ninguém dar por isso
  companyCurrencyId?: string;
}

const toDateInput = (value: string | null | undefined) =>
  value ? new Date(value).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);

const Asset_Form_Popover = ({
  companyId,
  companyName,
  asset,
  onClose,
  onSubmit,
  companyCurrencyId,
}: Asset_Form_Popover_Props) => {
  const { t } = useTranslation();
  const { setAlert } = useAlert();
  const { currencies, loading: loadingCurrencies } = useCurrency();
  const { payments, loading: loadingPayments } = useCompanyPaymentOptions(companyId);

  const [name, setName] = useState(asset?.name ?? '');
  const [category, setCategory] = useState<AssetCategory>(asset?.category ?? 'equipamento_basico');
  const [acquisitionDate, setAcquisitionDate] = useState(toDateInput(asset?.acquisitionDate));
  const [acquisitionValue, setAcquisitionValue] = useState(asset?.acquisitionValue ?? '');
  const [currencyId, setCurrencyId] = useState(asset?.currencyId ?? companyCurrencyId ?? '');
  const [depreciationRate, setDepreciationRate] = useState(asset?.depreciationRate ?? '');
  const [usefulLifeHours, setUsefulLifeHours] = useState(
    asset?.usefulLifeHours === null || asset?.usefulLifeHours === undefined
      ? ''
      : String(asset.usefulLifeHours),
  );
  const [residualValue, setResidualValue] = useState(asset?.residualValue ?? '');
  const [status, setStatus] = useState<AssetStatus>(asset?.status ?? 'em_uso');
  const [disposedAt, setDisposedAt] = useState(asset?.disposedAt ? toDateInput(asset.disposedAt) : '');
  const [disposalValue, setDisposalValue] = useState(asset?.disposalValue ?? '');
  const [paymentId, setPaymentId] = useState(asset?.paymentId ?? '');
  const [notes, setNotes] = useState(asset?.notes ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Só quem sai de circulação é que precisa da data e do valor de saída
  const isLeaving = status === 'abatido' || status === 'vendido';

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (name.trim().length < 2) {
      setAlert({ open: true, message: t('assets.nameTooShort'), type: 'error' });
      return;
    }

    if (!currencyId) {
      setAlert({ open: true, message: t('assets.currencyRequired'), type: 'error' });
      return;
    }

    if (Number(acquisitionValue) <= 0) {
      setAlert({ open: true, message: t('assets.valueInvalid'), type: 'error' });
      return;
    }

    if (isLeaving && !disposedAt) {
      setAlert({ open: true, message: t('assets.disposalDateRequired'), type: 'error' });
      return;
    }

    setSaving(true);
    await onSubmit({
      name: name.trim(),
      category,
      acquisitionDate,
      acquisitionValue: Number(acquisitionValue),
      currencyId,
      depreciationRate: Number(depreciationRate) || 0,
      usefulLifeHours: usefulLifeHours ? Number(usefulLifeHours) : undefined,
      residualValue: residualValue ? Number(residualValue) : undefined,
      paymentId,
      notes: notes.trim() || undefined,
      ...(asset ? { status } : {}),
      ...(isLeaving ? { disposedAt, disposalValue: Number(disposalValue) || 0 } : {}),
    });
    setSaving(false);
  };

  return (
    <div className="Popover_Backdrop" onClick={onClose}>
      <form className="Popover_Card" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <div className="Popover_Header">
          <div className="Popover_Header_Text">
            <span className="Popover_Title">
              {t(asset ? 'assets.editTitle' : 'assets.createTitle')}
            </span>
            <span className="Popover_Subtitle">{companyName}</span>
          </div>

          <button type="button" className="Popover_Close" onClick={onClose} aria-label={t('common.cancel')}>
            ×
          </button>
        </div>

        <div className="Popover_Body">
          <div className="Form_Field">
            <label htmlFor="asset-name">{t('assets.columnName')} *</label>
            <Global_Input
              id="asset-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('assets.namePlaceholder')}
            />
          </div>

          <div className="Form_Field">
            <label htmlFor="asset-category">{t('assets.columnCategory')} *</label>
            <Global_Dropdown
              id="asset-category"
              value={category}
              onChange={(value) => setCategory(value as AssetCategory)}
              options={ASSET_CATEGORIES.map((item) => ({
                value: item,
                label: t(`assets.category_${item}`),
              }))}
            />
          </div>

          <div className="Form_Field">
            <label htmlFor="asset-date">{t('assets.columnAcquiredAt')} *</label>
            <input
              id="asset-date"
              type="date"
              className="Asset_Date_Input"
              value={acquisitionDate}
              onChange={(e) => setAcquisitionDate(e.target.value)}
            />
          </div>

          <div className="Form_Field">
            <label htmlFor="asset-value">{t('assets.columnValue')} *</label>
            <Global_Input
              id="asset-value"
              type="number"
              value={acquisitionValue}
              onChange={(e) => setAcquisitionValue(e.target.value)}
              placeholder="0.00"
            />
            <span className="Field_Hint">{t('assets.valueHint')}</span>
          </div>

          <div className="Form_Field">
            <label htmlFor="asset-currency">{t('assets.columnCurrency')} *</label>
            <Global_Dropdown
              id="asset-currency"
              value={currencyId}
              onChange={(value) => setCurrencyId(String(value))}
              disabled={loadingCurrencies}
              placeholder={t('assets.selectPlaceholder')}
              options={currencies.map((currency) => ({
                value: currency.id,
                label: `${currency.shortCode} (${currency.symbol})`,
              }))}
            />
          </div>

          <div className="Form_Field">
            <label htmlFor="asset-rate">{t('assets.columnRate')} *</label>
            <Global_Input
              id="asset-rate"
              type="number"
              value={depreciationRate}
              onChange={(e) => setDepreciationRate(e.target.value)}
              placeholder="0"
            />
            <span className="Field_Hint">{t('assets.rateHint')}</span>
          </div>

          <div className="Form_Field">
            <label htmlFor="asset-hours">{t('assets.columnUsefulLifeHours')}</label>
            <Global_Input
              id="asset-hours"
              type="number"
              value={usefulLifeHours}
              onChange={(e) => setUsefulLifeHours(e.target.value)}
              placeholder="6000"
            />
            <span className="Field_Hint">{t('assets.hoursHint')}</span>
          </div>

          <div className="Form_Field">
            <label htmlFor="asset-residual">{t('assets.columnResidual')}</label>
            <Global_Input
              id="asset-residual"
              type="number"
              value={residualValue}
              onChange={(e) => setResidualValue(e.target.value)}
              placeholder="0.00"
            />
          </div>

          {/* O estado só se muda a editar: um ativo nasce sempre em uso */}
          {asset && (
            <div className="Form_Field">
              <label htmlFor="asset-status">{t('assets.columnStatus')}</label>
              <Global_Dropdown
                id="asset-status"
                value={status}
                onChange={(value) => setStatus(value as AssetStatus)}
                options={ASSET_STATUSES.map((item) => ({
                  value: item,
                  label: t(`assets.status_${item}`),
                }))}
              />
            </div>
          )}

          {isLeaving && (
            <>
              <div className="Form_Field">
                <label htmlFor="asset-disposed">{t('assets.columnDisposedAt')} *</label>
                <input
                  id="asset-disposed"
                  type="date"
                  className="Asset_Date_Input"
                  value={disposedAt}
                  onChange={(e) => setDisposedAt(e.target.value)}
                />
              </div>

              <div className="Form_Field">
                <label htmlFor="asset-disposal-value">{t('assets.columnDisposalValue')}</label>
                <Global_Input
                  id="asset-disposal-value"
                  type="number"
                  value={disposalValue}
                  onChange={(e) => setDisposalValue(e.target.value)}
                  placeholder="0.00"
                />
                <span className="Field_Hint">{t('assets.disposalHint')}</span>
              </div>
            </>
          )}


          {/* Um ativo criado aqui não passa por pagamento nenhum: nenhum
              dinheiro sai de uma conta. É assim de propósito, para se poder
              registar equipamento anterior à empresa ou entrado como capital.
              Quem tiver a compra registada liga-a aqui. */}
          <div className="Form_Field Full_Width">
            <label htmlFor="asset-payment">{t('assets.columnOrigin')}</label>
            <Global_Dropdown
              id="asset-payment"
              value={paymentId}
              onChange={(value) => setPaymentId(String(value))}
              disabled={loadingPayments}
              placeholder={t('assets.noPayment')}
              options={[
                { value: NO_PAYMENT_OPTION, label: t('assets.noPayment') },
                ...payments
                  .filter((payment) => payment.paymentType === 'pay')
                  .map((payment) => ({
                    value: payment.id,
                    label: [
                      payment.reference ?? t('assets.noReference'),
                      new Date(payment.paymentDate).toLocaleDateString(),
                      payment.supplier?.name,
                    ]
                      .filter(Boolean)
                      .join(' · '),
                  })),
              ]}
            />
            <span className="Field_Hint">{t('assets.originHint')}</span>
          </div>

          <div className="Form_Field Full_Width">
            <label htmlFor="asset-notes">{t('assets.columnNotes')}</label>
            <textarea
              id="asset-notes"
              className="Form_Textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <div className="Popover_Footer">
          <div className="Form_Action">
            <Simple_Button text={t('common.cancel')} onClick={onClose} variant="Ghost" />
          </div>
          <div className="Form_Action">
            <Simple_Button
              type="submit"
              text={saving ? t('common.saving') : t('common.save')}
              disabled={saving}
            />
          </div>
        </div>
      </form>
    </div>
  );
};

export default Asset_Form_Popover;
