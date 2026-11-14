interface Chevron_Left_Props {
  color?: string;
}

const Chevron_Left = ({ color = 'currentColor' }: Chevron_Left_Props) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <path d="M15 6L9 12L15 18" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default Chevron_Left;
