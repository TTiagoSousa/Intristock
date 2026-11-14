/**
 * O perfil de volume de umas velas, com as contas da trading-chart (e do
 * simulador): o volume de cada vela reparte-se pelas linhas que ela atravessa,
 * o POC é a linha com mais volume e a área de valor cresce a partir dele para o
 * lado com mais volume até à %. Serve o esquema do "Ver como funciona", que
 * desenha o perfil das velas inventadas.
 */

export interface Profile_Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Profile_Row {
  lo: number;
  hi: number;
  volume: number;
  up: number;
}

export interface Volume_Profile {
  rows: Profile_Row[];
  poc: number;
  vah: number;
  val: number;
  pocRow: number;
  vaLow: number;
  vaHigh: number;
  // Volume de alta − de baixa, em % do total
  delta: number;
}

export const computeProfile = (candles: Profile_Candle[], rowCount: number, vaPct: number): Volume_Profile | null => {
  if (!candles.length) return null;
  const lo = Math.min(...candles.map((candle) => candle.low));
  const hi = Math.max(...candles.map((candle) => candle.high));
  if (!(hi > lo)) return null;
  const count = Math.max(1, Math.round(rowCount));
  const step = (hi - lo) / count;
  const rows: Profile_Row[] = Array.from({ length: count }, (_, index) => ({
    lo: lo + index * step,
    hi: lo + (index + 1) * step,
    volume: 0,
    up: 0,
  }));
  let up = 0;
  let down = 0;
  for (const candle of candles) {
    const rising = candle.close >= candle.open;
    if (rising) up += candle.volume;
    else down += candle.volume;
    const span = candle.high - candle.low;
    if (span <= 0) {
      const row = rows[Math.max(0, Math.min(count - 1, Math.floor((candle.close - lo) / step)))];
      row.volume += candle.volume;
      if (rising) row.up += candle.volume;
      continue;
    }
    const first = Math.max(0, Math.floor((candle.low - lo) / step));
    const last = Math.min(count - 1, Math.floor((candle.high - lo) / step));
    for (let index = first; index <= last; index++) {
      const cover = Math.min(candle.high, rows[index].hi) - Math.max(candle.low, rows[index].lo);
      if (cover <= 0) continue;
      const share = (candle.volume * cover) / span;
      rows[index].volume += share;
      if (rising) rows[index].up += share;
    }
  }

  // O POC e a área de valor
  let pocRow = 0;
  let total = 0;
  rows.forEach((row, index) => {
    total += row.volume;
    if (row.volume > rows[pocRow].volume) pocRow = index;
  });
  let vaLow = pocRow;
  let vaHigh = pocRow;
  let acc = rows[pocRow].volume;
  while (acc < total * (vaPct / 100) && (vaLow > 0 || vaHigh < count - 1)) {
    const below = vaLow > 0 ? rows[vaLow - 1].volume : -1;
    const above = vaHigh < count - 1 ? rows[vaHigh + 1].volume : -1;
    if (above >= below) {
      vaHigh++;
      acc += above;
    } else {
      vaLow--;
      acc += below;
    }
  }
  return {
    rows,
    pocRow,
    vaLow,
    vaHigh,
    poc: (rows[pocRow].lo + rows[pocRow].hi) / 2,
    vah: rows[vaHigh].hi,
    val: rows[vaLow].lo,
    delta: up + down > 0 ? ((up - down) / (up + down)) * 100 : 0,
  };
};

/** O volume da linha onde está o preço, em % do da linha do POC (fora do perfil, 0). */
export const rowVolumeAt = (profile: Volume_Profile, price: number) => {
  const row = profile.rows.find((item) => price >= item.lo && price < item.hi);
  const peak = profile.rows[profile.pocRow].volume;
  return row && peak > 0 ? (row.volume / peak) * 100 : 0;
};
