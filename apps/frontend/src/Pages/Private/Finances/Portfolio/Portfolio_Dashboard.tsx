import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCurrency } from '../../../../Contexts/Currency_Context';
import { useCurrencyFormat } from '../../../../Hooks/useCurrencyFormat';
import {
  SUMMARY_RANGES,
  usePortfolioSummary,
  type Summary_Range,
} from '../../../../Hooks/Finances/usePersonalPortfolio';
import Portfolio_Chart, { type Portfolio_Chart_Series } from './Portfolio_Chart';
import Platform_Badge from './Platform_Badge';
import Portfolio_Carousel from './Portfolio_Carousel';
import Portfolio_Allocation from './Portfolio_Allocation';
import './Portfolio.scss';

// O período escolhido fica no browser
const RANGE_KEY = 'intristock-portfolio-range';
const readRange = (): Summary_Range => {
  try {
    const saved = localStorage.getItem(RANGE_KEY);
    return SUMMARY_RANGES.includes(saved as Summary_Range) ? (saved as Summary_Range) : 'all';
  } catch {
    return 'all';
  }
};

// As cores dos portefólios, por ordem; a partir do 5.º repetem
const LINE_TOKENS = [1, 2, 3, 4, 5].map((n) => `portfolio-chart-line-${n}`);

