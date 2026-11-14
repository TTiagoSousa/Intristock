interface Company_Props {
  color?: string;
}

const Company = ({ color = 'currentColor' }: Company_Props) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <rect x="5" y="3" width="10" height="18" rx="1" stroke={color} strokeWidth="1.75" />
    <path d="M15 21V9H19C19.5523 9 20 9.44772 20 10V21" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M8 7H8.01M12 7H12.01M8 11H8.01M12 11H12.01M8 15H8.01M12 15H12.01" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default Company;
