import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useApiSettings, type ApiSettingInput, type ApiSettings } from '../../../../../Hooks/Admin/useApiSettings';
import { useApisHealth, type ApisHealth } from '../../../../../Hooks/Admin/useApisHealth';
import { useCatalogSync, type SyncTarget } from '../../../../../Hooks/Admin/useCatalogSync';
import { useCurrency } from '../../../../../Contexts/Currency_Context';
import Simple_Button from '../../../../../Components/Buttons/Simple_Button/Simple_Button';
import Api_Card, { type Api_Card_Sync } from './Api_Card';
import Prop_Firms_Data from './Prop_Firms_Data';
import Exchanges_Data from './Exchanges_Data';
import Api_Keys_Card from './Api_Keys_Card';
import * as Icon from '../../../../../Imports/icons';
import '../Admin.scss';
import './Apis.scss';

type Api_Kind = 'currency' | 'country' | 'propfirm' | 'exchange';
type Api_Values = Record<Api_Kind, ApiSettingInput>;

// Cotações com mais de 2 dias já não são as do dia
const STALE_RATES_MS = 2 * 24 * 60 * 60 * 1000;

interface Api_Entry {
  kind: Api_Kind;
  icon: ReactNode;
  // Os dados que vêm desta API, cada um com o que já está no catálogo
  syncs: (catalog: ApisHealth['catalog'] | undefined, format: (iso: string) => string) => Api_Card_Sync[];
  // Ou um bloco próprio, quando o atualizar não é simples
  extra?: (format: (iso: string) => string) => ReactNode;
}

const fromSaved = (settings: ApiSettings, kind: Api_Kind): ApiSettingInput => ({
  provider: settings[kind].provider,
  url: settings[kind].url,
  key: '',
});

