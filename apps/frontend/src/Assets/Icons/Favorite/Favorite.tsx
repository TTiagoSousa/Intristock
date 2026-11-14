interface FavoriteProps {
  color?: string;
}

const Favorite = ({ color = 'currentColor' }: FavoriteProps) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <path
      d="M12 3l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.2-5.4 3.2 1.3-6-4.6-4.1 6.1-.6z"
      stroke={color}
      strokeWidth="1.75"
      strokeLinejoin="round"
    />
  </svg>
);

export default Favorite;
