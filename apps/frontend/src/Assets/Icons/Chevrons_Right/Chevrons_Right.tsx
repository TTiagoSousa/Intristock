interface Chevrons_Right_Props {
  color?: string;
}

// Seta dupla — salta para a última página
const Chevrons_Right = ({ color = 'currentColor' }: Chevrons_Right_Props) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <path d="M6 6L12 12L6 18" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M13 6L19 12L13 18" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default Chevrons_Right;
