import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import Global_Input from '../../../../../Components/Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import Simple_Button from '../../../../../Components/Buttons/Simple_Button/Simple_Button';
import type { ApiProvider, ApiSettingInput, ApiSettingView } from '../../../../../Hooks/Admin/useApiSettings';
import type { ApiHealth } from '../../../../../Hooks/Admin/useApisHealth';
import type { SyncResult, SyncTarget } from '../../../../../Hooks/Admin/useCatalogSync';

export interface Api_Card_Sync {
  target: SyncTarget;
  // O que já está no catálogo (ex. "161 moedas"), no lugar da explicação
  detail: string;
  // O detalhe a amarelo (ex. cotações antigas)
  warn?: boolean;
}

interface Api_Card_Props {
  kind: 'currency' | 'country' | 'propfirm' | 'exchange';
  icon: ReactNode;
  saved: ApiSettingView;
  values: ApiSettingInput;
  providers: ApiProvider[];
  health: ApiHealth | null;
  checking: boolean;
  saving: boolean;
  syncs: Api_Card_Sync[];
  running: SyncTarget | null;
  results: Partial<Record<SyncTarget, SyncResult>>;
  onChange: (values: ApiSettingInput) => void;
  onReset: () => void;
  onSave: () => void;
  onSync: (target: SyncTarget) => void;
  // Dados que não são um atualizar simples (as prop firms: em fundo, com o comparar)
  extra?: ReactNode;
}

/**
 * Uma API externa num cartão: o estado da ligação, o fornecedor, o endereço e a
 * chave, e os dados que vêm dela com o botão de atualizar cada um.
 */
