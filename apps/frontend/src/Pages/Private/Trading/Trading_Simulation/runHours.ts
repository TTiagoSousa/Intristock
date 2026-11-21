import { useMemo } from 'react';
import type { TFunction } from 'i18next';
import type { Entry_Payload, Simulation_Report, Simulation_Run } from '../../../../Hooks/Trading/useSimulation';
import type { Hour_Bars_Part } from './Factsheet_Hour_Bars';
import { hourLabel, useFactsheetFormat } from './factsheetFormat';

// O que cada secção do ecrã 5 (os Horários) recebe do Run_Hours
export interface Hours_Section_Props {
  run: Simulation_Run;
  report: Simulation_Report | null | undefined;
  loading: boolean;
  entries: Entry_Payload[];
  unit: string;
  f: ReturnType<typeof useFactsheetFormat>;
}

export const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

// "2026-04-13" → "13/04/2026"
export const dateLabel = (date: string) => date.split('-').reverse().join('/');

// A última hora da madrugada na legenda (a 5.2 conta das 0h às 7h, `NIGHT_HOURS`)
const NIGHT_END = 7;

// O fuso do texto que vem do estudo (o de Portugal, com a mudança de hora)
export const LISBON = 'Europe/Lisbon';

export const pnlPart = (_: number, value: number) => (value < 0 ? 'loss' : 'gain');

// A nota de um gráfico com a amostra pequena esbatida
export const fadedNote = (t: TFunction, note: string, min?: number) =>
  min ? `${note} · ${t('trading.fsSampleFaded', { min })}` : note;

export const weekdayName = (t: TFunction, day: number) => t(`trading.fsWeekday_${day}`);

// O nome do fuso na hora local da 5.7 e da 5.10
export const zoneLabel = (t: TFunction, name: string) => (name === LISBON ? t('trading.fsZoneLisbon') : name);

// As cores de cada gráfico de barras, com o nome da legenda
export const useHourLegends = (t: TFunction) =>
  useMemo(() => {
    const range = `${hourLabel(0)}–${hourLabel(NIGHT_END)}`;
    const pnlParts: Hour_Bars_Part[] = [
      { id: 'gain', name: t('trading.fsBarsGain'), colorToken: 'chart-strategy' },
      { id: 'loss', name: t('trading.fsBarsLoss'), colorToken: 'chart-drawdown' },
    ];
    return {
      stops: [{ id: 'stops', name: t('trading.fsHourStopsSeries'), colorToken: 'exit-stop' }] as Hour_Bars_Part[],
      pnl: pnlParts,
      exitStops: [
        { id: 'day', name: t('trading.fsHourStopsSeries'), colorToken: 'exit-stop' },
        { id: 'night', name: t('trading.fsBarsNightStops', { range }), colorToken: 'hour-night-stop' },
      ] as Hour_Bars_Part[],
      wins: [{ id: 'wins', name: t('trading.fsExitHourWinsSeries'), colorToken: 'chart-strategy' }] as Hour_Bars_Part[],
      duration: [{ id: 'duration', name: t('trading.fsPositionDurationSeries'), colorToken: 'exit-other' }] as Hour_Bars_Part[],
      positions: [
        { id: 'day', name: t('trading.fsPositionDaySeries'), colorToken: 'exit-signal' },
        { id: 'night', name: t('trading.fsPositionNightSeries', { range }), colorToken: 'exit-time' },
      ] as Hour_Bars_Part[],
      gaps: [
        { id: 'gain', name: t('trading.fsGapUp'), colorToken: 'chart-strategy' },
        { id: 'loss', name: t('trading.fsGapDown'), colorToken: 'chart-drawdown' },
      ] as Hour_Bars_Part[],
    };
  }, [t]);
