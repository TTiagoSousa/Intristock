interface Filter_Props {
  color?: string;
}

const Filter = ({ color = 'currentColor' }: Filter_Props) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"
    stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 5h16l-6.2 7.4v5.1L10.2 19v-6.6L4 5z" />
  </svg>
);

export default Filter;
