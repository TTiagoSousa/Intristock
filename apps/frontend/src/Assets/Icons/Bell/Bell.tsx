interface Bell_Props {
  color?: string;
}

const Bell = ({ color = 'currentColor' }: Bell_Props) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"
    stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 9.2a6 6 0 1 0-12 0c0 5.4-2 6.8-2 6.8h16s-2-1.4-2-6.8" />
    <path d="M13.7 19.5a2 2 0 0 1-3.4 0" />
  </svg>
);

export default Bell;
