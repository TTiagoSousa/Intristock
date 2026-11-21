import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import http from '../../../../../../Service/httpService';
import { End_Points } from '../../../../../../Service/endPoints';
import { useBreadcrumbSegmentLabel } from '../../../../../../Contexts/Breadcrumb_Context';
import { getErrorMessage } from '../../../../../../Hooks/useAsyncRequest';
import '../../Admin.scss';
import '../Apis.scss';
import './Prop_Firms.scss';
import { localeOf } from '../../../../../../utils/locale';

// Um plano da tabela `PlatformPlan` (os decimais chegam como texto)
interface Prop_Firm_Plan {
  id: string;
  step: string | null;
  name: string | null;
  accountSize: string | null;
  price: string | null;
  currency: string | null;
  activationFee: string | null;
  profitTargetPct: string | null;
  maxDailyLossPct: string | null;
  maxTotalDrawdownPct: string | null;
  drawdownModel: string | null;
  minTradeDays: number | null;
  consistencyPct: string | null;
  profitSplitPct: string | null;
  stale: boolean;
}

interface Prop_Firm {
  id: string;
  name: string;
  website: string | null;
  logo: string | null;
  isActive: boolean;
  source: string;
  externalId: string | null;
  syncedAt: string | null;
  plans: Prop_Firm_Plan[];
  propFirm: Prop_Firm_Detail | null;
}

// A linha da `PropFirmDetail` (os decimais chegam como texto)
interface Prop_Firm_Detail {
  assetType: string | null;
  established: string | null;
  countryName: string | null;
  score: string | null;
  safetyGrade: string | null;
  trustpilotRating: string | null;
  trustpilotReviews: number | null;
  profitSplit: string | null;
  payoutFrequency: string | null;
  dailyDrawdown: string | null;
  tradingPlatforms: string[];
  payoutMethods: string[];
  firstPayoutDays: number | null;
  payoutProcessing: string | null;
  newsTrading: boolean | null;
  weekendHolding: boolean | null;
  overnightHolding: boolean | null;
  eaAllowed: boolean | null;
  copyTrading: boolean | null;
  hedging: boolean | null;
  martingale: boolean | null;
  scalping: boolean | null;
  stopLossRequired: boolean | null;
  resetAllowed: boolean | null;
  consistencyChallenge: string | null;
  consistencyFunded: string | null;
  allowedInstruments: string | null;
  prohibitedStrategies: string | null;
  detailsSyncedAt: string | null;
}

// As regras sim/não, pela ordem em que se mostram: coluna → chave da tradução
const YES_NO_RULES: [keyof Prop_Firm_Detail, string][] = [
  ['newsTrading', 'news_trading_allowed'],
  ['weekendHolding', 'weekend_holding_allowed'],
  ['overnightHolding', 'overnight_holding_allowed'],
  ['eaAllowed', 'ea_automation_allowed'],
  ['copyTrading', 'copy_trading_allowed'],
  ['hedging', 'hedging_allowed'],
  ['martingale', 'martingale_allowed'],
  ['scalping', 'scalping_allowed'],
  ['stopLossRequired', 'stop_loss_required'],
  ['resetAllowed', 'reset_allowed'],
];
// As regras em texto (uma linha inteira cada)
const TEXT_RULES: [keyof Prop_Firm_Detail, string][] = [
  ['consistencyChallenge', 'consistency_rule_challenge'],
  ['consistencyFunded', 'consistency_rule_funded'],
  ['allowedInstruments', 'allowed_instruments'],
  ['prohibitedStrategies', 'prohibited_strategies'],
];

const pct = (value: string | null) => (value === null ? '—' : `${Number(value)}%`);
const amount = (value: string | null, locale: string) => (value === null ? '—' : Number(value).toLocaleString(locale));

/**
 * Uma prop firm como está na base: o resumo, os planos (tabela `PlatformPlan`),
 * as regras, os payouts e de onde veio. Não vai à API.
 */
