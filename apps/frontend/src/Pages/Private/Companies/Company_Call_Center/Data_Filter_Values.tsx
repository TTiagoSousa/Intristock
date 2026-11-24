import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDataColumnValues, type Data_Row_Filter, type Data_View_Filter } from '../../../../Hooks/Companies/useCompanyData';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import { localeOf } from '../../../../utils/locale';

// O backend aceita até 50 valores num filtro (`MAX_FILTER_VALUES`)
export const MAX_FILTER_VALUES = 50;

/** De onde vêm os valores: a tabela ou a tabela unida, com a pesquisa (e o filtro da unida) da página. */
export interface Values_Source {
  companyId: string;
  source: string;
  search: string;
  only?: Data_View_Filter;
}

const sameText = (a: string, b: string) => a.trim().toLocaleLowerCase('pt-PT') === b.trim().toLocaleLowerCase('pt-PT');

/**
 * A lista dos valores de uma coluna, como no Excel: cada um com quantas linhas o têm (nas
 * linhas da pesquisa e dos outros filtros), para escolher um ou vários.
 */
const Data_Filter_Values = ({
  values,
  column,
  filters,
  selected,
  onChange,
}: {
  values: Values_Source;
  column: string;
  filters: Data_Row_Filter[];
  selected: string[];
  onChange: (next: string[]) => void;
}) => {
  const { t, i18n } = useTranslation();
  const locale = localeOf(i18n.language);
  const [text, setText] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => setQ(text), 250);
    return () => window.clearTimeout(timer);
  }, [text]);

  const { data, error } = useDataColumnValues(values.companyId, values.source, {
    column,
    q,
    search: values.search,
    only: values.only,
    filters,
  });
  // As de outra coluna não servem (o pedido de antes fica à vista só para a mesma)
  const list = data && data.column === column ? data.values : [];
  const isPicked = (value: string) => selected.some((s) => sameText(s, value));
  const full = selected.length >= MAX_FILTER_VALUES;

  const toggle = (value: string) =>
    onChange(isPicked(value) ? selected.filter((s) => !sameText(s, value)) : [...selected, value]);

  const pickAll = () => {
    const next = [...selected];
    for (const item of list) if (next.length < MAX_FILTER_VALUES && !next.some((s) => sameText(s, item.value))) next.push(item.value);
    onChange(next);
  };

  return (
    <div className="Call_Center_Values">
      <Global_Input
        id="data-filter-values-search"
        value={text}
        maxLength={120}
        autoComplete="off"
        placeholder={t('callCenter.filterValuesSearch')}
        onChange={(event) => setText(event.target.value)}
      />
      <div className="Call_Center_Values_Head">
        <span>{t('callCenter.filterValuesPicked', { count: selected.length })}</span>
        <span className="Call_Center_Values_Actions">
          <button type="button" className="Call_Center_Text_Button" disabled={!list.length || full} onClick={pickAll}>
            {t('callCenter.filterValuesAll')}
          </button>
          <button type="button" className="Call_Center_Text_Button" disabled={!selected.length} onClick={() => onChange([])}>
            {t('callCenter.filterValuesNone')}
          </button>
        </span>
      </div>
      <div className="Call_Center_Values_List" role="group" aria-label={t('callCenter.filterValues')}>
        {list.map((item) => {
          const picked = isPicked(item.value);
          return (
            <label key={item.value.toLocaleLowerCase('pt-PT')} className="Call_Center_Check Call_Center_Value">
              <input type="checkbox" checked={picked} disabled={!picked && full} onChange={() => toggle(item.value)} />
              <span className={`Call_Center_Value_Text${item.value ? '' : ' Muted'}`}>{item.value || t('callCenter.filterValuesEmpty')}</span>
              <span className="Call_Center_Value_Count">{item.count.toLocaleString(locale)}</span>
            </label>
          );
        })}
        {data && data.column === column && !list.length && <p className="Call_Center_Values_Note">{t('callCenter.filterValuesNoMatch')}</p>}
        {error && <p className="Call_Center_Values_Note">{error}</p>}
      </div>
      {data?.truncated && <p className="Call_Center_Values_Note">{t('callCenter.filterValuesTruncated', { count: list.length })}</p>}
      {full && <p className="Call_Center_Values_Note">{t('callCenter.filterValuesMax', { count: MAX_FILTER_VALUES })}</p>}
    </div>
  );
};

export default Data_Filter_Values;
