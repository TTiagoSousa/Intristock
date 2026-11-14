import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCompanies } from '../../../../Hooks/Companies/useCompanies';
import { useCompanyStock } from '../../../../Hooks/Companies/useCompanyStock';
import { useCompanyItemOptions } from '../../../../Hooks/Companies/useCompanyOptions';
import { useBreadcrumbSegmentLabel } from '../../../../Contexts/Breadcrumb_Context';
import { useCurrencyFormat } from '../../../../Hooks/useCurrencyFormat';
import Global_Pagination from '../../../../Components/Pagination/Global_Pagination/Global_Pagination';
import './Company_Stock_Balance.scss';

// Quanto há de cada item e quanto vale. O porquê de cada quantidade está nos
// movimentos — daí cada linha levar lá, já filtrada.
const Company_Stock_Balance = () => {
  const { slug } = useParams();
  const { companies } = useCompanies();
  const { t } = useTranslation();
  const { formatIn } = useCurrencyFormat();
  const navigate = useNavigate();

  const company = companies.find((item) => item.slug === slug);
  const {
    balance,
    balancePage,
    setBalancePage,
    balanceTotal,
    balanceTotalPages,
    // O valor de tudo o que está em mão, vindo do backend: somar as dez linhas
    // à vista daria um total que só conta uma parte
    stockValue,
    pageSize,
    loading,
  } = useCompanyStock(company?.id);
  const { items } = useCompanyItemOptions(company?.id);

  useBreadcrumbSegmentLabel(slug, company?.name);

  const stockItems = items.filter((item) => item.kind === 'stock');

  // A empresa trabalha só na moeda dela, por isso é nela que estes valores
  // estão — não na que estiver escolhida nas definições, que é preferência de
  // quem está a ver e não muda o que o número é.
  const money = (value: number, decimals = 2) => formatIn(value, company?.currency, decimals);


  return (
    <div className="Company_Stock_Balance">
      <div className="Page_Card">
        <div className="Card_Header">
          <div className="Card_Header_Text">
            <span className="Card_Title">{t('stock.balanceTitle')}</span>
            <span className="Card_Subtitle">
              {loading ? ' ' : t('stock.balanceCount', { count: balanceTotal })}
            </span>
          </div>
        </div>

        {loading ? (
          <span className="Empty_Message">{t('common.loading')}</span>
        ) : stockItems.length === 0 ? (
          <span className="Empty_Message">{t('stock.noStockItems')}</span>
        ) : balance.length === 0 ? (
          <span className="Empty_Message">{t('stock.empty')}</span>
        ) : (
          <>
          <div className="Stock_Table_Scroll">
            <table className="Stock_Table">
              <thead>
                <tr>
                  <th>{t('stock.columnItem')}</th>
                  <th className="Right">{t('stock.columnQuantity')}</th>
                  <th className="Right">{t('stock.columnAverageCost')}</th>
                  <th className="Right">{t('stock.columnValue')}</th>
                  <th className="Right">{t('stock.columnMovements')}</th>
                  <th>{t('stock.columnLastMovement')}</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {balance.map((row) => (
                  <tr
                    key={row.itemId}
                    className="Stock_Row"
                    onClick={() =>
                      navigate(`/Companies/${slug}/stock/movimentos?item=${row.itemId}`)
                    }
                  >
                    <td className="Stock_Item_Name">{row.itemName}</td>
                    <td className={`Amount ${row.quantity < 0 ? 'Stock_Negative' : ''}`}>
                      {row.quantity} {row.stockUnit ?? ''}
                    </td>
                    <td className="Amount">{money(row.averageUnitCost, 4)}</td>
                    <td className="Amount Stock_Value">{money(row.totalValue)}</td>
                    <td className="Amount">{row.movements}</td>
                    <td className="Numeric Left">
                      {row.lastMovementAt ? new Date(row.lastMovementAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="Right">
                      <span className="Stock_Expand">{t('stock.showItem')}</span>
                    </td>
                  </tr>
                ))}
              </tbody>

              <tfoot>
                <tr>
                  <td colSpan={3}>{t('stock.totalValue')}</td>
                  <td className="Amount Stock_Value">{money(stockValue)}</td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <Global_Pagination
            page={balancePage}
            totalPages={balanceTotalPages}
            onPageChange={setBalancePage}
            totalItems={balanceTotal}
            pageSize={pageSize}
          />
          </>
        )}
      </div>
    </div>
  );
};

export default Company_Stock_Balance;
