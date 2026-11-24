import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Popover_Shell from '../../../../Components/Popover_Shell/Popover_Shell';
import Confirm_Popover from '../../../../Components/Confirm_Popover/Confirm_Popover';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import { getErrorMessage } from '../../../../Hooks/useAsyncRequest';
import {
  dataConnectionsApi,
  useDataConnectionFields,
  useDataConnections,
  type Data_Connection,
  type Data_Table,
} from '../../../../Hooks/Companies/useCompanyData';
import { localeOf } from '../../../../utils/locale';
import { relativeTime } from './leadHelpers';
import './Leads.scss';

const NEW_TABLE = '__new';
const NO_COLUMN = '__none';
const SYNC_HOURS = [1, 24, 168] as const;
// Os campos que uma tabela nova traz já escolhidos (o número da encomenda vai sempre)
const DEFAULT_FIELDS = [
  'createdAt',
  'financialStatus',
  'fulfillmentStatus',
  'totalPrice',
  'paymentGateways',
  'shippingName',
  'shippingPhone',
  'shippingAddress1',
  'shippingZip',
  'shippingCity',
  'addressValidation',
  'addressError',
  'items',
  'id',
];

/**
 * Uma ligação nova à Shopify: a loja e a chave (vê-se logo se servem), depois para onde vão as encomendas — uma
 * tabela nova com os campos escolhidos, ou uma que já existe, campo a campo — e de quanto em quanto tempo.
 */
