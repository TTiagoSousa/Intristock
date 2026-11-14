// Formatação dos números e datas do simulador

export const formatNumber = (value: number, language: string, digits = 2) =>
  value.toLocaleString(language, { minimumFractionDigits: digits, maximumFractionDigits: digits });

// Preços com as casas que fazem sentido: 91 176,48 / 1,2345 / 0,00001234
export const formatPrice = (value: number, language: string) => {
  const magnitude = Math.abs(value);
  const digits = magnitude >= 1000 ? 2 : magnitude >= 1 ? 4 : 8;
  return value.toLocaleString(language, { minimumFractionDigits: 2, maximumFractionDigits: digits });
};

export const formatPct = (value: number | null, language: string) =>
  value == null ? '—' : `${value > 0 ? '+' : ''}${formatNumber(value, language)}%`;

export const formatSigned = (value: number, language: string) =>
  `${value > 0 ? '+' : ''}${formatNumber(value, language)}`;

// As velas são em UTC; as datas mostram-se em UTC para baterem com elas
export const formatDateTime = (value: string | number, language: string) =>
  new Date(value).toLocaleString(language, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });

export const formatDay = (value: string | number, language: string) =>
  new Date(value).toLocaleDateString(language, { timeZone: 'UTC' });

export const toneOf = (value: number | null) => (value == null || value === 0 ? '' : value > 0 ? 'Gain' : 'Loss');
