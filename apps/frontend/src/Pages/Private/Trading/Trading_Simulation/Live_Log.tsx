import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import type { Live_Event } from '../../../../Hooks/Trading/useLiveTests';
import Segmented from '../Trading_Simulator/Segmented';
import Factsheet_Panel from './Factsheet_Panel';
import { categoryOf } from './liveTexts';
import type { Live_Category, useLiveTexts } from './liveTexts';

interface Live_Log_Props {
  events: Live_Event[];
  noMore: boolean;
  onLoadOlder: () => Promise<void>;
  texts: ReturnType<typeof useLiveTexts>;
}

type Log_Filter = 'all' | Live_Category;
const FILTERS: Log_Filter[] = ['all', 'trade', 'signal', 'condition', 'account', 'system'];

/**
 * Os registos do teste, dos mais recentes para trás, à medida que acontecem:
 * cada condição que muda, os grupos, as condições de uma entrada a cumprir-se, os
 * sinais e o que lhes aconteceu (entrou, ordem posta, bloqueado e porquê), as
 * ordens, as posições, as parciais, os reforços, os passos do stop, os toques no
 * stop e no take, os depósitos, as pausas e a ligação à corretora. Filtram-se
 * por grupo; os mais antigos vêm às páginas.
 */
const Live_Log = ({ events, noMore, onLoadOlder, texts }: Live_Log_Props) => {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<Log_Filter>('all');
  const [loading, setLoading] = useState(false);
  const shown = filter === 'all' ? events : events.filter((item) => categoryOf(item.kind) === filter);

  const older = async () => {
    setLoading(true);
    try {
      await onLoadOlder();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Factsheet_Panel
      title={t('trading.liveLogTitle')}
      note={t('trading.liveLogNote')}
      actions={
        <Segmented
          label={t('trading.liveLogTitle')}
          value={filter}
          options={FILTERS.map((value) => ({ value, label: t(`trading.liveLogFilter_${value}`) }))}
          onChange={setFilter}
        />
      }
    >
      <div className="Live_Log">
        {shown.length ? (
          <ol className="Live_Log_List">
            {shown.map((item) => (
              <li key={item.id} className={`Live_Log_Row ${categoryOf(item.kind)}`}>
                <span className="Live_Log_Dot" aria-hidden="true" />
                <time className="Live_Log_Time">{texts.time(item.time)}</time>
                <span className="Live_Log_Text">{texts.text(item)}</span>
              </li>
            ))}
          </ol>
        ) : (
          <span className="Factsheet_Hint">{t('trading.liveLogEmpty')}</span>
        )}
        {!noMore && events.length > 0 && (
          <div className="Live_Log_More">
            <Simple_Button text={t('trading.liveLogOlder')} variant="Ghost" small auto disabled={loading} onClick={() => void older()} />
          </div>
        )}
      </div>
    </Factsheet_Panel>
  );
};

export default Live_Log;
