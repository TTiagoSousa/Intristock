import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import Global_Input from '../../../../../Components/Inputs/Global_Input/Global_Input';
import Simple_Button from '../../../../../Components/Buttons/Simple_Button/Simple_Button';
import Confirm_Popover from '../../../../../Components/Confirm_Popover/Confirm_Popover';
import { useApiKeys, type Api_Key, type Api_Key_Kind } from '../../../../../Hooks/Admin/useApiKeys';
import { localeOf } from '../../../../../utils/locale';

interface Api_Keys_Card_Props {
  kind: Api_Key_Kind;
  icon: ReactNode;
}

/**
 * Uma API com várias chaves (por agora a SerpApi, para os preços das motas): a lista pela
 * ordem em que se usam — quando uma esgota as pesquisas do mês passa-se à seguinte —, com as
 * pesquisas usadas e as que faltam de cada uma, ligar/desligar, subir/descer, apagar e juntar
 * uma nova (validada na API antes de se gravar).
 */
const Api_Keys_Card = ({ kind, icon }: Api_Keys_Card_Props) => {
  const { t, i18n } = useTranslation();
  const { list, busy, error, add, update, remove, move, refresh } = useApiKeys(kind);
  const [key, setKey] = useState('');
  const [label, setLabel] = useState('');
  const [deleting, setDeleting] = useState<Api_Key | null>(null);
  const locale = localeOf(i18n.language);
  const date = (value: string | null) => (value ? new Date(value).toLocaleDateString(locale) : '—');
  const now = Date.now();

  const keys = list?.keys ?? [];
  const usable = keys.filter((row) => row.active && !(row.exhaustedUntil && new Date(row.exhaustedUntil).getTime() > now));
  const left = usable.reduce((sum, row) => sum + (row.remaining ?? 0), 0);
  // A primeira que se pode usar é a que está a ser usada
  const currentId = usable[0]?.id ?? null;

  const status = !list
    ? { tone: '', text: t('adminApis.statusUnknown') }
    : keys.length === 0
      ? { tone: 'Warn', text: t('adminApis.statusUnconfigured') }
      : usable.length === 0
        ? { tone: 'Bad', text: t('apiKeys.statusExhausted') }
        : { tone: 'Ok', text: t('apiKeys.statusLeft', { count: left }) };

  const stateOf = (row: Api_Key) => {
    if (!row.active) return { tone: '', text: t('apiKeys.off') };
    if (row.exhaustedUntil && new Date(row.exhaustedUntil).getTime() > now)
      return { tone: 'Warn', text: t('apiKeys.exhaustedUntil', { date: date(row.exhaustedUntil) }) };
    if (row.lastError) return { tone: 'Bad', text: t('apiKeys.error') };
    if (row.id === currentId) return { tone: 'Ok', text: t('apiKeys.inUse') };
    return { tone: '', text: t('apiKeys.waiting') };
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!key.trim() || busy) return;
    if (await add(key.trim(), label.trim())) {
      setKey('');
      setLabel('');
    }
  };

  return (
    <section className={`Card Api_Card ${usable.length ? 'Online' : ''}`}>
      <header className="Api_Card_Head">
        <span className="Api_Card_Icon" aria-hidden>
          {icon}
        </span>
        <div className="Api_Card_Title">
          <span className="Card_Title">{t(`apiKeys.${kind}Title`)}</span>
          <span className="Api_Card_Provider">{list?.provider.label ?? 'SerpApi'}</span>
        </div>
        <span className={`Pill ${status.tone} Api_Card_Status`}>
          <span className="Dot" />
          {status.text}
        </span>
      </header>

      <p className="Api_Card_Purpose">{t(`apiKeys.${kind}Purpose`)}</p>

      <div className="Api_Card_Body Api_Keys_Body">
        <div className="Api_Card_Section">
          <span className="Eyebrow">{t('apiKeys.keys')}</span>
          {keys.length === 0 && <span className="Api_Sync_Empty">{t('apiKeys.none')}</span>}
          {keys.map((row, index) => {
            const state = stateOf(row);
            const used = row.monthlyLimit ? Math.min(100, (row.usedThisMonth / row.monthlyLimit) * 100) : 0;
            return (
              <div key={row.id} className="Api_Key_Row">
                <span className="Api_Key_Order Num">{index + 1}</span>
                <div className="Api_Key_Text">
                  <span className="Api_Sync_Label">
                    {row.label ?? t('apiKeys.unnamed')} <span className="Api_Key_Hint Num">…{row.keyHint}</span>
                  </span>
                  <span className="Api_Sync_Detail Num">
                    {row.monthlyLimit !== null
                      ? t('apiKeys.usage', { used: row.usedThisMonth, limit: row.monthlyLimit, left: row.remaining ?? 0 })
                      : t('apiKeys.usageUnknown')}
                    {row.lastError ? ` · ${row.lastError}` : ''}
                  </span>
                  {row.monthlyLimit !== null && (
                    <span className="Api_Key_Bar" aria-hidden>
                      <span style={{ width: `${used}%` }} />
                    </span>
                  )}
                </div>
                <span className={`Pill ${state.tone}`}>{state.text}</span>
                <div className="Api_Key_Actions">
                  <button
                    type="button"
                    className="Api_Key_Move"
                    disabled={index === 0 || busy !== null}
                    onClick={() => void move(row.id, -1)}
                    aria-label={t('apiKeys.up')}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="Api_Key_Move"
                    disabled={index === keys.length - 1 || busy !== null}
                    onClick={() => void move(row.id, 1)}
                    aria-label={t('apiKeys.down')}
                  >
                    ↓
                  </button>
                  <Simple_Button
                    text={row.active ? t('apiKeys.turnOff') : t('apiKeys.turnOn')}
                    onClick={() => void update(row.id, { active: !row.active })}
                    disabled={busy === row.id}
                    variant="Quiet"
                    small
                    auto
                  />
                  <Simple_Button text={t('common.delete')} onClick={() => setDeleting(row)} variant="Quiet" small auto />
                </div>
              </div>
            );
          })}
        </div>

        <form className="Api_Card_Section" onSubmit={submit}>
          <span className="Eyebrow">{t('apiKeys.addTitle')}</span>
          <div className="Api_Field">
            <label htmlFor={`${kind}-new-key`}>{t('adminApis.key')}</label>
            <Global_Input
              id={`${kind}-new-key`}
              type="password"
              value={key}
              maxLength={200}
              autoComplete="off"
              onChange={(e) => setKey(e.target.value)}
            />
            <span className="Api_Field_Hint">
              {t('apiKeys.addHint')}{' '}
              {list && (
                <a href={list.provider.docsUrl} target="_blank" rel="noreferrer" className="Api_Card_Link">
                  {t('adminApis.getKey', { provider: list.provider.label })}
                </a>
              )}
            </span>
          </div>
          <div className="Api_Field">
            <label htmlFor={`${kind}-new-label`}>{t('apiKeys.label')}</label>
            <Global_Input
              id={`${kind}-new-label`}
              value={label}
              maxLength={60}
              placeholder={t('apiKeys.labelPlaceholder')}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <div className="Api_Key_Add">
            <Simple_Button
              type="submit"
              text={t('apiKeys.add')}
              disabled={!key.trim() || busy !== null}
              small
              auto
            />
          </div>
        </form>
      </div>

      <footer className="Api_Card_Foot">
        <span className={`Api_Card_Foot_Hint ${error ? 'Dirty' : ''}`}>{error ?? t('apiKeys.footHint')}</span>
        <Simple_Button
          text={t('apiKeys.refresh')}
          onClick={() => void refresh()}
          disabled={busy !== null || keys.length === 0}
          variant="Ghost"
          small
          auto
        />
      </footer>

      {deleting && (
        <Confirm_Popover
          title={t('apiKeys.deleteTitle')}
          subtitle={`${deleting.label ?? t('apiKeys.unnamed')} · …${deleting.keyHint}`}
          message={t('apiKeys.deleteConfirm')}
          confirmText={t('common.delete')}
          busy={busy === deleting.id}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            if (await remove(deleting.id)) setDeleting(null);
          }}
        />
      )}
    </section>
  );
};

export default Api_Keys_Card;
