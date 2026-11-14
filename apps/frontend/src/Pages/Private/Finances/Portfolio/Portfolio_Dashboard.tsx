import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useCurrency } from '../../../../Contexts/Currency_Context';
import { useCurrencyFormat } from '../../../../Hooks/useCurrencyFormat';
import { usePortfolioSummary } from '../../../../Hooks/Finances/usePersonalPortfolio';
import Portfolio_Chart, { type Portfolio_Chart_Series } from './Portfolio_Chart';
import './Portfolio.scss';

// As cores dos portefólios, por ordem; a partir do 5.º repetem
const LINE_TOKENS = [1, 2, 3, 4, 5].map((n) => `portfolio-chart-line-${n}`);

/** O resumo dos portefólios: por agora, o valor de cada um no tempo, esticado até ao fundo. */
const Portfolio_Dashboard = () => {
  const { t, i18n } = useTranslation();
  const { currencies, selectedCurrency } = useCurrency();
  const { formatIn } = useCurrencyFormat();
  const currencyId = currencies.find((currency) => currency.shortCode === selectedCurrency)?.id ?? '';
  const { data, error } = usePortfolioSummary(currencyId);

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

  const points = data?.points ?? [];
  const days = points.map((point) => point.date);
  // Só os portefólios com transações; com mais de um, o total por cima a tracejado
  const series = useMemo<Portfolio_Chart_Series[]>(() => {
    if (!data) return [];
    const used = data.portfolios.filter((p) => data.points.some((point) => point.values[p.id]));
    const lines = used.map((p, position) => ({
      id: p.id,
      name: p.name,
      values: data.points.map((point) => point.values[p.id] ?? 0),
      colorToken: LINE_TOKENS[position % LINE_TOKENS.length],
    }));
    if (lines.length > 1)
      lines.push({
        id: 'total',
        name: t('portfolio.total'),
        values: data.points.map((point) => point.total),
        colorToken: 'portfolio-chart-total',
        dashed: true,
      } as Portfolio_Chart_Series);
    return lines;
  }, [data, t]);
  const now = points[points.length - 1]?.total ?? 0;

  return (
    <div className="Portfolio_Dashboard">
      {error && <div className="Empty_State"><span className="Empty_State_Text">{t('portfolio.loadError')}</span></div>}

      {data && !points.length && (
        <div className="Empty_State">
          <span className="Empty_State_Title">{t('portfolio.emptyTitle')}</span>
          <span className="Empty_State_Text">{t('portfolio.emptyText')}</span>
        </div>
      )}

      {points.length > 0 && (
        <section className="Card Portfolio_Chart_Card">
          <div className="Card_Header">
            <div className="Portfolio_Chart_Head">
              <span className="Card_Title">{t('portfolio.chartTitle')}</span>
              <span className="Portfolio_Chart_Sub">
                {t('portfolio.chartIn', { currency: code })}
                {data?.estimatedRates ? t('finances.ratesEstimated', { count: data.estimatedRates }) : ''}
              </span>
            </div>
            <div className="Portfolio_Chart_Now">
              <span className="Portfolio_Chart_Now_Label">{t('portfolio.valueNow')}</span>
              <span className="Portfolio_Chart_Now_Value Num">{format(now)}</span>
            </div>
          </div>
          <div className="Portfolio_Chart_Body">
            <Portfolio_Chart
              days={days}
              series={series}
              format={format}
              compact={compact}
              dateLabel={(ms) => day.format(new Date(ms))}
              axisLabel={(ms) => shortDay.format(new Date(ms))}
            />
          </div>
        </section>
      )}
    </div>
  );
};

export default Portfolio_Dashboard;
