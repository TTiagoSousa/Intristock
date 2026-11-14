interface Sparkles_Props {
  color?: string;
}

// As novidades (as versões): uma estrela grande e duas pequenas
const Sparkles = ({ color = 'currentColor' }: Sparkles_Props) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"
    stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 4.5l1.6 4.4 4.4 1.6-4.4 1.6L10 16.5l-1.6-4.4L4 10.5l4.4-1.6z" />
    <path d="M17.5 3v3M16 4.5h3" />
    <path d="M18 15.5v4M16 17.5h4" />
  </svg>
);

export default Sparkles;
