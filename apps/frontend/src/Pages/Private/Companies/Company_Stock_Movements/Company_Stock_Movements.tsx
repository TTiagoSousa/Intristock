import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCompanies } from '../../../../Hooks/Companies/useCompanies';
import { useCompanyStock, type StockMovement } from '../../../../Hooks/Companies/useCompanyStock';
import { useCompanyItemOptions } from '../../../../Hooks/Companies/useCompanyOptions';
import { useBreadcrumbSegmentLabel } from '../../../../Contexts/Breadcrumb_Context';
import { useCurrencyFormat } from '../../../../Hooks/useCurrencyFormat';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import Global_Pagination from '../../../../Components/Pagination/Global_Pagination/Global_Pagination';
import Stock_Movement_Popover from './Stock_Movement_Popover';
import * as Icon from '../../../../Imports/icons';
import { useCompany } from '../../../../Contexts/Company_Context';
import './Company_Stock_Movements.scss';

const Company_Stock_Movements = () => {
  const { slug } = useParams();
  const { companies } = useCompanies();
  const { can } = useCompany();
  const { t } = useTranslation();
  const { formatIn } = useCurrencyFormat();

  // O filtro vive no URL: vindo das existências, a linha já traz o item,
  // e o endereço continua a dizer o que se está a ver
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedItemId = searchParams.get('item') ?? undefined;

  const company = companies.find((item) => item.slug === slug);
  const {
    balance,
    movements,
    movementsPage,
    setMovementsPage,
    movementsTotal,
    movementsTotalPages,
    pageSize,
    loading,
    refresh,
    createMovement,
    deleteMovement,
  } = useCompanyStock(company?.id, selectedItemId);
  const { items } = useCompanyItemOptions(company?.id);

  const [isFormOpen, setIsFormOpen] = useState(false);

  useBreadcrumbSegmentLabel(slug, company?.name);

  const stockItems = items.filter((item) => item.kind === 'stock');
  // O filtro por item é feito pelo servidor: filtrar aqui só filtrava as dez
  // linhas desta página e o total continuava a contar as outras

  const selectedItem = stockItems.find((item) => item.id === selectedItemId);

  const movementLabel = (movement: StockMovement) => {
    if (movement.sourceType === 'payment') return t('stock.sourcePayment');
    if (movement.sourceType === 'production') return t('stock.sourceProduction');
    return t('stock.sourceManual');
  };

  return (
    <div className="Company_Stock_Movements">
      <div className="Page_Card">
        <div className="Card_Header">
          <div className="Card_Header_Text">
            <span className="Card_Title">{t('stock.movementsTitle')}</span>
            <span className="Card_Subtitle">
              {loading ? ' ' : t('stock.movementsCount', { count: movementsTotal })}
            </span>
          </div>

          {/* O filtro é uma pastilha e não um segundo botão: o cabeçalho tem
              lugar para uma ação só, e assim vê-se o que está filtrado */}
          {selectedItem && (
            <button type="button" className="Filter_Chip" onClick={() => setSearchParams({})}>
              {selectedItem.name}
              <Icon.Close />
            </button>
          )}

          {can('stock.create') && (
            <div className="Card_Header_Action">
              <Simple_Button
                text={t('stock.createMovement')}
                onClick={() => setIsFormOpen(true)}
                disabled={stockItems.length === 0}
              />
            </div>
          )}
        </div>

        {loading ? (
          <span className="Empty_Message">{t('common.loading')}</span>
        ) : stockItems.length === 0 ? (
          <span className="Empty_Message">{t('stock.noStockItems')}</span>
        ) : movements.length === 0 ? (
          <span className="Empty_Message">{t('stock.noMovements')}</span>
        ) : (
          <>
          <div className="Stock_Table_Scroll">
            <table className="Stock_Table">
              <thead>
                <tr>
                  <th>{t('stock.columnDate')}</th>
                  <th>{t('stock.columnItem')}</th>
                  <th>{t('stock.columnType')}</th>
                  <th className="Right">{t('stock.columnQuantity')}</th>
                  <th className="Right">{t('stock.columnUnitCost')}</th>
                  <th>{t('stock.columnSource')}</th>
                  <th>{t('stock.columnNote')}</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {movements.map((movement) => (
                  <tr key={movement.id}>
                    <td className="Numeric Left">
                      {new Date(movement.occurredAt).toLocaleDateString()}
                    </td>
                    <td className="Movement_Item_Name">{movement.item.name}</td>
                    <td>
                      <span className={`Movement_Type ${movement.type}`}>
                        {t(`stock.type_${movement.type}`)}
                      </span>
                    </td>
                    <td className="Amount">
                      {movement.type === 'out' ? '−' : '+'}
                      {Number(movement.quantity)} {movement.item.stockUnit ?? ''}
                    </td>
                    <td className="Amount">
                      {movement.unitCost === null ? (
                        <span className="Dim">—</span>
                      ) : (
                        formatIn(Number(movement.unitCost), company?.currency, 4)
                      )}
                    </td>
                    <td>
                      <span className="Pill">{movementLabel(movement)}</span>
                    </td>
                    <td className="Movement_Note">{movement.note ?? '—'}</td>
                    <td className="Right">
                      {/* Movimentos vindos de uma compra não se apagam aqui:
                          apaga-se a compra, e eles vão atrás */}
                      {movement.sourceType === 'manual' && can('stock.delete') && (
                        <div className="Movement_Actions">
                          <button
                            type="button"
                            className="Row_Action Danger"
                            onClick={async () => {
                              const deleted = await deleteMovement(movement.id);
                              if (deleted) await refresh();
                            }}
                            aria-label={t('common.delete')}
                          >
                            <Icon.Trash />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Global_Pagination
            page={movementsPage}
            totalPages={movementsTotalPages}
            onPageChange={setMovementsPage}
            totalItems={movementsTotal}
            pageSize={pageSize}
          />
          </>
        )}
      </div>

      {isFormOpen && company && (
        <Stock_Movement_Popover
          companyName={company.name}
          items={stockItems}
          balance={balance}
          initialItemId={selectedItemId}
          onClose={() => setIsFormOpen(false)}
          onSubmit={async (payload) => {
            const saved = await createMovement(payload);

            if (saved) {
              setIsFormOpen(false);
              await refresh();
            }
          }}
        />
      )}
    </div>
  );
};

export default Company_Stock_Movements;
