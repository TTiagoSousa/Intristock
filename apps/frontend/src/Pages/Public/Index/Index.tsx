import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import Header_Index from '../../../Containers/Header/Header_Index/Header_Index';
import Month_Chart from '../../../Components/Charts/Month_Chart/Month_Chart';
import { useAuth } from '../../../Contexts/Auth_Context';
import './Index.scss';

// Dados de exemplo da pré-visualização (a página diz que são de exemplo): um ano
// de ganhos e despesas de uma pessoa, com o subsídio em junho e em dezembro
const MONTHS = ['dez', 'jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov'];
const RECEIVED = [3980, 2140, 2140, 2265, 2140, 2190, 4280, 2140, 2140, 2310, 2140, 2205];
const SPENT = [2610, 1730, 1655, 1890, 1712, 1804, 2390, 2045, 1968, 1720, 1810, 1640];

const euro = (value: number) =>
  `${value.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const compact = (value: number) => `${Math.round(value / 100) / 10}k`;

const Index = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { authenticated, isLoading } = useAuth();

  return (
    <div className="Index">
      <Header_Index />

      <section className="Index_Hero">
        <div className="Index_Hero_Text">
          <h1>{t('landing.headline')}</h1>
          <p className="Index_Lead">{t('landing.subtitle')}</p>

          <div className="Index_Actions">
            {!isLoading &&
              (authenticated ? (
                <button className="Index_Button Primary" onClick={() => navigate('/Dashboard')}>
                  {t('landing.backToDashboard')}
                </button>
              ) : (
                // Sem registo público: as contas são criadas pelo admin
                <button className="Index_Button Primary" onClick={() => navigate('/Auth')}>
                  {t('landing.login')}
                </button>
              ))}
          </div>
        </div>

        {/* O produto como ele é: a visão geral das finanças, com os cartões e o gráfico do mês */}
        <figure className="Index_Window" aria-label={t('landing.previewLabel')}>
          <div className="Index_Window_Bar">
            <span className="Index_Window_Crumb">{t('landing.previewCrumb')}</span>
            <span className="Index_Window_Note">{t('landing.previewNote')}</span>
          </div>

          <div className="Index_Window_Body">
            <div className="Index_Window_Tiles">
              <div className="Card Tile Wave_Tile Up">
                <span className="Eyebrow">{t('landing.tileIncome')}</span>
                <span className="Tile_Value">2 205,00 €</span>
                <div className="Tile_Foot">{t('landing.tileIncomeFoot')}</div>
              </div>
              <div className="Card Tile Wave_Tile Down">
                <span className="Eyebrow">{t('landing.tileSpent')}</span>
                <span className="Tile_Value">1 640,00 €</span>
                <div className="Tile_Foot">{t('landing.tileSpentFoot')}</div>
              </div>
              <div className="Card Tile Wave_Tile Accent">
                <span className="Eyebrow">{t('landing.tileDebt')}</span>
                <span className="Tile_Value">96 410,00 €</span>
                <div className="Tile_Foot">{t('landing.tileDebtFoot')}</div>
              </div>
            </div>

            <div className="Card Index_Window_Chart">
              <div className="Index_Window_Chart_Head">
                <span className="Index_Window_Chart_Title">{t('landing.chartTitle')}</span>
              </div>
              <div className="Index_Window_Chart_Plot">
                <Month_Chart
                  kind="bars"
                  categories={MONTHS}
                  labels={MONTHS}
                  series={[
                    { id: 'received', name: t('landing.chartReceived'), values: RECEIVED, colorToken: '--gain' },
                    { id: 'spent', name: t('landing.chartSpent'), values: SPENT, colorToken: '--loss' },
                  ]}
                  todayIndex={11}
                  todayLabel={t('landing.chartToday')}
                  format={euro}
                  compact={compact}
                />
              </div>
            </div>
          </div>
        </figure>
      </section>

      <footer className="Index_Footer">
        <span>IntriStock</span>
        <span>{t('landing.footer')}</span>
      </footer>
    </div>
  );
};

export default Index;
