interface Sliders_Props {
  color?: string;
}

const Sliders = ({ color = 'currentColor' }: Sliders_Props) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"
    stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 7h9M17.5 7H20M4 12.5h3.5M12 12.5h8M4 18h9M17.5 18H20" />
    <circle cx="15" cy="7" r="2" />
    <circle cx="9.5" cy="12.5" r="2" />
    <circle cx="15" cy="18" r="2" />
  </svg>
);

export default Sliders;
