interface Chevrons_Left_Props {
  color?: string;
}

// Seta dupla — salta para a primeira página
const Chevrons_Left = ({ color = 'currentColor' }: Chevrons_Left_Props) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <path d="M18 6L12 12L18 18" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M11 6L5 12L11 18" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default Chevrons_Left;
