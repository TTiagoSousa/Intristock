import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAlert } from '../../../../Contexts/Alert_Context';
import {
  STOCK_MOVEMENT_TYPES,
  type StockBalance,
  type StockMovementPayload,
  type StockMovementType,
} from '../../../../Hooks/Companies/useCompanyStock';
import type { CompanyItem } from '../../../../Hooks/Companies/useCompanyItems';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';

interface Stock_Movement_Popover_Props {
  companyName: string;
  // Só itens marcados como stock: nada mais tem quantidade para mover
  items: CompanyItem[];
  // O saldo de cada item, para não deixar sair mais do que há em mão
  balance: StockBalance[];
  // Quando a lista já está filtrada por item, o formulário abre nesse
  initialItemId?: string;
  onClose: () => void;
  onSubmit: (payload: StockMovementPayload) => Promise<void>;
}

const Stock_Movement_Popover = ({
  companyName,
  items,
  balance,
  initialItemId,
  onClose,
  onSubmit,
}: Stock_Movement_Popover_Props) => {
  const { t } = useTranslation();
  const { setAlert } = useAlert();

  const [itemId, setItemId] = useState(initialItemId ?? items[0]?.id ?? '');
  const [type, setType] = useState<StockMovementType>('in');
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [occurredAt, setOccurredAt] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const selectedItem = items.find((item) => item.id === itemId);
  // Custo unitário só entra com stock: numa saída o custo é o médio já em mão
  const acceptsCost = type === 'in';

  // Um item sem movimentos nenhuns não aparece no saldo: aí não há nada em mão
  const available = balance.find((row) => row.itemId === itemId)?.quantity ?? 0;
  const unit = selectedItem?.stockUnit ?? '';
  const isLeaving = type === 'out';
  const takesTooMuch = isLeaving && Number(quantity) > available;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!itemId) {
      setAlert({ open: true, message: t('stock.itemRequired'), type: 'error' });
      return;
    }

    if (Number(quantity) <= 0) {
      setAlert({ open: true, message: t('stock.quantityInvalid'), type: 'error' });
      return;
    }

    // O backend valida o mesmo — isto é só para não se dar a viagem em vão
    if (takesTooMuch) {
      setAlert({
        open: true,
        message: t('stock.notEnough', { available, unit, item: selectedItem?.name ?? '' }),
        type: 'error',
      });
      return;
    }

    setSaving(true);
    await onSubmit({
      itemId,
      type,
      quantity: Number(quantity),
      unitCost: acceptsCost && unitCost !== '' ? Number(unitCost) : undefined,
      occurredAt,
      note: note.trim() || undefined,
    });
    setSaving(false);
  };

  return (
    <div className="Popover_Backdrop" onClick={onClose}>
      <form className="Popover_Card" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <div className="Popover_Header">
          <div className="Popover_Header_Text">
            <span className="Popover_Title">{t('stock.createMovementTitle')}</span>
            <span className="Popover_Subtitle">{companyName}</span>
          </div>

          <button
            type="button"
            className="Popover_Close"
            onClick={onClose}
            aria-label={t('common.cancel')}
          >
            ×
          </button>
        </div>

        <div className="Popover_Body">
          <div className="Form_Field">
            <label htmlFor="movement-item">{t('stock.columnItem')} *</label>
            <Global_Dropdown
              id="movement-item"
              value={itemId}
              onChange={(value) => setItemId(String(value))}
              placeholder={t('stock.selectPlaceholder')}
              options={items.map((item) => ({ value: item.id, label: item.name }))}
            />
          </div>

          <div className="Form_Field">
            <label htmlFor="movement-type">{t('stock.columnType')} *</label>
            <Global_Dropdown
              id="movement-type"
              value={type}
              onChange={(value) => setType(value as StockMovementType)}
              options={STOCK_MOVEMENT_TYPES.map((value) => ({
                value,
                label: t(`stock.type_${value}`),
              }))}
            />
          </div>

          <div className="Form_Field">
            <label htmlFor="movement-quantity">
              {t('stock.columnQuantity')} {selectedItem?.stockUnit ? `(${selectedItem.stockUnit})` : ''} *
            </label>
            <Global_Input
              id="movement-quantity"
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0"
            />
            {/* Numa saída a dica dá lugar ao que há em mão: é a informação que
                decide se o número escrito faz sentido */}
            <span className={`Field_Hint ${takesTooMuch ? 'Field_Hint_Error' : ''}`}>
              {isLeaving
                ? t('stock.available', { available, unit })
                : t('stock.quantityHint')}
            </span>
          </div>

          <div className="Form_Field">
            <label htmlFor="movement-date">{t('stock.columnDate')} *</label>
            <input
              id="movement-date"
              type="date"
              className="Stock_Date_Input"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
            />
          </div>

          {/* Só as entradas trazem custo: é delas que sai o custo médio */}
          {acceptsCost && (
            <div className="Form_Field">
              <label htmlFor="movement-cost">{t('stock.columnUnitCost')}</label>
              <Global_Input
                id="movement-cost"
                type="number"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                placeholder="0.00"
              />
              <span className="Field_Hint">{t('stock.unitCostHint')}</span>
            </div>
          )}

          <div className="Form_Field Full_Width">
            <label htmlFor="movement-note">{t('stock.columnNote')}</label>
            <textarea
              id="movement-note"
              className="Form_Textarea"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('stock.notePlaceholder')}
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

export default Stock_Movement_Popover;