/** O resumo dos portefólios: por agora, o valor de cada um no tempo, esticado até ao fundo. */
const Portfolio_Dashboard = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { currencies, selectedCurrency } = useCurrency();
  const { formatIn } = useCurrencyFormat();
  const currencyId = currencies.find((currency) => currency.shortCode === selectedCurrency)?.id ?? '';
  const [range, setRange] = useState<Summary_Range>(readRange);
  const chooseRange = (next: Summary_Range) => {
    setRange(next);
    try {
      localStorage.setItem(RANGE_KEY, next);
    } catch {
      // Sem armazenamento, só para esta visita
    }
  };
  const { data, error } = usePortfolioSummary(currencyId, range);
  const loading = !data && !error;
  // Ao mudar de período, o que se vê continua até chegar o novo (sem piscar a página toda)
  const changing = Boolean(data && data.range !== range);

  const code = data?.currency?.shortCode ?? selectedCurrency;
  const format = (value: number) => formatIn(value, code);
  const compact = (value: number) =>
    new Intl.NumberFormat(i18n.language, { notation: 'compact', maximumFractionDigits: 1 }).format(value);
  const day = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }),
    [i18n.language],
  );
  const shortDay = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short', timeZone: 'UTC' }),
    [i18n.language],
  );
  // Nos períodos curtos (hora a hora), a hora local
  const dayHour = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
    [i18n.language],
  );
  const shortHour = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { hour: '2-digit', minute: '2-digit' }),
    [i18n.language],
  );
  const hourly = data?.granularity === 'hour';

  const points = data?.points ?? [];
  const days = points.map((point) => point.date);
  // Por agora uma linha só: o valor de todos os portefólios juntos
  const series = useMemo<Portfolio_Chart_Series[]>(
    () =>
      data
        ? [
            {
              id: 'total',
              name: t('portfolio.total'),
              values: data.points.map((point) => point.total),
              colorToken: LINE_TOKENS[0],
            },
          ]
        : [],
    [data, t],
  );
  const now = points[points.length - 1]?.total ?? 0;
  const last = points[points.length - 1];

  return (
    <div className="Portfolio_Dashboard">
      {/* Enquanto carrega, os cartões já no sítio, a piscar */}
      {loading && (
        <div className="Portfolio_Tiles" aria-busy="true">
          <div className="Card Portfolio_Tile Portfolio_Tile_Total">
            <span className="Portfolio_Tile_Name">{t('portfolio.total')}</span>
            <span className="Portfolio_Pulse Portfolio_Pulse_Value" />
            <span className="Portfolio_Pulse Portfolio_Pulse_Meta" />
          </div>
          <div className="Portfolio_Carousel">
            <div className="Portfolio_Carousel_Track">
              {[0, 1, 2].map((index) => (
                <div key={index} className="Card Portfolio_Tile">
                  <span className="Portfolio_Pulse Portfolio_Pulse_Name" />
                  <span className="Portfolio_Pulse Portfolio_Pulse_Value" />
                  <span className="Portfolio_Pulse Portfolio_Pulse_Meta" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* O Total fica parado; os portefólios andam com as setas */}
      {data && data.portfolios.length > 0 && (
        <div className="Portfolio_Tiles">
          <div className="Card Portfolio_Tile Portfolio_Tile_Total">
            <span className="Portfolio_Tile_Name">{t('portfolio.total')}</span>
            <span className="Portfolio_Tile_Value Num">{format(now)}</span>
            <span className="Portfolio_Tile_Meta">
              {t('portfolio.portfolioCount', { count: data.portfolios.length })}
            </span>
          </div>
          <Portfolio_Carousel>
            {data.portfolios.map((portfolio) => (
              <button
                key={portfolio.id}
                type="button"
                className="Card Portfolio_Tile"
                onClick={() => navigate(`/Portefolio/p/${portfolio.id}`)}
              >
                <span className="Portfolio_Tile_Name">
                  <Platform_Badge platform={portfolio.platform} />
                  {portfolio.name}
                </span>
                <span className="Portfolio_Tile_Value Num">{format(last?.values[portfolio.id] ?? 0)}</span>
                <span className="Portfolio_Tile_Meta">
                  {portfolio.source === 'api'
                    ? portfolio.platform?.name ?? t('portfolio.source_api')
                    : t('portfolio.source_manual')}
                </span>
              </button>
            ))}
          </Portfolio_Carousel>
        </div>
      )}

      {/* O cartão do gráfico está sempre: a piscar enquanto os números não chegam,
          com o aviso lá dentro sem transações ou com erro */}
      <section className="Card Portfolio_Chart_Card" aria-busy={loading}>
        <div className="Card_Header">
          <div className="Portfolio_Chart_Head">
            <span className="Card_Title">{t('portfolio.chartTitle')}</span>
            {loading ? (
              <span className="Portfolio_Pulse Portfolio_Pulse_Line" />
            ) : (
              <span className="Portfolio_Chart_Sub">
                {t('portfolio.chartIn', { currency: code })}
                {data?.estimatedRates ? t('finances.ratesEstimated', { count: data.estimatedRates }) : ''}
              </span>
            )}
          </div>
          {(loading || points.length > 0) && (
            <div className="Portfolio_Chart_Now">
              <span className="Portfolio_Chart_Now_Label">{t('portfolio.valueNow')}</span>
              {loading ? (
                <span className="Portfolio_Pulse Portfolio_Pulse_Value" />
              ) : (
                <span className="Portfolio_Chart_Now_Value Num">{format(now)}</span>
              )}
            </div>
          )}
        </div>
        <div className="Portfolio_Ranges">
          <div className="Tabs" role="tablist" aria-label={t('portfolio.rangeLabel')}>
            {SUMMARY_RANGES.map((option) => (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={range === option}
                className={range === option ? 'Active' : ''}
                onClick={() => chooseRange(option)}
              >
                {t(`portfolio.range_${option}`)}
              </button>
            ))}
          </div>
        </div>
        <div className={`Portfolio_Chart_Body${changing ? ' Portfolio_Changing' : ''}`}>
          {loading ? (
            <div className="Portfolio_Pulse Portfolio_Pulse_Chart" />
          ) : error ? (
            <div className="Empty_State Portfolio_Chart_Empty">
              <span className="Empty_State_Text">{t('portfolio.loadError')}</span>
            </div>
          ) : !points.length ? (
            <div className="Empty_State Portfolio_Chart_Empty">
              <span className="Empty_State_Title">{t('portfolio.emptyTitle')}</span>
              <span className="Empty_State_Text">{t('portfolio.emptyText')}</span>
            </div>
          ) : (
            <Portfolio_Chart
              days={days}
              series={series}
              format={format}
              compact={compact}
              dateLabel={(ms) => (hourly ? dayHour : day).format(new Date(ms))}
              axisLabel={(ms) => (hourly && range === '24h' ? shortHour : hourly ? dayHour : shortDay).format(new Date(ms))}
            />
          )}
        </div>
      </section>

      {/* O que se tem hoje: por categoria geral e até cada ativo */}
      <Portfolio_Allocation currencyId={currencyId} format={(value, currency) => formatIn(value, currency ?? code)} />
    </div>
  );
};

export default Portfolio_Dashboard;
