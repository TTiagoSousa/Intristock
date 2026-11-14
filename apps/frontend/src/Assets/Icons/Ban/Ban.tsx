interface BanProps {
  color?: string;
}

const Ban = ({ color = 'currentColor' }: BanProps) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <circle cx="12" cy="12" r="8" stroke={color} strokeWidth="1.75" />
    <path d="M6.5 6.5L17.5 17.5" stroke={color} strokeWidth="1.75" strokeLinecap="round" />
  </svg>
);

export default Ban;
