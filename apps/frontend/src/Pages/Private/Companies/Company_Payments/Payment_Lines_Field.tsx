import type { Dispatch, SetStateAction } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import * as Icon from '../../../../Imports/icons';
import type { New_Item_State } from '../Company_Items/Company_Item';
import { emptyLine, lineTotal, type Draft_Line } from './paymentForm';

interface Payment_Lines_Field_Props {
  lines: Draft_Line[];
  setLines: Dispatch<SetStateAction<Draft_Line[]>>;
  updateLine: (key: string, changes: Partial<Draft_Line>) => void;
  handleItemChange: (key: string, itemId: string) => void;
  itemOptions: { value: string; label: string; group?: string }[];
  activeItemsCount: number;
  loadingItems: boolean;
  selectedSupplierId: string;
  formatMoney: (value: number) => string;
}

// Detalhe do que foi comprado. Sem linhas, o pagamento é só um valor.
const Payment_Lines_Field = ({
  lines,
  setLines,
  updateLine,
  handleItemChange,
  itemOptions,
  activeItemsCount,
  loadingItems,
  selectedSupplierId,
  formatMoney,
}: Payment_Lines_Field_Props) => {
  const { t } = useTranslation();
  const { slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="Form_Field Full_Width">
      <div className="Lines_Header">
        <label>{t('payments.linesTitle')}</label>
        <div className="Documents_Action">
          <Simple_Button
            text={t('payments.addLine')}
            onClick={() => setLines((current) => [...current, emptyLine()])}
            disabled={loadingItems || activeItemsCount === 0}
          />
        </div>
      </div>

      {activeItemsCount === 0 && !loadingItems ? (
        <span className="Lines_Empty">{t('payments.noItems')}</span>
      ) : lines.length === 0 ? (
        <span className="Lines_Empty">{t('payments.noLines')}</span>
      ) : (
        <div className="Payment_Lines">
          {lines.map((line) => (
            <div className="Payment_Line" key={line.key}>
              <div className="Line_Item">
                <Global_Dropdown
                  value={line.itemId}
                  onChange={(value) => handleItemChange(line.key, value as string)}
                  placeholder={t('payments.selectItem')}
                  searchable
                  // Criar um item sai daqui para a página inteira; no fim
                  // volta aos pagamentos e o formulário reabre com ele numa linha
                  action={{
                    label: t('payments.newItem'),
                    onClick: () => {
                      // O item novo já fica ligado ao fornecedor escolhido
                      const state: New_Item_State = {
                        returnTo: location.pathname,
                        supplierId: selectedSupplierId || undefined,
                      };
                      navigate(`/Companies/${slug}/compras/itens/new-item`, { state });
                    },
                  }}
                  options={itemOptions}
                />
              </div>

              <div className="Line_Number">
                <Global_Input
                  type="number"
                  value={line.quantity}
                  onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                  placeholder={t('payments.quantity')}
                />
              </div>

              <div className="Line_Number">
                <Global_Input
                  type="number"
                  value={line.unitPrice}
                  onChange={(e) => updateLine(line.key, { unitPrice: e.target.value })}
                  placeholder={t('payments.unitPrice')}
                />
              </div>

              <span className="Line_Total">{formatMoney(lineTotal(line))}</span>

              <button
                type="button"
                className="Line_Remove"
                onClick={() =>
                  setLines((current) => current.filter((entry) => entry.key !== line.key))
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
    </div>
  );
};

export default Payment_Lines_Field;
