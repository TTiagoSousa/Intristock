interface PieProps {
  color?: string;
}

// Um gráfico circular com uma fatia à parte: a divisão de um portefólio pelos ativos
const Pie = ({ color = 'currentColor' }: PieProps) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <path d="M10.5 4.6C6.8 5.3 4 8.5 4 12.4C4 16.8 7.6 20.4 12 20.4C15.9 20.4 19.1 17.6 19.8 13.9H10.5V4.6Z" stroke={color} strokeWidth="1.75" strokeLinejoin="round" />
    <path d="M14 3.6C17.4 4.3 20.1 7 20.8 10.4H14V3.6Z" stroke={color} strokeWidth="1.75" strokeLinejoin="round" />
  </svg>
);

export default Pie;
