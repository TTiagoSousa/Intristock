import { useTranslation } from 'react-i18next';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import { useNavs } from '../../../../Contexts/Navs_Context';
import { useCurrency } from '../../../../Contexts/Currency_Context';
import { useTheme, type ThemePreference } from '../../../../Contexts/ThemeContext';
import './General.scss';

const General = () => {
  const { t, i18n } = useTranslation();
  const { typeOfNavigation, setTypeOfNavigation, isMobileViewport } = useNavs();
  const { currencies, loading: loadingCurrencies, selectedCurrency, setSelectedCurrency } = useCurrency();
  const { preference, setPreference } = useTheme();

  const themeOptions: { value: ThemePreference; label: string }[] = [
    { value: 'system', label: t('settings.themeSystem') },
    { value: 'light', label: t('settings.themeLight') },
    { value: 'dark', label: t('settings.themeDark') },
  ];

  return (
    <div className="General">
      {/* Uma linha por definição: nome e explicação à esquerda, controlo à
          direita, num cartão só com o cabeçalho "Geral" */}
      <div className="Card General_Card">
        <div className="Card_Header">
          <div className="Card_Header_Text">
            <span className="Card_Title">{t('settings.generalTitle')}</span>
            <span className="General_Subtitle">{t('settings.subtitle')}</span>
          </div>
        </div>

        <div className="Settings_List">
          <div className="Setting_Row">
            <div className="Setting_Text">
              <span className="Setting_Label">{t('settings.language')}</span>
              <span className="Setting_Hint">{t('settings.languageHint')}</span>
            </div>
            <div className="Setting_Control">
              <Global_Dropdown
                id="language"
                value={i18n.language}
                onChange={(value) => i18n.changeLanguage(value as string)}
                options={[
                  { value: 'pt', label: t('settings.portuguese') },
                  { value: 'en', label: t('settings.english') },
                ]}
              />
            </div>
          </div>

          <div className="Setting_Row">
            <div className="Setting_Text">
              <span className="Setting_Label">{t('settings.currency')}</span>
              <span className="Setting_Hint">{t('settings.currencyHint')}</span>
            </div>
            <div className="Setting_Control">
              <Global_Dropdown
                id="currency"
                value={selectedCurrency}
                onChange={(value) => setSelectedCurrency(value as string)}
                disabled={loadingCurrencies}
                options={currencies.map((currency) => ({
                  value: currency.shortCode,
                  label: `${currency.shortCode} (${currency.symbol})`,
                }))}
              />
            </div>
          </div>

          <div className="Setting_Row">
            <div className="Setting_Text">
              <span className="Setting_Label">{t('settings.theme')}</span>
              <span className="Setting_Hint">{t('settings.themeHint')}</span>
            </div>
            <div className="Setting_Control">
              <div className="Tabs">
                {themeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={preference === option.value ? 'Active' : ''}
                    onClick={() => setPreference(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="Setting_Row">
            <div className="Setting_Text">
              <span className="Setting_Label">{t('settings.navigation')}</span>
              <span className="Setting_Hint">
                {isMobileViewport ? t('settings.navigationLockedHint') : t('settings.navigationHint')}
              </span>
            </div>
            <div className="Setting_Control">
              <Global_Dropdown
                id="navigation"
                value={typeOfNavigation}
                onChange={(value) => setTypeOfNavigation(value as 'Sidebar_Home' | 'Mobile_Menu')}
                disabled={isMobileViewport}
                options={[
                  { value: 'Sidebar_Home', label: t('settings.navigationSidebar') },
                  { value: 'Mobile_Menu', label: t('settings.navigationMobile') },
                ]}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default General;
