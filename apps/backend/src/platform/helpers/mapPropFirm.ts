import { PropFirmDetail, PropFirmListItem } from './propFirmMapClient';

export const PROPFIRM_SOURCE = 'propfirmmap';
export const PROP_FIRM_TYPE = 'prop_firm';

/** O resumo de uma prop firm (vem da lista): as colunas da `PropFirmDetail` que ela dá. */
export interface PropFirmSummary {
  assetType: string | null;
  established: string | null;
  countryName: string | null;
  score: number | null;
  safetyGrade: string | null;
  trustpilotRating: number | null;
  trustpilotReviews: number | null;
  trustpilotSuspended: boolean;
  directFunding: boolean | null;
  profitSplit: string | null;
  payoutFrequency: string | null;
  dailyDrawdown: string | null;
  tradingPlatforms: string[];
}

/** O que vem na ficha (as regras e os payouts): o resto das colunas da `PropFirmDetail`. */
export interface PropFirmRules {
  payoutMethods: string[];
  firstPayoutDays: number | null;
  payoutProcessing: string | null;
  payoutOnDemand: boolean | null;
  minWithdrawal: number | null;
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
  rulesSourceUrl: string | null;
  rulesVerifiedAt: Date | null;
}

/** Um plano (desafio) no básico: tamanho, preço e as regras com número (tabela `PlatformPlan`). */
export interface PropFirmPlan {
  externalKey: string;
  step: string | null;
  name: string | null;
  accountSize: number | null;
  price: number | null;
  currency: string | null;
  activationFee: number | null;
  profitTargetPct: number | null;
  maxDailyLossPct: number | null;
  maxTotalDrawdownPct: number | null;
  drawdownModel: string | null;
  minTradeDays: number | null;
  consistencyPct: number | null;
  profitSplitPct: number | null;
  // `unverified` / `stale`: a PropFirmMap avisa quando o plano não foi confirmado há pouco
  status: string | null;
  stale: boolean;
}

const num = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};
const int = (value: unknown): number | null => {
  const n = num(value);
  return n === null ? null : Math.round(n);
};
const str = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;
const bool = (value: unknown): boolean | null =>
  typeof value === 'boolean' ? value : null;
const date = (value: unknown): Date | null => {
  if (typeof value !== 'string') return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/** Os campos da tabela base e o resumo, a partir de uma linha da lista. */
export function mapPropFirmBase(firm: PropFirmListItem) {
  const summary: PropFirmSummary = {
    assetType: str(firm.asset_type),
    established: str(firm.established),
    countryName: str(firm.country),
    score: num(firm.propfirmmap_score),
    safetyGrade: str(firm.safety_grade),
    trustpilotRating: num(firm.trustpilot?.rating),
    trustpilotReviews: int(firm.trustpilot?.review_count),
    trustpilotSuspended: Boolean(firm.trustpilot?.suspended),
    directFunding: firm.direct_funding ?? null,
    profitSplit: str(firm.profit_split),
    payoutFrequency: str(firm.payout_frequency),
    dailyDrawdown: str(firm.daily_drawdown),
    tradingPlatforms: firm.platforms ?? [],
  };
  return {
    externalId: String(firm.id),
    slug: firm.slug,
    name: firm.name.trim(),
    website: str(firm.url),
    logo: str(firm.logo_url),
    summary,
  };
}

/** O resto, a partir da ficha: as regras e os payouts (colunas) e os planos (tabela deles). */
export function mapPropFirmDetail(firm: PropFirmDetail): {
  rules: PropFirmRules;
  plans: PropFirmPlan[];
} {
  const trading = firm.rules?.trading_rules ?? {};
  const payout = firm.rules?.payout_rules ?? {};

  const rules: PropFirmRules = {
    payoutMethods: firm.payout_methods ?? [],
    firstPayoutDays: int(payout.first_payout_days),
    payoutProcessing: str(payout.processing_time),
    payoutOnDemand: bool(payout.on_demand),
    minWithdrawal: num(payout.min_withdrawal),
    newsTrading: bool(trading.news_trading_allowed),
    weekendHolding: bool(trading.weekend_holding_allowed),
    overnightHolding: bool(trading.overnight_holding_allowed),
    eaAllowed: bool(trading.ea_automation_allowed),
    copyTrading: bool(trading.copy_trading_allowed),
    hedging: bool(trading.hedging_allowed),
    martingale: bool(trading.martingale_allowed),
    scalping: bool(trading.scalping_allowed),
    stopLossRequired: bool(trading.stop_loss_required),
    resetAllowed: bool(trading.reset_allowed),
    consistencyChallenge: str(trading.consistency_rule_challenge),
    consistencyFunded: str(trading.consistency_rule_funded),
    allowedInstruments: str(trading.allowed_instruments),
    prohibitedStrategies: str(trading.prohibited_strategies),
    rulesSourceUrl: str(trading.source_url),
    rulesVerifiedAt: date(trading.verified_at),
  };

  const plans: PropFirmPlan[] = (firm.challenges ?? []).map((c, index) => ({
    // O id do plano na API (a `key` dela repete-se entre planos diferentes da mesma firma)
    externalKey:
      c.id !== undefined && c.id !== null
        ? String(c.id as number)
        : `${firm.slug}:${index}`,
    step: str(c.step),
    name: str(c.name),
    accountSize: num(c.account_size_numeric),
    price: num(c.price_numeric),
    currency: str(c.currency),
    activationFee: num(c.activation_fee_numeric),
    profitTargetPct: num(c.profit_target_pct),
    maxDailyLossPct: num(c.max_daily_loss_pct),
    maxTotalDrawdownPct: num(c.max_total_drawdown_pct),
    drawdownModel: str(c.drawdown_model),
    minTradeDays: int(c.min_trade_days),
    consistencyPct: num(c.consistency_pct),
    profitSplitPct: num(c.profit_split_pct),
    status: str(c.status),
    stale: Boolean(c.stale),
  }));

  return { rules, plans };
}
