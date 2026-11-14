/** Um valor na moeda do topo e, se veio de outra, o original por baixo (`useDayRates().money`). */
const Converted_Amount = ({ value }: { value: { main: string; original: string | null } }) => (
  <>
    {value.main}
    {value.original && <div className="Earnings_Sub">{value.original}</div>}
  </>
);

export default Converted_Amount;
