interface Candles_Props {
  color?: string;
}

// Três velas de um gráfico de preços, para o módulo de trading
const Candles = ({ color = 'currentColor' }: Candles_Props) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"
    stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 4v3M6 15v5M12 3v5M12 13v3M18 7v4M18 17v3" />
    <rect x="4" y="7" width="4" height="8" rx="1" />
    <rect x="10" y="8" width="4" height="5" rx="1" />
    <rect x="16" y="11" width="4" height="6" rx="1" />
  </svg>
);

export default Candles;
