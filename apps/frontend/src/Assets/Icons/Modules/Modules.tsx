interface Modules_Props {
  color?: string;
}

// Três blocos e um "+": peças que se ligam à empresa, para não se confundir
// com as linhas de controlos das definições
const Modules = ({ color = 'currentColor' }: Modules_Props) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"
    stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
    <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
    <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
    <path d="M16.75 13.5v6.5M13.5 16.75H20" />
  </svg>
);

export default Modules;