const Prop_Firm_Page = () => {
  const { platformId } = useParams();
  const { t, i18n } = useTranslation();
  const [firm, setFirm] = useState<Prop_Firm | null>(null);
  const [error, setError] = useState<string | null>(null);

  useBreadcrumbSegmentLabel(platformId, firm?.name);

  useEffect(() => {
    if (!platformId) return;
    http
      .get<Prop_Firm>(End_Points.Platform_Endpoint(platformId))
      .then((response) => setFirm(response.data))
      .catch((err) => setError(getErrorMessage(err)));
  }, [platformId]);

  const locale = localeOf(i18n.language);
  const formatDate = (iso: string) => new Date(iso).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' });

  const back = (
    <Link to="/Settings/Admin/Apis/prop-firms" className="Prop_Firms_Back">
      ← {t('adminApis.propFirms.pageTitle')}
    </Link>
  );

  if (error || !firm) {
    return (
      <div className="Admin_Page Prop_Firms_Page">
        {back}
        <span className={`Admin_Message ${error ? 'Bad' : ''}`}>{error ?? t('common.loading')}</span>
      </div>
    );
  }

  const details: Partial<Prop_Firm_Detail> = firm.propFirm ?? {};
  // Sem a ficha (só o resumo da lista) ainda não há regras nem payouts
  const rules = details.detailsSyncedAt ? details : null;
  const yesNo = (value: unknown) =>
    value === true ? t('common.yes') : value === false ? t('common.no') : t('adminApis.propFirms.notDocumented');

  return (
    <div className="Admin_Page Prop_Firms_Page">
      {back}

      <div className="Page_Head">
        <div className="Prop_Firm_Head">
          {firm.logo && <img className="Prop_Firm_Logo" src={firm.logo} alt="" />}
          <div>
            <h1>{firm.name}</h1>
            <div className="Page_Head_Sub">
              {[details.assetType, details.countryName, details.established, firm.isActive ? null : t('adminApis.propFirms.inactive')]
                .filter(Boolean)
                .join(' · ')}
            </div>
          </div>
        </div>
        {firm.website && (
          <div className="Page_Head_Actions">
            <a className="Prop_Firm_Site" href={firm.website} target="_blank" rel="noreferrer">
              {t('adminApis.propFirms.openSite')}
            </a>
          </div>
        )}
      </div>

      <div className="Apis_Stats">
        <div className="Card Apis_Stat">
          <span className="Eyebrow">{t('adminApis.propFirms.fields.score')}</span>
          <span className="Apis_Stat_Value Num">{details.score != null ? `${Number(details.score)}/10` : '—'}</span>
        </div>
        <div className="Card Apis_Stat">
          <span className="Eyebrow">{t('adminApis.propFirms.fields.safetyGrade')}</span>
          <span className="Apis_Stat_Value Num">{details.safetyGrade ?? '—'}</span>
        </div>
        <div className="Card Apis_Stat">
          <span className="Eyebrow">Trustpilot</span>
          <span className="Apis_Stat_Value Num">
            {details.trustpilotRating != null
              ? `${Number(details.trustpilotRating)} · ${t('adminApis.propFirms.reviews', { count: details.trustpilotReviews ?? 0 })}`
              : '—'}
          </span>
        </div>
        <div className="Card Apis_Stat">
          <span className="Eyebrow">{t('adminApis.propFirms.plansTitle')}</span>
          <span className="Apis_Stat_Value Num">{firm.plans.length}</span>
        </div>
      </div>

      <div className="Card Admin_Block Full">
        <div className="Card_Header">
          <div className="Card_Header_Text">
            <span className="Card_Title">{t('adminApis.propFirms.plansTitle')}</span>
            <span className="Card_Subtitle">{t('adminApis.propFirms.plansHint')}</span>
          </div>
        </div>
        <div className="Admin_Block_Body">
          {!details.detailsSyncedAt ? (
            <span className="Admin_Muted_Cell">{t('adminApis.propFirms.noDetails')}</span>
          ) : firm.plans.length === 0 ? (
            <span className="Admin_Muted_Cell">{t('adminApis.propFirms.noPlans')}</span>
          ) : (
            <div className="Table_Wrap">
              <table className="Table">
                <thead>
                  <tr>
                    <th>{t('adminApis.propFirms.planStep')}</th>
                    <th className="Right">{t('adminApis.propFirms.planSize')}</th>
                    <th className="Right">{t('adminApis.propFirms.planPrice')}</th>
                    <th className="Right">{t('adminApis.propFirms.planTarget')}</th>
                    <th className="Right">{t('adminApis.propFirms.planDaily')}</th>
                    <th className="Right">{t('adminApis.propFirms.planMax')}</th>
                    <th>{t('adminApis.propFirms.planModel')}</th>
                    <th className="Right">{t('adminApis.propFirms.planDays')}</th>
                    <th className="Right">{t('adminApis.propFirms.planConsistency')}</th>
                    <th className="Right">{t('adminApis.propFirms.planSplit')}</th>
                  </tr>
                </thead>
                <tbody>
                  {firm.plans.map((plan) => (
                    <tr key={plan.id}>
                      <td>
                        {plan.step ?? '—'}
                        {plan.name && <div className="Admin_Muted_Cell">{plan.name}</div>}
                      </td>
                      <td className="Num Right">{amount(plan.accountSize, locale)}</td>
                      <td className="Num Right Admin_Nowrap">
                        {plan.price === null ? '—' : `${amount(plan.price, locale)} ${plan.currency ?? ''}`.trim()}
                      </td>
                      <td className="Num Right">{pct(plan.profitTargetPct)}</td>
                      <td className="Num Right">{pct(plan.maxDailyLossPct)}</td>
                      <td className="Num Right">{pct(plan.maxTotalDrawdownPct)}</td>
                      <td>{plan.drawdownModel ?? '—'}</td>
                      <td className="Num Right">{plan.minTradeDays ?? '—'}</td>
                      <td className="Num Right">{pct(plan.consistencyPct)}</td>
                      <td className="Num Right">{pct(plan.profitSplitPct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="Prop_Firm_Columns">
        <div className="Card Admin_Block Full">
          <div className="Card_Header">
            <div className="Card_Header_Text">
              <span className="Card_Title">{t('adminApis.propFirms.rulesTitle')}</span>
            </div>
          </div>
          <div className="Admin_Block_Body">
            {!rules ? (
              <span className="Admin_Muted_Cell">{t('adminApis.propFirms.noDetails')}</span>
            ) : (
              <div className="Prop_Firm_Rules">
                {YES_NO_RULES.map(([column, label]) => (
                  <div key={column} className="Prop_Firm_Rule">
                    <span>{t(`adminApis.propFirms.rules.${label}`)}</span>
                    <span className="Num">{yesNo(rules[column])}</span>
                  </div>
                ))}
                {TEXT_RULES.map(
                  ([column, label]) =>
                    typeof rules[column] === 'string' && (
                      <div key={column} className="Prop_Firm_Rule Text">
                        <span>{t(`adminApis.propFirms.rules.${label}`)}</span>
                        <span>{rules[column] as string}</span>
                      </div>
                    ),
                )}
              </div>
            )}
          </div>
        </div>

        <div className="Card Admin_Block Full">
          <div className="Card_Header">
            <div className="Card_Header_Text">
              <span className="Card_Title">{t('adminApis.propFirms.payoutTitle')}</span>
            </div>
          </div>
          <div className="Admin_Block_Body Prop_Firm_Facts">
            <div>
              <span className="Eyebrow">{t('adminApis.propFirms.fields.profitSplit')}</span>
              <span>{details.profitSplit ?? '—'}</span>
            </div>
            <div>
              <span className="Eyebrow">{t('adminApis.propFirms.payoutFrequency')}</span>
              <span>{details.payoutFrequency ?? '—'}</span>
            </div>
            <div>
              <span className="Eyebrow">{t('adminApis.propFirms.firstPayoutLabel')}</span>
              <span>
                {details.firstPayoutDays != null
                  ? t('adminApis.propFirms.firstPayout', { days: details.firstPayoutDays })
                  : '—'}
              </span>
            </div>
            <div>
              <span className="Eyebrow">{t('adminApis.propFirms.processing')}</span>
              <span>{details.payoutProcessing ?? '—'}</span>
            </div>
            <div>
              <span className="Eyebrow">{t('adminApis.propFirms.payoutMethods')}</span>
              <span>{details.payoutMethods?.join(', ') || '—'}</span>
            </div>
            <div>
              <span className="Eyebrow">{t('adminApis.propFirms.tradingPlatforms')}</span>
              <span>{details.tradingPlatforms?.join(', ') || '—'}</span>
            </div>
            <div>
              <span className="Eyebrow">{t('adminApis.propFirms.dailyDrawdown')}</span>
              <span>{details.dailyDrawdown ?? '—'}</span>
            </div>
            <div>
              <span className="Eyebrow">{t('adminApis.propFirms.origin')}</span>
              <span>
                {t(`adminPlatforms.sources.${firm.source}`, { defaultValue: firm.source })}
                {firm.externalId ? ` · #${firm.externalId}` : ''}
                {details.detailsSyncedAt ? ` · ${formatDate(details.detailsSyncedAt)}` : ''}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Prop_Firm_Page;