const Api_Card = ({
  kind,
  icon,
  saved,
  values,
  providers,
  health,
  checking,
  saving,
  syncs,
  running,
  results,
  onChange,
  onReset,
  onSave,
  onSync,
  extra,
}: Api_Card_Props) => {
  const { t } = useTranslation();
  const provider = providers.find((p) => p.id === values.provider);
  const dirty = values.provider !== saved.provider || values.url !== saved.url || values.key.trim() !== '';
  // Uma API pública não tem campo de chave nem a pede para gravar
  const keyRequired = provider?.keyRequired !== false;
  // Pública mas com chave opcional (mais pedidos): o campo aparece e pode ficar vazio
  const keyOptional = !keyRequired && provider?.keyOptional === true;
  const missingKey = keyRequired && !saved.keySet && !values.key.trim();

  // O estado da ligação: a testar, por testar, ou o que a API respondeu
  const status = checking
    ? { tone: '', text: t('adminApis.statusChecking') }
    : !health
      ? { tone: '', text: t('adminApis.statusUnknown') }
      : health.status === 'online'
        ? { tone: 'Ok', text: t('adminApis.statusOnline', { ms: health.latencyMs }) }
        : health.status === 'key_rejected'
          ? { tone: 'Bad', text: t('adminApis.statusKeyRejected') }
          : health.status === 'offline'
            ? {
                tone: 'Bad',
                text: health.httpStatus
                  ? t('adminApis.statusOfflineCode', { code: health.httpStatus })
                  : t('adminApis.statusOffline'),
              }
            : { tone: 'Warn', text: t('adminApis.statusUnconfigured') };

  const changeProvider = (providerId: string) => {
    const next = providers.find((p) => p.id === providerId);
    onChange({ ...values, provider: providerId, url: next?.defaultUrl ?? values.url });
  };

  return (
    <section className={`Card Api_Card ${health?.status === 'online' && !checking ? 'Online' : ''}`}>
      <header className="Api_Card_Head">
        <span className="Api_Card_Icon" aria-hidden>
          {icon}
        </span>
        <div className="Api_Card_Title">
          <span className="Card_Title">{t(`adminApis.${kind}Title`)}</span>
          <span className="Api_Card_Provider">{provider?.label ?? values.provider}</span>
        </div>
        <span className={`Pill ${status.tone} Api_Card_Status`}>
          <span className={`Dot ${checking ? 'Pulse' : ''}`} />
          {status.text}
        </span>
      </header>

      <p className="Api_Card_Purpose">{t(`adminApis.${kind}Purpose`)}</p>

      <div className="Api_Card_Body">
      <div className="Api_Card_Section">
        <span className="Eyebrow">{t('adminApis.connection')}</span>

        <div className="Api_Field">
          <label htmlFor={`${kind}-provider`}>{t('adminApis.provider')}</label>
          <Global_Dropdown
            id={`${kind}-provider`}
            value={values.provider}
            onChange={(value) => changeProvider(String(value))}
            options={providers.map((p) => ({ value: p.id, label: p.label }))}
          />
        </div>

        <div className="Api_Field">
          <label htmlFor={`${kind}-url`}>{t('adminApis.url')}</label>
          <Global_Input
            id={`${kind}-url`}
            value={values.url}
            onChange={(e) => onChange({ ...values, url: e.target.value })}
          />
        </div>

        {keyRequired || keyOptional ? (
          <div className="Api_Field">
            <label htmlFor={`${kind}-key`}>{t('adminApis.key')}</label>
            <Global_Input
              id={`${kind}-key`}
              type="password"
              value={values.key}
              placeholder={saved.keyPreview ?? t('adminApis.keyPlaceholder')}
              onChange={(e) => onChange({ ...values, key: e.target.value })}
            />
            <span className="Api_Field_Hint">
              {keyOptional
                ? t(saved.keySet ? 'adminApis.keyOptionalKeepHint' : 'adminApis.keyOptionalHint')
                : saved.keySet
                  ? t('adminApis.keyKeepHint')
                  : t('adminApis.keyHint')}
              {provider && (
                <>
                  {' '}
                  <a href={provider.docsUrl} target="_blank" rel="noreferrer" className="Api_Card_Link">
                    {t('adminApis.getKey', { provider: provider.label })}
                  </a>
                </>
              )}
            </span>
          </div>
        ) : (
          <div className="Api_Field">
            <label>{t('adminApis.key')}</label>
            <span className="Api_Field_Value">
              {t('adminApis.keyNotNeeded')}
              {provider && (
                <>
                  {' '}
                  <a href={provider.docsUrl} target="_blank" rel="noreferrer" className="Api_Card_Link">
                    {t('adminApis.docs')}
                  </a>
                </>
              )}
            </span>
          </div>
        )}
      </div>

      <div className="Api_Card_Section">
        <span className="Eyebrow">{t('adminApis.data')}</span>
        {syncs.length === 0 && !extra && <span className="Api_Sync_Empty">{t('adminApis.noData')}</span>}
        {extra}
        {syncs.map(({ target, detail, warn }) => {
          const result = results[target];
          return (
            <div className="Api_Sync_Row" key={target}>
              <div className="Api_Sync_Text">
                <span className="Api_Sync_Label">{t(`adminApis.sync.${target}`)}</span>
                {/* O resultado fica no lugar do detalhe: a linha não muda de altura */}
                <span className={`Api_Sync_Detail ${result ? (result.ok ? 'Ok' : 'Bad') : warn ? 'Warn' : ''}`}>
                  {result
                    ? result.ok
                      ? t(`adminApis.sync.${target}Done`, { count: result.count })
                      : result.message
                    : detail}
                </span>
              </div>
              <Simple_Button
                text={t('adminApis.sync.run')}
                onClick={() => onSync(target)}
                disabled={running !== null || health?.status === 'unconfigured'}
                variant="Ghost"
                small
                auto
              />
            </div>
          );
        })}
      </div>
      </div>

      <footer className="Api_Card_Foot">
        <span className={`Api_Card_Foot_Hint ${dirty ? 'Dirty' : ''}`}>
          {missingKey
            ? t('adminApis.keyNeeded')
            : dirty
              ? t('adminApis.unsaved')
              : t(keyRequired ? 'adminApis.encryptedHint' : keyOptional ? 'adminApis.optionalHint' : 'adminApis.publicHint')}
        </span>
        {dirty && <Simple_Button text={t('adminApis.discard')} onClick={onReset} variant="Quiet" small auto />}
        <Simple_Button
          text={t('common.save')}
          onClick={onSave}
          disabled={saving || !dirty || missingKey}
          small
          auto
        />
      </footer>
    </section>
  );
};

export default Api_Card;
