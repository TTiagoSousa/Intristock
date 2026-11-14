interface TrashProps {
  color?: string;
}

const Trash = ({ color = 'currentColor' }: TrashProps) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <path d="M4 7H20" stroke={color} strokeWidth="1.75" strokeLinecap="round" />
    <path d="M9 7V5C9 4.44772 9.44772 4 10 4H14C14.5523 4 15 4.44772 15 5V7" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M6 7L6.8 19C6.85 19.6 7.35 20 7.9 20H16.1C16.65 20 17.15 19.6 17.2 19L18 7" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M10 11V16M14 11V16" stroke={color} strokeWidth="1.75" strokeLinecap="round" />
  </svg>
);

export default Trash;
