import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { createBarChart } from 'openchartscandle/bar';
import type { BarTheme } from 'openchartscandle/bar';
import 'openchartscandle/style.css';
import { useTheme } from '../../../../Contexts/ThemeContext';
import type { Entry_Hour_Profile, Entry_Payload, Schedule_Payload } from '../../../../Hooks/Trading/useSimulation';
import Factsheet_Card from './Factsheet_Card';
import Factsheet_Entry_Name from './Factsheet_Entry_Name';
import Factsheet_Panel from './Factsheet_Panel';
import { entryColor, hourLabel, resolveColor, resolveToken, useFactsheetFormat } from './factsheetFormat';

interface Factsheet_Entry_Hours_Props {
  profile: Entry_Hour_Profile;
  entries: Entry_Payload[];
  unit: string;
}

// A transparência da faixa do horário configurado (por cima das barras)
const BAND_MIX = 14;

// As cores das entradas que se confundem com o laranja dos stops (a 3 e a 6):
// nelas, "fechou a ganhar" vai a azul
const STOP_LIKE_COLORS = [3, 6];

/**
 * 5.6 — Uma entrada por hora de entrada: o nome, o horário dela e os trades,
 * stops, direção e ordem; as barras de cada hora empilhadas pelo fim (fechou a
 * ganhar na cor da entrada, stop a laranja, outra saída a cinzento), com a
 * faixa das horas em que o horário dela deixa entrar; e os 3 cartões. Tudo
 * vem calculado pelo simulador.
 */
