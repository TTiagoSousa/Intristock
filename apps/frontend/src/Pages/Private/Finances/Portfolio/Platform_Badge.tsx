import { useState } from 'react';
import type { Portfolio_Platform } from '../../../../Hooks/Finances/usePersonalPortfolio';

/** O logótipo da corretora de um portefólio; sem ele (ou se não carregar) não ocupa espaço. */
const Platform_Badge = ({ platform }: { platform: Portfolio_Platform | null }) => {
  const [failed, setFailed] = useState(false);
  if (!platform?.logo || failed) return null;
  return (
    <img
      className="Portfolio_Platform_Logo"
      src={platform.logo}
      alt=""
      title={platform.name}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
};

export default Platform_Badge;
