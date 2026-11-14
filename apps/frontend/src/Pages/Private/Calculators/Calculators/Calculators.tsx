import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCalculators } from '../../../../Hooks/Calculators/useCalculators';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import * as Icon from '../../../../Imports/icons';
import './Calculators.scss';

interface Calculator {
  id: string;
  name: string;
  abbreviation: string;
  description: string;
  active: boolean;
  simulationsCount: number;
}

// Cada calculadora tem uma página própria, escrita à mão. O catálogo pode ter
// calculadoras que ainda não a têm — essas aparecem na lista, mas não abrem
const CALCULATOR_PAGES: Record<string, { path: string; titleKey: string; descriptionKey: string }> = {
  'compound-interest': {
    path: '/Calculators/compound-interest',
    titleKey: 'compoundInterest.title',
    descriptionKey: 'compoundInterest.description',
  },
};

const Calculators = () => {
  const { calculators, loading } = useCalculators();
  const [search, setSearch] = useState('');

  const navigate = useNavigate();
  const { t } = useTranslation();

  const getCalculatorName = (calculator: Calculator) => {
    const translation = CALCULATOR_PAGES[calculator.abbreviation];
    return translation ? t(translation.titleKey) : calculator.name;
  };

  const getCalculatorDescription = (calculator: Calculator) => {
    const translation = CALCULATOR_PAGES[calculator.abbreviation];
    return translation ? t(translation.descriptionKey) : calculator.description;
  };

  const filteredCalculators = calculators.filter((calculator) =>
    getCalculatorName(calculator).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="Calculators">
      {/* O mesmo cabeçalho das outras páginas, com a pesquisa nas ações */}
      <div className="Page_Head">
        <div>
          <h1>{t('menu.calculators')}</h1>
          {/* A linha existe sempre, mesmo a carregar: com um espaço fixo, o
              cabeçalho não muda de altura quando a contagem aparece */}
          <div className="Page_Head_Sub">
            {loading ? ' ' : t('calculators.count', { count: filteredCalculators.length })}
          </div>
        </div>

        <div className="Page_Head_Actions Calculators_Search">
          <Global_Input
            id="calculators-search"
            placeholder={t('calculators.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={Icon.Search}
          />
        </div>
      </div>

      {loading ? (
        <span className="Calculators_Message">{t('common.loading')}</span>
      ) : filteredCalculators.length === 0 ? (
        <span className="Calculators_Message">
          {search ? t('calculators.noMatches', { search }) : t('common.noResults')}
        </span>
      ) : (
        <div className="Calculators_Grid">
          {filteredCalculators.map((calculator) => {
            const page = CALCULATOR_PAGES[calculator.abbreviation];

            return (
              <button
                key={calculator.id}
                type="button"
                className={`Calculator_Card${page ? '' : ' Calculator_Card_Unavailable'}`}
                disabled={!page}
                onClick={page ? () => navigate(page.path) : undefined}
              >
                <span className="Calculator_Name">{getCalculatorName(calculator)}</span>
                <span className="Calculator_Description">
                  {getCalculatorDescription(calculator)}
                </span>
                {/* Mesma linha nos dois casos, para o cartão não mudar de altura */}
                <span className="Calculator_Simulations_Count Num">
                  {page
                    ? t('calculators.simulationsCount', { count: calculator.simulationsCount })
                    : t('calculators.noPageAvailable')}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Calculators;
