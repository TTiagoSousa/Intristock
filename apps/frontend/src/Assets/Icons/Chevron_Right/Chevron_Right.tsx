interface Chevron_Right_Props {
  color?: string;
}

const Chevron_Right = ({ color = 'currentColor' }: Chevron_Right_Props) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <path d="M9 6L15 12L9 18" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default Chevron_Right;
