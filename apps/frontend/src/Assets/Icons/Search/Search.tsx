interface Search_Props {
  color?: string;
}

const Search = ({ color = 'currentColor' }: Search_Props) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <circle cx="11" cy="11" r="7" stroke={color} strokeWidth="1.75" />
    <path d="M16.5 16.5L21 21" stroke={color} strokeWidth="1.75" strokeLinecap="round" />
  </svg>
);

export default Search;
