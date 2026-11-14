import { Timeframe } from '../dto/create-simulation.dto';

const MINUTE_MS = 60 * 1000;

export const TIMEFRAME_MS: Record<Timeframe, number> = {
  '1m': MINUTE_MS,
  '3m': 3 * MINUTE_MS,
  '5m': 5 * MINUTE_MS,
  '15m': 15 * MINUTE_MS,
  '30m': 30 * MINUTE_MS,
  '1h': 60 * MINUTE_MS,
  '4h': 240 * MINUTE_MS,
  '1d': 1440 * MINUTE_MS,
};
