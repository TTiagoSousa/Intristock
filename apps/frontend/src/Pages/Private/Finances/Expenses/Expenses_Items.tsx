import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCurrency } from '../../../../Contexts/Currency_Context';
import { useCurrencyFormat } from '../../../../Hooks/useCurrencyFormat';
import { useExpenseItems, type Expense_Category, type Personal_Product } from '../../../../Hooks/Finances/usePersonalExpense';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import Global_Pagination from '../../../../Components/Pagination/Global_Pagination/Global_Pagination';
import { usePagedList } from '../../../../Hooks/usePagedList';
import * as Icon from '../../../../Imports/icons';
import { formatDay, localeOf } from '../Earnings/earningsLabels';
import Category_Popover from './Category_Popover';
import Product_Popover from './Product_Popover';
import Subscriptions_Tab from './Subscriptions_Tab';
import { treeOptions } from './expensesShared';
import '../Earnings/Earnings.scss';
import './Expenses.scss';

type Tab = 'items' | 'subscriptions' | 'itemCategories' | 'categories';
const TABS: Tab[] = ['items', 'subscriptions', 'itemCategories', 'categories'];
// O filtro dos itens que ainda não têm categoria
const UNCATEGORIZED = 'none';

type Editing =
  | { kind: 'product'; product: Personal_Product | null }
  | { kind: 'itemCategory'; category: Expense_Category | null; parentId?: string }
  | { kind: 'category'; category: Expense_Category | null; parentId?: string };

/**
 * Os itens das despesas: o catálogo dos produtos comprados (com o que se gastou
 * em cada um), onde se lhes dá a categoria de item — uma árvore sem limite de
 * níveis (Bebidas › Vinhos › Tinto) —, as subscrições e, à parte, as categorias
 * das despesas, também em árvore (Lazer › Saídas › Cinema), com o acrescentar as
 * por omissão que faltam.
 */