const Connection_Form = ({ companyId, tables, onClose, onCreated }: { companyId: string; tables: Data_Table[]; onClose: () => void; onCreated: () => void }) => {
  const { t } = useTranslation();
  const { data: fieldsData } = useDataConnectionFields(companyId);
  const fields = fieldsData?.shopify ?? [];
  const [shop, setShop] = useState('');
  const [token, setToken] = useState('');
  const [checked, setChecked] = useState<{ name: string; currencyCode: string } | null>(null);
  const [target, setTarget] = useState(NEW_TABLE);
  const [newName, setNewName] = useState(t('callCenter.connShopifyTableName'));
  const [picked, setPicked] = useState<string[]>(DEFAULT_FIELDS);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [hours, setHours] = useState<number>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const table = tables.find((tb) => tb.id === target) ?? null;
  const usable = tables.filter((tb) => tb.keyColumn);
  const keyMapped = table ? Object.values(mapping).includes(table.keyColumn ?? '') : true;
  const ready = Boolean(checked) && !busy && (target === NEW_TABLE ? Boolean(newName.trim()) : keyMapped);

  const check = async () => {
    setBusy(true);
    setError(null);
    try {
      setChecked(await dataConnectionsApi.check(companyId, { provider: 'shopify', shop, token }));
    } catch (reason) {
      setChecked(null);
      setError(getErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      await dataConnectionsApi.create(companyId, {
        provider: 'shopify',
        shop,
        token,
        syncEveryHours: hours,
        ...(target === NEW_TABLE ? { newTableName: newName.trim(), fields: picked } : { tableId: target, mapping }),
      });
      onCreated();
    } catch (reason) {
      setError(getErrorMessage(reason));
      setBusy(false);
    }
  };

  return (
    <Popover_Shell onClose={onClose} className="Wide" dirty={Boolean(shop || token)} closeOnEscape={!busy}>
      <div className="Popover_Header">
        <div className="Popover_Header_Text">
          <span className="Popover_Title">{t('callCenter.connNewTitle')}</span>
          <span className="Popover_Subtitle">{t('callCenter.connNewHint')}</span>
        </div>
        <button type="button" className="Popover_Close" onClick={onClose} aria-label={t('common.cancel')}>
          ×
        </button>
      </div>

      <div className="Popover_Body Single_Column Leads_Rules">
        <div className="Leads_Settings_Pair">
          <div className="Form_Field">
            <label htmlFor="conn-shop">{t('callCenter.connShop')}</label>
            <Global_Input
              id="conn-shop"
              value={shop}
              maxLength={120}
              autoComplete="off"
              placeholder="a-tua-loja.myshopify.com"
              onChange={(event) => {
                setShop(event.target.value);
                setChecked(null);
              }}
            />
          </div>
          <div className="Form_Field">
            <label htmlFor="conn-token">{t('callCenter.connToken')}</label>
            <Global_Input
              id="conn-token"
              type="password"
              value={token}
              maxLength={300}
              autoComplete="off"
              placeholder="shpat_…"
              onChange={(event) => {
                setToken(event.target.value);
                setChecked(null);
              }}
            />
          </div>
        </div>
        <span className="Field_Hint">{t('callCenter.connTokenHint')}</span>
        <div className="Call_Center_Head_Actions Conn_Check">
          <Simple_Button text={t('callCenter.connCheck')} variant="Ghost" small auto disabled={!shop.trim() || !token.trim() || busy} onClick={() => void check()} />
          {checked && <span className="Call_Center_Message Good">{t('callCenter.connChecked', { name: checked.name, currency: checked.currencyCode })}</span>}
        </div>

        {checked && (
          <>
            <div className="Leads_Settings_Pair">
              <div className="Form_Field">
                <label htmlFor="conn-target">{t('callCenter.connTarget')}</label>
                <Global_Dropdown
                  id="conn-target"
                  value={target}
                  onChange={(next) => {
                    setTarget(String(next));
                    setMapping({});
                  }}
                  options={[{ value: NEW_TABLE, label: t('callCenter.connNewTable') }, ...usable.map((tb) => ({ value: tb.id, label: tb.name }))]}
                />
              </div>
              <div className="Form_Field">
                <label htmlFor="conn-hours">{t('callCenter.connEvery')}</label>
                <Global_Dropdown
                  id="conn-hours"
                  value={hours}
                  onChange={(next) => setHours(Number(next))}
                  options={SYNC_HOURS.map((h) => ({ value: h, label: t(`callCenter.connEvery_${h}`) }))}
                />
              </div>
            </div>

            {target === NEW_TABLE ? (
              <>
                <div className="Form_Field">
                  <label htmlFor="conn-new-name">{t('callCenter.connNewTableName')}</label>
                  <Global_Input id="conn-new-name" value={newName} maxLength={80} autoComplete="off" onChange={(event) => setNewName(event.target.value)} />
                </div>
                <fieldset className="Leads_Rule_Stages">
                  <legend className="Leads_Rule_Step_Title">{t('callCenter.connFields')}</legend>
                  <span className="Field_Hint">{t('callCenter.connFieldsHint')}</span>
                  <div className="Leads_Rule_Stage_List Conn_Fields">
                    {fields.map((field) => (
                      <label key={field.field} className="Call_Center_Check">
                        <input
                          type="checkbox"
                          checked={field.field === 'name' || picked.includes(field.field)}
                          disabled={field.field === 'name'}
                          onChange={() =>
                            setPicked((current) => (current.includes(field.field) ? current.filter((f) => f !== field.field) : [...current, field.field]))
                          }
                        />
                        <span>{field.label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </>
            ) : (
              table && (
                <div className="Leads_Rule_Step">
                  <span className="Leads_Rule_Step_Title">{t('callCenter.connMapping')}</span>
                  <span className="Field_Hint">
                    {t('callCenter.connMappingHint', { column: table.columns.find((c) => c.key === table.keyColumn)?.label ?? table.keyColumn })}
                  </span>
                  <div className="Conn_Mapping">
                    {fields.map((field) => (
                      <div key={field.field} className="Conn_Mapping_Row">
                        <label htmlFor={`conn-map-${field.field}`}>{field.label}</label>
                        <Global_Dropdown
                          id={`conn-map-${field.field}`}
                          value={mapping[field.field] ?? NO_COLUMN}
                          onChange={(next) =>
                            setMapping((current) => {
                              const copy = { ...current };
                              if (next === NO_COLUMN) delete copy[field.field];
                              else copy[field.field] = String(next);
                              return copy;
                            })
                          }
                          options={[{ value: NO_COLUMN, label: t('callCenter.connNoColumn') }, ...table.columns.map((c) => ({ value: c.key, label: c.label }))]}
                        />
                      </div>
                    ))}
                  </div>
                  {!keyMapped && <span className="Call_Center_Message Bad">{t('callCenter.connNeedsKey')}</span>}
                </div>
              )
            )}
          </>
        )}
        {error && <span className="Call_Center_Message Bad">{error}</span>}
      </div>

      <div className="Popover_Footer">
        <div className="Form_Action">
          <Simple_Button text={t('common.cancel')} onClick={onClose} variant="Ghost" disabled={busy} />
        </div>
        <div className="Form_Action">
          <Simple_Button text={t('callCenter.connCreate')} onClick={() => void create()} disabled={!ready} />
        </div>
      </div>
    </Popover_Shell>
  );
};

/**
 * As ligações às APIs nos Dados (por agora a Shopify): cada uma enche uma tabela pela coluna chave, sozinha no
 * intervalo dela. Daqui sincroniza-se já, pausa-se, muda-se o intervalo ou apaga-se (a tabela fica).
 */
const Data_Connections = ({ companyId, tables, canManage, onChanged }: { companyId: string; tables: Data_Table[]; canManage: boolean; onChanged: () => void }) => {
  const { t, i18n } = useTranslation();
  const locale = localeOf(i18n.language);
  const { data: connections, error, reload } = useDataConnections(companyId);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Data_Connection | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [now] = useState(() => new Date());

  const run = async (id: string, action: () => Promise<unknown>) => {
    setBusy(id);
    setActionError(null);
    setNotice(null);
    try {
      const result = await action();
      if (result && typeof result === 'object' && 'orders' in result) {
        const r = result as { orders: number; created: number; updated: number };
        setNotice(t('callCenter.connSynced', { orders: r.orders, created: r.created, updated: r.updated }));
      }
      reload();
      onChanged();
    } catch (reason) {
      setActionError(getErrorMessage(reason));
      reload();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="Card Call_Center_Card">
      <div className="Card_Header">
        <div className="Card_Header_Text">
          <span className="Card_Title">{t('callCenter.connTitle')}</span>
          <span className="Card_Subtitle">{t('callCenter.connSubtitle')}</span>
        </div>
        {canManage && (
          <div className="Conn_Head_Action">
            <Simple_Button text={t('callCenter.connNew')} onClick={() => setCreating(true)} variant="Ghost" small auto />
          </div>
        )}
      </div>
      <div className="Call_Center_Body">
        {error && !connections && <span className="Call_Center_Message Bad">{error}</span>}
        {connections && connections.length === 0 && <span className="Call_Center_Sub">{t('callCenter.connEmpty')}</span>}
        {connections && connections.length > 0 && (
          <div className="Table_Wrap">
            <table className="Table">
              <thead>
                <tr>
                  <th>{t('callCenter.connShop')}</th>
                  <th>{t('callCenter.connTable')}</th>
                  <th>{t('callCenter.connState')}</th>
                  <th>{t('callCenter.connLast')}</th>
                  <th>{t('callCenter.connEvery')}</th>
                  {canManage && <th />}
                </tr>
              </thead>
              <tbody>
                {connections.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <span className="Call_Center_Strong">Shopify</span>
                      <div className="Call_Center_Sub">{c.shop}</div>
                    </td>
                    <td>{c.tableName ?? '—'}</td>
                    <td>
                      <span className={`Pill${c.status === 'error' ? ' Warn' : ''}`}>{t(`callCenter.connStatus_${c.syncing ? 'syncing' : c.status}`)}</span>
                      {c.lastError && <div className="Call_Center_Sub Conn_Error">{c.lastError}</div>}
                    </td>
                    <td className="Num">{c.syncedAt ? relativeTime(c.syncedAt, now, locale) : t('callCenter.connNever')}</td>
                    <td>
                      {canManage ? (
                        <div className="Conn_Every">
                          <label htmlFor={`conn-every-${c.id}`} className="Leads_Visually_Hidden">{t('callCenter.connEvery')}</label>
                          <Global_Dropdown
                            id={`conn-every-${c.id}`}
                            value={c.syncEveryHours}
                            disabled={busy === c.id}
                            onChange={(next) => run(c.id, () => dataConnectionsApi.update(companyId, c.id, { syncEveryHours: Number(next) }))}
                            options={SYNC_HOURS.map((h) => ({ value: h, label: t(`callCenter.connEvery_${h}`) }))}
                          />
                        </div>
                      ) : (
                        t(`callCenter.connEvery_${c.syncEveryHours}`)
                      )}
                    </td>
                    {canManage && (
                      <td>
                        <div className="Call_Center_Row_Actions">
                          <Simple_Button
                            text={t('callCenter.connSyncNow')}
                            variant="Ghost"
                            small
                            auto
                            disabled={busy === c.id || c.status === 'paused'}
                            onClick={() => run(c.id, () => dataConnectionsApi.sync(companyId, c.id))}
                          />
                          <Simple_Button
                            text={c.status === 'paused' ? t('callCenter.connResume') : t('callCenter.connPause')}
                            variant="Ghost"
                            small
                            auto
                            disabled={busy === c.id}
                            onClick={() => run(c.id, () => dataConnectionsApi.update(companyId, c.id, { status: c.status === 'paused' ? 'active' : 'paused' }))}
                          />
                          <button type="button" className="Call_Center_Text_Button Leads_Danger" disabled={busy === c.id} onClick={() => setDeleting(c)}>
                            {t('common.delete')}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {notice && <span className="Call_Center_Message Good">{notice}</span>}
        {actionError && <span className="Call_Center_Message Bad">{actionError}</span>}
      </div>

      {creating && (
        <Connection_Form
          companyId={companyId}
          tables={tables}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            reload();
            onChanged();
          }}
        />
      )}
      {deleting && (
        <Confirm_Popover
          title={t('callCenter.connDeleteTitle')}
          message={t('callCenter.connDeleteText', { shop: deleting.shop, table: deleting.tableName ?? '—' })}
          confirmText={t('common.delete')}
          danger
          busy={busy === deleting.id}
          onClose={() => setDeleting(null)}
          onConfirm={() => run(deleting.id, () => dataConnectionsApi.remove(companyId, deleting.id)).then(() => setDeleting(null))}
        />
      )}
    </div>
  );
};

export default Data_Connections;
