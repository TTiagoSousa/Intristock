import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { createPieChart } from 'openchartscandle/pie';
import type { PieTheme } from 'openchartscandle/pie';
import { createSankeyChart } from 'openchartscandle/sankey';
import type { SankeyLink, SankeyNode, SankeyTheme } from 'openchartscandle/sankey';
import 'openchartscandle/style.css';
import { useTheme } from '../../../../Contexts/ThemeContext';
import { resolveColor } from '../../../../Components/Charts/resolveColor';
import { usePortfolioAllocation, type Portfolio_Allocation_Data } from '../../../../Hooks/Finances/usePersonalPortfolio';

interface Chart_Props {
  data: Portfolio_Allocation_Data;
  format: (value: number) => string;
  label: (key: string) => string;
}

// As cores e o texto dos gráficos, dos tokens (lidos na frame seguinte: o data-theme muda depois)
const lookOf = (element: HTMLElement) => {
  const token = (name: string) => resolveColor(element, `var(--${name})`);
  return {
    token,
    base: {
      background: 'transparent',
      text: token('month-chart-text'),
      muted: token('month-chart-muted'),
      tooltipBg: token('month-chart-tooltip-background'),
      tooltipText: token('month-chart-tooltip-text'),
      tooltipBorder: token('month-chart-tooltip-border'),
      font: getComputedStyle(document.body).fontFamily,
    },
  };
};