const Apis = () => {
  const { t, i18n } = useTranslation();
  const { settings, loading, saving, save } = useApiSettings();
  const { health, checking, check } = useApisHealth();
  const { running, results, sync } = useCatalogSync();
  const { refresh: refreshCurrencies } = useCurrency();
  const [savingKind, setSavingKind] = useState<Api_Kind | null>(null);

  const locale = i18n.language === 'pt' ? 'pt-PT' : 'en-GB';
  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' });

  // Uma API nova entra aqui (e no backend: o fornecedor e o teste dela)
  const APIS: Api_Entry[] = [
    {
      kind: 'currency',
      icon: <Icon.Wallet />,
      syncs: (catalog, format) => {
        const ratesAt = catalog?.ratesUpdatedAt ?? null;
        // A hora do último teste serve de "agora": não muda a cada render
        const stale =
          ratesAt !== null && health
            ? new Date(health.currency.checkedAt).getTime() - new Date(ratesAt).getTime() > STALE_RATES_MS
            : false;
        return [
          { target: 'currencies', detail: catalog ? t('adminApis.currenciesDetail', { count: catalog.currencies }) : '—' },
          {
            target: 'rates',
            detail: ratesAt
              ? t(stale ? 'adminApis.ratesDetailStale' : 'adminApis.ratesDetail', { date: format(ratesAt) })
              : t('adminApis.ratesNever'),
            warn: stale || !ratesAt,
          },
        ];
      },
    },
    {
      kind: 'country',
      icon: <Icon.World />,
      syncs: (catalog) => [
        { target: 'countries', detail: catalog ? t('adminApis.countriesDetail', { count: catalog.countries }) : '—' },
      ],
    },
    {
      kind: 'propfirm',
      icon: <Icon.Candles />,
      // As prop firms vão para as plataformas, em fundo e com o comparar
      syncs: () => [],
      extra: (format) => (
        <Prop_Firms_Data formatDate={format} />
      ),
    },
    {
      kind: 'exchange',
      icon: <Icon.Trend />,
      syncs: (catalog, format) => [
        {
          target: 'exchanges',
          detail:
            catalog && catalog.exchanges > 0
              ? t('adminApis.exchangesDetail', {
                  count: catalog.exchanges,
                  date: catalog.exchangesSyncedAt ? format(catalog.exchangesSyncedAt) : '—',
                })
              : t('adminApis.exchangesNever'),
          warn: !catalog || catalog.exchanges === 0,
        },
      ],
      extra: () => <Exchanges_Data />,
    },
  ];

  // O que se escreveu, ligado às definições em que se escreveu: quando chegam
  // outras (ao abrir, depois de gravar) os campos voltam ao que está guardado
  const [draft, setDraft] = useState<{ base: ApiSettings; values: Api_Values } | null>(null);
  const values: Api_Values | null = settings
    ? draft?.base === settings
      ? draft.values
      : {
          currency: fromSaved(settings, 'currency'),
          country: fromSaved(settings, 'country'),
          propfirm: fromSaved(settings, 'propfirm'),
          exchange: fromSaved(settings, 'exchange'),
        }
    : null;
  const setKind = (kind: Api_Kind, next: ApiSettingInput) => {
    if (settings && values) setDraft({ base: settings, values: { ...values, [kind]: next } });
  };

  // Grava só a API do cartão; as outras vão como estão guardadas (sem chave = fica a mesma)
  const saveKind = async (kind: Api_Kind) => {
    if (!settings || !values) return;
    const payload = {
      currency: fromSaved(settings, 'currency'),
      country: fromSaved(settings, 'country'),
      propfirm: fromSaved(settings, 'propfirm'),
      exchange: fromSaved(settings, 'exchange'),
    };
    payload[kind] = values[kind];
    setSavingKind(kind);
    const ok = await save(payload);
    setSavingKind(null);
    if (!ok) return;
    // As exchanges vêm logo: gravar a API já as traz para as plataformas
    if (kind === 'exchange') await runSync('exchanges');
    else check();
  };

  async function runSync(target: SyncTarget) {
    const result = await sync(target);
    // As moedas novas têm de chegar aos seletores da app sem recarregar a página
    if (result.ok && (target === 'currencies' || target === 'rates')) refreshCurrencies();
    if (result.ok) check();
  }

  // O resumo conta as APIs que houver, não só duas
  const states = health ? APIS.map((api) => health[api.kind].status) : [];
  const count = (...statuses: string[]) => states.filter((status) => statuses.includes(status)).length;

  return (
    <div className="Admin_Page Apis">
      <div className="Page_Head">
        <div>
          <h1>{t('adminApis.title')}</h1>
          <div className="Page_Head_Sub">{t('adminApis.subtitle')}</div>
        </div>
        <div className="Page_Head_Actions">
          <Simple_Button
            text={checking ? t('adminApis.testing') : t('adminApis.test')}
            onClick={check}
            disabled={checking}
            variant="Ghost"
            auto
          />
        </div>
      </div>

      <div className="Apis_Stats">
        <div className="Card Apis_Stat">
          <span className="Eyebrow">{t('adminApis.statOnline')}</span>
          <span className={`Apis_Stat_Value Num ${health ? (count('online') === APIS.length ? 'Ok' : 'Warn') : ''}`}>
            {health ? `${count('online')}/${APIS.length}` : '—'}
          </span>
        </div>
        <div className="Card Apis_Stat">
          <span className="Eyebrow">{t('adminApis.statFailing')}</span>
          <span className={`Apis_Stat_Value Num ${health && count('key_rejected', 'offline') > 0 ? 'Bad' : ''}`}>
            {health ? count('key_rejected', 'offline') : '—'}
          </span>
        </div>
        <div className="Card Apis_Stat">
          <span className="Eyebrow">{t('adminApis.statUnconfigured')}</span>
          <span className={`Apis_Stat_Value Num ${health && count('unconfigured') > 0 ? 'Warn' : ''}`}>
            {health ? count('unconfigured') : '—'}
          </span>
        </div>
        <div className="Card Apis_Stat">
          <span className="Eyebrow">{t('adminApis.statLastCheck')}</span>
          <span className="Apis_Stat_Value Num">{health ? formatDateTime(health.currency.checkedAt) : '—'}</span>
        </div>
      </div>

      {loading || !settings || !values ? (
        <div className="Card Admin_Block Full">
          <span className="Admin_Message">{t('common.loading')}</span>
        </div>
      ) : (
        <div className="Apis_List">
          {APIS.map((api) => (
            <Api_Card
              key={api.kind}
              kind={api.kind}
              icon={api.icon}
              saved={settings[api.kind]}
              values={values[api.kind]}
              providers={settings.providers[api.kind]}
              health={health?.[api.kind] ?? null}
              checking={checking}
              saving={saving && savingKind === api.kind}
              running={running}
              results={results}
              syncs={api.syncs(health?.catalog, formatDateTime)}
              onChange={(next) => setKind(api.kind, next)}
              onReset={() => setKind(api.kind, fromSaved(settings, api.kind))}
              onSave={() => saveKind(api.kind)}
              onSync={runSync}
              extra={api.extra?.(formatDateTime)}
            />
          ))}
          {/* As APIs com várias chaves (usadas por ordem): os preços das motas */}
          <Api_Keys_Card kind="motorcycle_prices" icon={<Icon.Search />} />
        </div>
      )}
    </div>
  );
};

export default Apis;
