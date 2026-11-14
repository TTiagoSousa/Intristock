import type { Expense_Category } from '../../../../Hooks/Finances/usePersonalExpense';

// O caminho de uma categoria em árvore, de cima para baixo ("Bebidas › Vinhos › Tinto")
export const categoryPath = (categories: Expense_Category[], categoryId: string | null) => {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const names: string[] = [];
  for (let cursor = categoryId ? byId.get(categoryId) : undefined; cursor; cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined)
    names.unshift(cursor.name);
  return names.length > 0 ? names.join(' › ') : null;
};

// As opções de uma árvore: cada categoria com o caminho, as de dentro por baixo
export const treeOptions = (categories: Expense_Category[], noneLabel: string, keepId?: string | null, skipId?: string | null) => {
  const visible = categories.filter((category) => (category.isActive || category.id === keepId) && category.id !== skipId);
  const walk = (parentId: string | null, path: string): { value: string; label: string }[] =>
    visible
      .filter((category) => category.parentId === parentId)
      .flatMap((category) => {
        const label = path ? `${path} › ${category.name}` : category.name;
        return [{ value: category.id, label }, ...walk(category.id, label)];
      });
  return [{ value: '', label: noneLabel }, ...walk(null, '')];
};

// As opções das categorias das despesas, também em árvore ("Lazer › Saídas › Cinema")
export const categoryOptions = (categories: Expense_Category[], noneLabel: string, keepId?: string | null) =>
  treeOptions(categories, noneLabel, keepId);

// "Lazer › Saídas › Cinema", ou só a categoria
export const categoryLabel = categoryPath;

// As unidades que um item pode ter (os nomes em `expenses.units`/`unitsShort`);
// um item antigo com outra escrita mantém-na
export const PRODUCT_UNITS = ['un', 'kg', 'g', 'l', 'cl', 'ml', 'm', 'dozen', 'pack', 'box', 'bottle', 'can', 'bag'] as const;
