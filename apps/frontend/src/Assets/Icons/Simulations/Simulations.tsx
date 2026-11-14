interface SimulationsProps {
  color?: string;
}

const Simulations = ({ color = 'currentColor' }: SimulationsProps) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <line x1="4" y1="20" x2="20" y2="20" stroke={color} strokeWidth="1.75" strokeLinecap="round" />
    <path d="M4 15l4-5 4 3 5-7" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default Simulations;
