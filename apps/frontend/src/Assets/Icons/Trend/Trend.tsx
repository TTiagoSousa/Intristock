interface Trend_Props {
  color?: string;
}

// Uma linha de preço a subir, para o módulo de mercados
const Trend = ({ color = 'currentColor' }: Trend_Props) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"
    stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 17l6-6 4 4 8-8" />
    <path d="M15 7h6v6" />
  </svg>
);

export default Trend;