const Expenses_Items = () => {
  const { t, i18n } = useTranslation();
  const { currencies, selectedCurrency } = useCurrency();
  const { formatIn } = useCurrencyFormat();
  const locale = localeOf(i18n.language);
  const [tab, setTab] = useState<Tab>('items');
  const [q, setQ] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [editing, setEditing] = useState<Editing | null>(null);
  // Quantas categorias por omissão entraram da última vez
  const [defaultsAdded, setDefaultsAdded] = useState<number | null>(null);
  // A moeda é a escolhida no topo, para o site todo
  const currencyId = currencies.find((currency) => currency.shortCode === selectedCurrency)?.id ?? '';
  const state = useExpenseItems(currencyId);
  const code = state.currency?.shortCode ?? selectedCurrency;

  const close = () => {
    setEditing(null);
    state.clearActionError();
  };

  // Uma categoria no filtro conta com todas as de dentro
  const descendants = (rootId: string) => {
    const ids = new Set([rootId]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const category of state.itemCategories)
        if (category.parentId && ids.has(category.parentId) && !ids.has(category.id)) {
          ids.add(category.id);
          grew = true;
        }
    }
    return ids;
  };
  const inFilter = categoryFilter && categoryFilter !== UNCATEGORIZED ? descendants(categoryFilter) : null;
  const term = q.trim().toLowerCase();
  const products = (state.products ?? [])
    .filter((product) => !term || `${product.name} ${product.brand ?? ''}`.toLowerCase().includes(term))
    .filter((product) =>
      categoryFilter === UNCATEGORIZED ? !product.categoryId : !inFilter || (product.categoryId !== null && inFilter.has(product.categoryId)),
    )
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  // A tabela às páginas de 10 linhas
  const productsPage = usePagedList(products, 10);
  const uncategorized = (state.products ?? []).filter((product) => !product.categoryId).length;
  const categoryChoices = treeOptions(state.itemCategories, t('expenses.noCategory'));

  // Os itens diretamente em cada categoria
  const productCount = new Map<string, number>();
  for (const product of state.products ?? [])
    if (product.categoryId) productCount.set(product.categoryId, (productCount.get(product.categoryId) ?? 0) + 1);

  // A árvore das categorias dos itens ou das despesas: clicar edita, o + cria uma dentro
  const renderTree = (kind: 'itemCategory' | 'category', parentId: string | null, depth: number): React.ReactNode =>
    (kind === 'itemCategory' ? state.itemCategories : state.categories)
      .filter((category) => category.parentId === parentId)
      .map((category) => (
        <div key={category.id} className="Item_Tree_Node">
          <div className={`Item_Tree_Row ${category.isActive ? '' : 'Inactive'}`} style={{ paddingLeft: depth * 18 }}>
            <button type="button" className="Expense_Category_Name" onClick={() => setEditing({ kind, category })}>
              {category.name}
            </button>
            {kind === 'itemCategory' && productCount.get(category.id) ? (
              <span className="Earnings_Sub">{t('expenses.itemsCount', { count: productCount.get(category.id) })}</span>
            ) : null}
            <button
              type="button"
              className="Icon_Button Tiny"
              title={t('expenses.addInside', { name: category.name })}
              aria-label={t('expenses.addInside', { name: category.name })}
              onClick={() => setEditing({ kind, category: null, parentId: category.id })}
            >
              <Icon.Plus />
            </button>
          </div>
          {renderTree(kind, category.id, depth + 1)}
        </div>
      ));

  return (
    <div className="Earnings">
      <div className="Tabs Items_Tabs">
        {TABS.map((option) => (
          <button key={option} type="button" className={tab === option ? 'Active' : ''} aria-pressed={tab === option} onClick={() => setTab(option)}>
            {t(`expenses.itemsTab_${option}`)}
          </button>
        ))}
      </div>

      {state.error && <span className="Earnings_Message Bad">{state.error}</span>}

      {tab === 'items' && (
        <>
          <div className="Card Earnings_Filter_Card">
            <div className="Earnings_Filters">
              <div className="Earnings_Filter Wide">
                <label className="Eyebrow" htmlFor="items-q">{t('expenses.search')}</label>
                <Global_Input id="items-q" value={q} onChange={(e) => setQ(e.target.value)} icon={Icon.Search} />
              </div>
              <div className="Earnings_Filter Wide">
                <label className="Eyebrow" htmlFor="items-category">{t('expenses.itemCategory')}</label>
                <Global_Dropdown
                  id="items-category"
                  value={categoryFilter}
                  onChange={(value) => setCategoryFilter(String(value))}
                  options={[
                    { value: '', label: t('earnings.all') },
                    { value: UNCATEGORIZED, label: t('expenses.noCategory') },
                    ...categoryChoices.slice(1),
                  ]}
                />
              </div>
            </div>
          </div>

          <div className="Card Earnings_Card">
            <div className="Card_Header">
              <div className="Card_Header_Text">
                <span className="Card_Title">{t('expenses.itemsListTitle')}</span>
                <span className="Card_Subtitle">
                  {uncategorized > 0 ? t('expenses.itemsUncategorized', { count: uncategorized }) : t('expenses.itemsListSubtitle')}
                </span>
              </div>
              <div className="Earnings_Controls">
                <Simple_Button text={t('expenses.itemAddTitle')} onClick={() => setEditing({ kind: 'product', product: null })} />
              </div>
            </div>

            <div className="Earnings_Body">
              {!state.products ? (
                <span className="Earnings_Message">{t('common.loading')}</span>
              ) : products.length === 0 ? (
                <div className="Empty_State">
                  <span className="Empty_State_Title">{t(state.products.length === 0 ? 'expenses.itemsEmpty' : 'expenses.noMatch')}</span>
                  {state.products.length === 0 && <span className="Empty_State_Text">{t('expenses.itemsEmptyHint')}</span>}
                </div>
              ) : (
                <>
                  <div className="Table_Wrap">
                    <table className="Table">
                      <thead>
                        <tr>
                          <th>{t('expenses.product')}</th>
                          <th>{t('expenses.itemCategory')}</th>
                          <th className="Right">{t('expenses.purchases')}</th>
                          <th className="Right">{t('expenses.lastPrice')}</th>
                          <th className="Right">{t('expenses.spent')}</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {productsPage.pageItems.map((product) => (
                          <tr key={product.id}>
                            <td>
                              <span className="Earnings_Strong">{product.name}</span>
                              {(product.brand || product.unit) && (
                                <div className="Earnings_Sub">{[product.brand, product.unit && t(`expenses.unitsShort.${product.unit}`, { defaultValue: product.unit })]
                                  .filter(Boolean)
                                  .join(' · ')}</div>
                              )}
                            </td>
                            <td className="Item_Category_Cell">
                              <Global_Dropdown
                                id={`item-category-${product.id}`}
                                value={product.categoryId ?? ''}
                                onChange={(value) => void state.saveProduct(product.id, { categoryId: String(value) || null })}
                                options={treeOptions(state.itemCategories, t('expenses.noCategory'), product.categoryId)}
                              />
                            </td>
                            <td className="Right Num">
                              {product.count}
                              {product.count > 0 && <div className="Earnings_Sub">{t('expenses.quantityShort', { quantity: product.quantity })}</div>}
                            </td>
                            <td className="Right Num">
                              {product.lastPrice !== null ? formatIn(product.lastPrice, code) : '—'}
                              {product.lastDate && <div className="Earnings_Sub">{formatDay(product.lastDate, locale)}</div>}
                            </td>
                            <td className="Right Num">{formatIn(product.total, code)}</td>
                            <td>
                              <div className="Row_Actions">
                                <button
                                  type="button"
                                  className="Icon_Button Tiny"
                                  title={t('common.edit')}
                                  aria-label={t('common.edit')}
                                  onClick={() => setEditing({ kind: 'product', product })}
                                >
                                  <Icon.Edit />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Global_Pagination
                    page={productsPage.page}
                    totalPages={productsPage.totalPages}
                    onPageChange={productsPage.setPage}
                    totalItems={productsPage.total}
                    pageSize={productsPage.pageSize}
                  />
                </>
              )}
              {state.actionError && !editing && <span className="Field_Hint Earnings_Error">{state.actionError}</span>}
            </div>
          </div>
        </>
      )}

      {tab === 'subscriptions' && <Subscriptions_Tab />}

      {tab === 'itemCategories' && (
        <div className="Card Earnings_Card">
          <div className="Card_Header">
            <div className="Card_Header_Text">
              <span className="Card_Title">{t('expenses.itemsTab_itemCategories')}</span>
              <span className="Card_Subtitle">{t('expenses.itemCategoriesSubtitle')}</span>
            </div>
            <div className="Earnings_Controls">
              <Simple_Button text={t('expenses.categoryAddTitle')} onClick={() => setEditing({ kind: 'itemCategory', category: null })} />
            </div>
          </div>
          <div className="Earnings_Body Item_Tree">{renderTree('itemCategory', null, 0)}</div>
        </div>
      )}

      {tab === 'categories' && (
        <div className="Card Earnings_Card">
          <div className="Card_Header">
            <div className="Card_Header_Text">
              <span className="Card_Title">{t('expenses.itemsTab_categories')}</span>
              <span className="Card_Subtitle">
                {defaultsAdded === null
                  ? t('expenses.categoriesSubtitle')
                  : defaultsAdded > 0
                    ? t('expenses.categoriesAdded', { count: defaultsAdded })
                    : t('expenses.categoriesNoneMissing')}
              </span>
            </div>
            <div className="Earnings_Controls">
              <Simple_Button
                text={t('expenses.categoriesAddDefaults')}
                variant="Ghost"
                disabled={state.saving}
                onClick={async () => setDefaultsAdded(await state.addDefaultCategories())}
              />
              <Simple_Button text={t('expenses.categoryAddTitle')} onClick={() => setEditing({ kind: 'category', category: null })} />
            </div>
          </div>
          <div className="Earnings_Body Item_Tree">
            {renderTree('category', null, 0)}
            {state.actionError && !editing && <span className="Field_Hint Earnings_Error">{state.actionError}</span>}
          </div>
        </div>
      )}

      {editing?.kind === 'product' && (
        <Product_Popover
          product={editing.product}
          itemCategories={state.itemCategories}
          saving={state.saving}
          error={state.actionError}
          onClose={close}
          onSave={async (body) => {
            if (await state.saveProduct(editing.product?.id ?? null, body)) close();
          }}
        />
      )}

      {editing?.kind === 'itemCategory' && (
        <Category_Popover
          category={editing.category}
          parents={treeOptions(state.itemCategories, '', editing.category?.parentId, editing.category?.id).slice(1)}
          movable
          defaultParentId={editing.parentId}
          saving={state.saving}
          error={state.actionError}
          onClose={close}
          onSave={async (body) => {
            if (await state.saveItemCategory(editing.category?.id ?? null, body)) close();
          }}
        />
      )}

      {editing?.kind === 'category' && (
        <Category_Popover
          category={editing.category}
          parents={treeOptions(state.categories, '', editing.category?.parentId, editing.category?.id).slice(1)}
          movable
          defaultParentId={editing.parentId}
          saving={state.saving}
          error={state.actionError}
          onClose={close}
          onSave={async (body) => {
            if (await state.saveCategory(editing.category?.id ?? null, body)) close();
          }}
        />
      )}
    </div>
  );
};

export default Expenses_Items;