/** A percentagem de cada categoria geral, num donut com o total ao centro. */
const Allocation_Pie = ({ data, format, label }: Chart_Props) => {
  const { theme } = useTheme();
  const ref = useRef<HTMLDivElement>(null);
  const latest = useRef({ format, label });
  useEffect(() => {
    latest.current = { format, label };
  });
  const dataKey = JSON.stringify(data.categories.map((category) => [category.key, category.value]));

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let chart: ReturnType<typeof createPieChart> | null = null;
    const frame = requestAnimationFrame(() => {
      const { token, base } = lookOf(element);
      const look: Partial<PieTheme> = { ...base, line: token('month-chart-axis'), sliceBorder: 'transparent' };
      chart = createPieChart(element, {
        data: data.categories.map((category) => ({
          id: category.key,
          label: latest.current.label(category.key),
          value: category.value,
          color: token(`portfolio-allocation-${category.key}`),
        })),
        theme: look,
        innerRadius: 0.62,
        padAngle: 1.2,
        cornerRadius: 3,
        hoverOffset: 4,
        selectable: false,
        labels: { show: false },
        legend: { show: true, position: 'right', values: true, marker: 'circle', fontSize: 12 },
        center: { show: true, title: latest.current.label('total') },
        valueFormatter: (value) => latest.current.format(value),
        animation: { duration: 450 },
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      chart?.destroy();
    };
    // O gráfico refaz-se com os dados e o tema
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey, theme]);

  return <div className="Portfolio_Allocation_Chart" ref={ref} />;
};

/** Do total às categorias gerais e delas aos ativos, com a largura de cada fluxo pelo valor. */
const Allocation_Sankey = ({ data, format, label }: Chart_Props) => {
  const { theme } = useTheme();
  const ref = useRef<HTMLDivElement>(null);
  const latest = useRef({ format, label });
  useEffect(() => {
    latest.current = { format, label };
  });
  const dataKey = JSON.stringify(data.categories);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let chart: ReturnType<typeof createSankeyChart> | null = null;
    const frame = requestAnimationFrame(() => {
      const { token, base } = lookOf(element);
      const look: Partial<SankeyTheme> = { ...base, nodeBorder: 'transparent' };
      const total = latest.current.label('total');
      // Os nomes são a chave dos nós: um ativo com o nome de uma categoria leva o ticker
      const taken = new Set<string>([total]);
      const unique = (name: string, ticker: string | null) => {
        let result = taken.has(name) && ticker ? `${name} (${ticker})` : name;
        while (taken.has(result)) result += ' ';
        taken.add(result);
        return result;
      };
      const nodes: SankeyNode[] = [{ name: total, itemStyle: { color: token('portfolio-allocation-total') } }];
      const links: SankeyLink[] = [];
      for (const category of data.categories) {
        const color = token(`portfolio-allocation-${category.key}`);
        const name = unique(latest.current.label(category.key), null);
        nodes.push({ name, itemStyle: { color } });
        links.push({ source: total, target: name, value: category.value });
        for (const asset of category.assets) {
          const assetName = unique(asset.name, asset.ticker);
          nodes.push({ name: assetName, itemStyle: { color, opacity: 0.75 } });
          links.push({ source: name, target: assetName, value: asset.value });
        }
      }
      chart = createSankeyChart(element, {
        nodes,
        links,
        theme: look,
        nodeWidth: 12,
        nodeGap: 10,
        draggable: false,
        emphasis: 'trajectory',
        lineStyle: { color: 'target', opacity: 0.28, curveness: 0.5 },
        itemStyle: { borderRadius: 2 },
        label: { fontSize: 12 },
        valueFormat: (value) => latest.current.format(value),
        animation: { duration: 450 },
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      chart?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey, theme]);

  return <div className="Portfolio_Allocation_Chart" ref={ref} />;
};

/**
 * A distribuição de hoje, por baixo do gráfico do resumo: dois cartões lado a lado, a
 * percentagem por categoria geral (donut) e o caminho do total às categorias e aos ativos (Sankey).
 */
const Portfolio_Allocation = ({
  currencyId,
  format,
}: {
  currencyId: string;
  format: (value: number, code?: string) => string;
}) => {
  const { t } = useTranslation();
  const { data, error } = usePortfolioAllocation(currencyId);
  const loading = !data && !error;
  const code = data?.currency?.shortCode;
  const money = (value: number) => format(value, code);
  const label = (key: string) => (key === 'total' ? t('portfolio.total') : t(`portfolio.allocation_${key}`));

  const body = (chart: 'pie' | 'sankey') =>
    loading ? (
      <div className="Portfolio_Pulse Portfolio_Pulse_Chart" />
    ) : error ? (
      <div className="Empty_State Portfolio_Chart_Empty">
        <span className="Empty_State_Text">{t('portfolio.loadError')}</span>
      </div>
    ) : !data || data.total <= 0 ? (
      <div className="Empty_State Portfolio_Chart_Empty">
        <span className="Empty_State_Text">{t('portfolio.allocationEmpty')}</span>
      </div>
    ) : chart === 'pie' ? (
      <Allocation_Pie data={data} format={money} label={label} />
    ) : (
      <Allocation_Sankey data={data} format={money} label={label} />
    );

  const subtitle = data
    ? t('portfolio.allocationIn', { currency: code }) +
      (data.estimatedRates ? t('finances.ratesEstimated', { count: data.estimatedRates }) : '')
    : '';

  return (
    <div className="Portfolio_Allocation">
      <section className="Card Portfolio_Allocation_Card" aria-busy={loading}>
        <div className="Card_Header">
          <div className="Card_Header_Text">
            <span className="Card_Title">{t('portfolio.allocationTitle')}</span>
            <span className="Card_Subtitle">{subtitle}</span>
          </div>
        </div>
        <div className="Portfolio_Allocation_Body">{body('pie')}</div>
      </section>
      <section className="Card Portfolio_Allocation_Card" aria-busy={loading}>
        <div className="Card_Header">
          <div className="Card_Header_Text">
            <span className="Card_Title">{t('portfolio.flowTitle')}</span>
            <span className="Card_Subtitle">{t('portfolio.flowSubtitle')}</span>
          </div>
        </div>
        <div className="Portfolio_Allocation_Body">{body('sankey')}</div>
      </section>
    </div>
  );
};

export default Portfolio_Allocation;
