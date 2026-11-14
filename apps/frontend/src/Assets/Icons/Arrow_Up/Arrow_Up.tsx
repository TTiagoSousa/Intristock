interface Arrow_Up_Props {
  color?: string;
}

const Arrow_Up = ({ color = 'currentColor' }: Arrow_Up_Props) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"
    stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 19V5M6 11l6-6 6 6" />
  </svg>
);

export default Arrow_Up;
