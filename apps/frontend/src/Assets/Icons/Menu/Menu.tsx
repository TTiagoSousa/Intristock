interface MenuProps {
  color?: string;
}

const Menu = ({ color = 'currentColor' }: MenuProps) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <path d="M3 6H21" stroke={color} strokeWidth="1.75" strokeLinecap="round" />
    <path d="M3 12H21" stroke={color} strokeWidth="1.75" strokeLinecap="round" />
    <path d="M3 18H21" stroke={color} strokeWidth="1.75" strokeLinecap="round" />
  </svg>
);

export default Menu;