const Factsheet_Entry_Hours = ({ profile, entries, unit }: Factsheet_Entry_Hours_Props) => {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const f = useFactsheetFormat(unit);
  const rootRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const entry = entries[profile.rule - 1];

  useEffect(() => {
    const element = chartRef.current;
    const root = rootRef.current;
    if (!element || !root) return;
    let chart: ReturnType<typeof createBarChart> | null = null;
    // Na frame seguinte: o data-theme do <html> muda depois deste efeito
    const frame = requestAnimationFrame(() => {
      const token = (name: string) => resolveToken(root, name);
      const barTheme: Partial<BarTheme> = {
        background: 'transparent',
        text: token('chart-text'),
        muted: token('chart-muted'),
        grid: token('chart-grid'),
        axis: token('chart-axis'),
        hover: token('chart-grid'),
        tooltipBg: token('chart-tooltip-background'),
        tooltipText: token('chart-tooltip-text'),
        tooltipBorder: token('chart-tooltip-border'),
        font: getComputedStyle(document.body).fontFamily,
      };
      const band = resolveColor(root, `color-mix(in srgb, var(--factsheet-entry-band) ${BAND_MIX}%, transparent)`);
      const part = (id: string, name: string, colorToken: string, values: number[]) => ({
        id,
        name,
        color: token(colorToken),
        stack: 'hours',
        data: values.map((value) => (value ? value : null)),
      });

      chart = createBarChart(element, {
        categories: profile.wins.map((_, hour) => hourLabel(hour)),
        series: [
          part(
            'wins',
            t('trading.fsEntryHoursWins'),
            STOP_LIKE_COLORS.includes(entryColor(profile.rule)) ? 'chart-strategy' : `entry-${entryColor(profile.rule)}`,
            profile.wins,
          ),
          part('stops', t('trading.fsEntryHoursStops'), 'exit-stop', profile.stopHours),
          part('others', t('trading.fsEntryHoursOthers'), 'exit-time', profile.others),
        ],
        stacked: true,
        theme: barTheme,
        padding: 4,
        categoryGap: 0.12,
        radius: 2,
        legend: { show: true, position: 'top', align: 'start', marker: 'square', fontSize: 11.5 },
        categoryAxis: { show: true, grid: false, ticks: false },
        valueAxis: { show: false, grid: false, min: 0 },
        tooltip: {
          mode: 'shared',
          total: false,
          formatter: (ctx) => {
            const hour = ctx.categoryIndex;
            const trades = profile.wins[hour] + profile.stopHours[hour] + profile.others[hour];
            return `<strong>${hourLabel(hour)}</strong><br>${t('trading.fsHourCol_trades')}: <strong>${f.number(trades)}</strong><br>${t('trading.fsEntryHoursWins')}: <strong>${f.number(profile.wins[hour])}</strong><br>${t('trading.fsEntryHoursStops')}: <strong>${f.number(profile.stopHours[hour])}</strong><br>${t('trading.fsEntryHoursOthers')}: <strong>${f.number(profile.others[hour])}</strong><br>${t('trading.fsHourCol_pnl')}: <strong>${trades ? f.money(profile.pnl[hour]) : '—'}</strong>`;
          },
        },
        // A faixa a cinzento: as horas em que o horário da entrada deixa entrar
        graphic: (ctx, api) => {
          if (!profile.band) return;
          const step = api.category(1) - api.category(0);
          ctx.save();
          ctx.fillStyle = band;
          for (const hour of profile.band) ctx.fillRect(api.category(hour) - step / 2, api.plot.y, step, api.plot.h);
          ctx.restore();
        },
        animation: { duration: 500 },
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      chart?.destroy();
    };
    // f depende só da língua e da moeda
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, t, i18n.language, unit, theme]);

  // "Seg Ter Qua · 07h – 21h"; no modo "exceto", com a palavra antes
  const schedule = (value: Schedule_Payload | null | undefined) => {
    if (!value || !value.rules.length) return t('trading.fsEntryHoursNoSchedule');
    const rules = value.rules
      .map((rule) => {
        const days = rule.days?.length
          ? [...rule.days].sort((a, b) => a - b).map((day) => t(`trading.weekday_${day}`)).join(' ')
          : t('trading.shEveryDay');
        const hours = rule.from && rule.to ? ` · ${rule.from.slice(0, 2)}h – ${rule.to.slice(0, 2)}h` : '';
        return `${days}${hours}`;
      })
      .join('; ');
    return value.mode === 'except' ? `${t('trading.shScheduleMode_except')} ${rules}` : rules;
  };
  const order = (entry?.price?.kind ?? 'market') === 'market' ? t('trading.fsEntryHoursMarket') : t('trading.fsEntryHoursLevel');

  return (
    <Factsheet_Panel
      title={
        <span className="Factsheet_Entry_Hours_Title">
          <Factsheet_Entry_Name entries={entries} rule={profile.rule} />
          <span className="Factsheet_Entry_Hours_Badge">{schedule(entry?.schedule)}</span>
        </span>
      }
      note={t('trading.fsEntryHoursDetail', {
        trades: f.number(profile.trades),
        stops: f.number(profile.stops),
        side: t(`trading.side_${entry?.side ?? 'long'}`),
        order,
      })}
      panelRef={rootRef}
      explain="hoursEntryProfile"
    >
      <div className="Factsheet_Chart Entry_Hours" ref={chartRef} />
      <div className="Factsheet_Cards Three">
        <Factsheet_Card
          label={t('trading.fsEntryHoursCard_busiest')}
          help={t('trading.fsHelp_entryHoursBusiest')}
          explain="hoursEntryBusiest"
          value={profile.busiest ? hourLabel(profile.busiest.hour) : '—'}
          detail={profile.busiest ? t('trading.fsEntryHoursCard_busiestDetail', { trades: f.number(profile.busiest.trades) }) : t('trading.fsEntryHoursNone')}
        />
        <Factsheet_Card
          label={t('trading.fsEntryHoursCard_best')}
          help={t('trading.fsHelp_entryHoursBest')}
          explain="hoursEntryBest"
          value={profile.best ? hourLabel(profile.best.hour) : '—'}
          tone={profile.best ? f.tone(profile.best.pnl) : ''}
          detail={
            profile.best
              ? t('trading.fsEntryHoursCard_bestDetail', { pnl: f.money(profile.best.pnl), winRate: f.percent(profile.best.winRatePct, 0) })
              : t('trading.fsEntryHoursNone')
          }
        />
        <Factsheet_Card
          label={t('trading.fsEntryHoursCard_stops')}
          help={t('trading.fsHelp_entryHoursStops')}
          explain="hoursEntryStops"
          value={profile.mostStops ? hourLabel(profile.mostStops.hour) : '—'}
          tone={profile.mostStops ? 'Negative' : ''}
          detail={
            profile.mostStops
              ? t('trading.fsEntryHoursCard_stopsDetail', { stops: f.number(profile.mostStops.stops), trades: f.number(profile.mostStops.trades) })
              : t('trading.fsEntryHoursNoStops')
          }
        />
      </div>
    </Factsheet_Panel>
  );
};

export default Factsheet_Entry_Hours;
