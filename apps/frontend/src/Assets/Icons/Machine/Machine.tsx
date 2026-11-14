interface Machine_Props {
  color?: string;
}

const Machine = ({ color = 'currentColor' }: Machine_Props) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"
    stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3.5" width="18" height="12" rx="2" />
    <path d="M8 15.5v2.5M16 15.5v2.5M5.5 20.5h13" />
    <path d="M8.5 7.5h7M8.5 11h4" />
  </svg>
);

export default Machine;
