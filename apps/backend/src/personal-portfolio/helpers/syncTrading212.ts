import { decryptSecret, secretContext } from 'src/utils/crypto/secret-box';
import { BrokerConnection, PersonalPortfolio } from 'src/generated/prisma/client/client';
import { StockPriceService } from 'src/market-data/stock-price.service';
import { PrismaPersonalPortfolioRepository } from '../repositories/prisma/prisma-personal-portfolio-repository';
import {
  ImportedTransactionData,
  PortfolioCurrency,
} from '../repositories/personal-portfolio-repository';
import {
  fetchTrading212CashMovements,
  fetchTrading212Dividends,
  fetchTrading212Orders,
  Trading212Credentials,
  Trading212Instrument,
} from './trading212Client';
import { mapTrading212Cash } from './mapTrading212Cash';

// Os portefólios de uma conta: um por carteira de moeda (o dinheiro, que rende juros) e
// um para as ações (as posições)
const cashName = (code: string) => `Trading 212 - Juros ${code}`;
const INVEST_NAME = 'Trading 212 - Investimentos';
export const cashPortfolioExternalId = (account: string, code: string) => `${account}:cash:${code}`;
const investExternalId = (account: string) => `${account}:invest`;
// O de antes de haver um por moeda (tinha as moedas todas)
const legacyExternalId = (account: string) => `${account}:cash`;

type Connection = Pick<BrokerConnection, 'id' | 'userId' | 'platformId' | 'externalAccountId'>;

// Quantos dias para trás do último movimento importado se volta a ver o dinheiro
const CASH_OVERLAP_DAYS = 7;
const DAY_MS = 86_400_000;

const isoDay = (value: string) => new Date(`${new Date(value).toISOString().slice(0, 10)}T00:00:00.000Z`);
const round = (value: number, digits = 2) => Math.round(value * 10 ** digits) / 10 ** digits;

/** Um nome livre na pessoa: o pedido e, se já houver outro com ele, com o nº da conta. */
async function freeName(
  connection: Connection,
  name: string,
  repository: PrismaPersonalPortfolioRepository,
  selfId?: string,
) {
  const taken = await repository.findPortfolioByName(connection.userId, name);
  return taken && taken.id !== selfId ? `${name} (${connection.externalAccountId})` : name;
}

/**
 * Um portefólio da ligação pelo `externalId`. Se a ligação da mesma conta foi apagada e
 * se voltou a ligar, o portefólio que ficou solto (com o que já foi importado) volta a
 * ser desta ligação.
 */
async function findPortfolioOf(
  connection: Connection,
  externalId: string,
  repository: PrismaPersonalPortfolioRepository,
): Promise<PersonalPortfolio | null> {
  const existing = await repository.findConnectionPortfolio(connection.id, externalId);
  if (existing) return existing;
  const detached = await repository.findDetachedApiPortfolio(connection.userId, connection.platformId, externalId);
  return detached ? repository.attachPortfolio(detached.id, connection.id) : null;
}

/** Um portefólio da ligação pelo `externalId`: o que já existe ou um novo (só de leitura). */
async function ensurePortfolio(
  connection: Connection,
  externalId: string,
  name: string,
  repository: PrismaPersonalPortfolioRepository,
): Promise<PersonalPortfolio> {
  const existing = await findPortfolioOf(connection, externalId, repository);
  if (existing) return existing;
  return repository.createApiPortfolio({
    userId: connection.userId,
    name: await freeName(connection, name, repository),
    platformId: connection.platformId,
    externalId,
    connectionId: connection.id,
  });
}

/** O portefólio do dinheiro de uma moeda da ligação. */
export const ensureCashPortfolio = (
  connection: Connection,
  code: string,
  repository: PrismaPersonalPortfolioRepository,
) => ensurePortfolio(connection, cashPortfolioExternalId(connection.externalAccountId, code), cashName(code), repository);

/**
 * O portefólio antigo (todas as moedas num só) passa a ser o da moeda da conta, e as
 * transações das outras moedas vão para o portefólio de cada uma. Cada volta passa as que
 * ainda lá estejam (uma passagem que parou a meio acaba-se na seguinte).
 */
async function splitLegacyPortfolio(
  connection: Connection,
  accountCurrency: string,
  repository: PrismaPersonalPortfolioRepository,
) {
  const accountExternalId = cashPortfolioExternalId(connection.externalAccountId, accountCurrency);
  let main = await findPortfolioOf(connection, accountExternalId, repository);
  if (!main) {
    const legacy = await findPortfolioOf(connection, legacyExternalId(connection.externalAccountId), repository);
    if (!legacy) return;
    await repository.updateApiPortfolio(legacy.id, {
      name: await freeName(connection, cashName(accountCurrency), repository, legacy.id),
      externalId: accountExternalId,
    });
    main = legacy;
  }
  // No da moeda da conta só fica essa moeda (as ordens e os dividendos vão para o da moeda deles)
  for (const currency of await repository.findOtherCurrencies(main.id, accountCurrency)) {
    const target = await ensureCashPortfolio(connection, currency.shortCode, repository);
    await repository.moveTransactions(main.id, target.id, currency.id);
  }
}

/**
 * Traz da Trading 212 o que é novo numa ligação, como num extrato:
 * - os movimentos de dinheiro (desde o último importado; da primeira vez, tudo) no
 *   portefólio da moeda de cada um («Trading 212 - Juros EUR»…);
 * - cada ordem executada em duas linhas: a compra ou a venda no «Trading 212 -
 *   Investimentos» (o ativo, a quantidade, o preço) e o dinheiro que sai ou entra no da
 *   moeda (`transfer_out`/`transfer_in`); um acerto sem dinheiro (split) só mexe na quantidade;
 * - os dividendos no da moeda, ligados à ação.
 * Cada ação tem o ativo e os mercados dela (`StockPriceService`), e os preços põem-se em
 * dia no fim. Cada linha entra uma vez (pelo id dela na corretora). Devolve quantas entraram.
 */
export async function syncTrading212(
  connectionId: string,
  repository: PrismaPersonalPortfolioRepository,
  stocks: StockPriceService,
) {
  const connection = await repository.findConnection(connectionId);
  if (!connection) return { imported: 0 };

  const credentials: Trading212Credentials = {
    apiKey: decryptSecret(connection.apiKey, secretContext('broker_connection', `${connection.userId}:${connection.externalAccountId}`, 'apiKey')),
    apiSecret: decryptSecret(connection.apiSecret, secretContext('broker_connection', `${connection.userId}:${connection.externalAccountId}`, 'apiSecret')),
  };
  const accountCurrency = connection.currencyCode ?? 'EUR';
  await splitLegacyPortfolio(connection, accountCurrency, repository);

  // A moeda, o ativo de dinheiro e o portefólio de cada código, procurados uma vez
  const byCode = new Map<
    string,
    { currency: PortfolioCurrency; cashAssetId: string; portfolioId: string } | null
  >();
  const resolve = async (code: string) => {
    if (!byCode.has(code)) {
      const currency = await repository.findCurrencyByCode(code);
      byCode.set(
        code,
        currency
          ? {
              currency,
              cashAssetId: (await repository.ensureCashAsset(currency)).id,
              portfolioId: (await ensureCashPortfolio(connection, code, repository)).id,
            }
          : null,
      );
    }
    return byCode.get(code)!;
  };
  const skippedCurrencies = new Set<string>();

  // --- o dinheiro ---
  // Volta sempre uns dias atrás: um movimento que a corretora lança depois com uma data
  // anterior (um depósito que só confirma mais tarde) também entra; os repetidos não
  // entram duas vezes (o `externalId`)
  const rows: ImportedTransactionData[] = [];
  const since = connection.cashSyncedUntil
    ? new Date(connection.cashSyncedUntil.getTime() - CASH_OVERLAP_DAYS * DAY_MS)
    : null;
  const movements = await fetchTrading212CashMovements(credentials, since);
  let lastAt = connection.cashSyncedUntil;
  // O primeiro movimento que ficou de fora (moeda fora do catálogo): o cursor não passa dele,
  // para entrar quando a moeda aparecer
  let firstSkippedAt: Date | null = null;
  for (const movement of movements) {
    const at = new Date(movement.dateTime);
    if (!lastAt || at > lastAt) lastAt = at;
    const mapped = mapTrading212Cash(movement);
    if (!mapped) continue;
    const target = await resolve(movement.currency);
    if (!target) {
      skippedCurrencies.add(movement.currency);
      if (!firstSkippedAt || at < firstSkippedAt) firstSkippedAt = at;
      continue;
    }
    rows.push({
      portfolioId: target.portfolioId,
      assetId: target.cashAssetId,
      kind: mapped.kind,
      date: isoDay(movement.dateTime),
      quantity: mapped.amount,
      amount: mapped.amount,
      currencyId: target.currency.id,
      externalId: movement.reference,
      externalType: movement.type,
      externalAt: at,
    });
  }

  // --- as ações: o ativo e o mercado de cada uma, procurados uma vez ---
  const listings = new Map<string, { assetId: string; instrumentId: string }>();
  const listingOf = async (instrument: Trading212Instrument) => {
    if (!listings.has(instrument.ticker))
      listings.set(
        instrument.ticker,
        await stocks.ensureListing({
          source: 'trading212',
          platformId: connection.platformId,
          symbol: instrument.ticker,
          isin: instrument.isin,
          name: instrument.name,
          currency: instrument.currency,
        }),
      );
    return listings.get(instrument.ticker)!;
  };

  // Os portefólios da ligação (os que entretanto se criem para uma moeda nova ainda
  // não têm nada, por isso a lista de antes chega para saber o que já se conhece)
  const portfolioIds = async () => {
    const view = await repository.findConnectionView(connection.userId, connection.id);
    return view?.portfolios.map((portfolio) => portfolio.id) ?? [];
  };

  const invest = await ensurePortfolio(
    connection,
    investExternalId(connection.externalAccountId),
    INVEST_NAME,
    repository,
  );

  // As ordens e os dividendos param numa página em que já se conheça tudo e que já vá
  // para lá do mais antigo que ficou de fora numa volta anterior (moeda fora do catálogo):
  // senão, quando a moeda aparecesse, ninguém voltava a lê-lo
  const knownIn = await portfolioIds();
  const skippedSince = await repository.findSkippedSince(connection.id);
  const allKnown = async (ids: string[], times: number[]) =>
    ids.length > 0 &&
    (!skippedSince || times.some((time) => time < skippedSince.getTime())) &&
    (await repository.findKnownExternalIds(knownIn, ids)).size === ids.length;
  // O mais antigo que fica de fora nesta volta (o cursor da seguinte)
  let oldestSkipped: Date | null = null;
  const skip = (currency: string, at: Date) => {
    skippedCurrencies.add(currency);
    if (!Number.isNaN(at.getTime()) && (!oldestSkipped || at < oldestSkipped)) oldestSkipped = at;
  };
  const orderTime = (item: { order: { createdAt: string }; fill?: { filledAt: string } | null }) =>
    new Date(item.fill?.filledAt ?? item.order.createdAt);

  const orders = await fetchTrading212Orders(credentials, (page) => {
    const filled = page.filter((item) => item.fill?.quantity);
    return allKnown(
      filled.map((item) => `order:${item.order.id}`),
      page.map((item) => orderTime(item).getTime()),
    );
  });
  for (const { order, fill } of orders) {
    if (!fill?.quantity) continue;
    const listing = await listingOf(order.instrument);
    // O sinal pelo lado da ordem (a quantidade pode vir sem ele); sem lado, o que vier
    const size = Math.abs(fill.quantity);
    const signed = order.side === 'SELL' ? -size : order.side === 'BUY' ? size : fill.quantity;
    // Sem `walletImpact` não há dinheiro: entra como acerto de quantidade, na moeda do
    // instrumento (ou da conta)
    const value = round(Math.abs(fill.walletImpact?.netValue ?? 0));
    const currencyCode = fill.walletImpact?.currency ?? order.instrument?.currency ?? accountCurrency;
    const at = new Date(fill.filledAt);
    const target = await resolve(currencyCode);
    if (!target) {
      skip(currencyCode, at);
      continue;
    }
    if (!value) {
      // Sem dinheiro (um split, ações recebidas): só a quantidade, com sinal
      rows.push({
        portfolioId: invest.id,
        assetId: listing.assetId,
        instrumentId: listing.instrumentId,
        kind: 'adjust',
        date: isoDay(fill.filledAt),
        quantity: signed,
        amount: 0,
        currencyId: target.currency.id,
        externalId: `order:${order.id}`,
        externalType: `FILL_${fill.type}`,
        externalAt: at,
      });
      continue;
    }
    const buy = signed > 0;
    const quantity = Math.abs(signed);
    rows.push({
      portfolioId: invest.id,
      assetId: listing.assetId,
      instrumentId: listing.instrumentId,
      kind: buy ? 'buy' : 'sell',
      date: isoDay(fill.filledAt),
      quantity,
      // O preço na moeda da conta, com as comissões (o valor ÷ a quantidade)
      price: round(value / quantity, 6),
      amount: value,
      currencyId: target.currency.id,
      externalId: `order:${order.id}`,
      externalType: `ORDER_${order.side}`,
      externalAt: at,
    });
    rows.push({
      portfolioId: target.portfolioId,
      assetId: listing.assetId,
      instrumentId: listing.instrumentId,
      kind: buy ? 'transfer_out' : 'transfer_in',
      date: isoDay(fill.filledAt),
      quantity: value,
      amount: value,
      currencyId: target.currency.id,
      externalId: `order:${order.id}:cash`,
      externalType: `ORDER_${order.side}`,
      externalAt: at,
    });
  }

  const dividends = await fetchTrading212Dividends(credentials, (page) =>
    allKnown(
      page.map((item) => `dividend:${item.reference}`),
      page.map((item) => new Date(item.paidOn).getTime()),
    ),
  );
  for (const dividend of dividends) {
    const value = round(dividend.amount);
    if (!value) continue;
    const target = await resolve(dividend.currency);
    if (!target) {
      skip(dividend.currency, new Date(dividend.paidOn));
      continue;
    }
    const listing = await listingOf(dividend.instrument);
    rows.push({
      portfolioId: target.portfolioId,
      assetId: listing.assetId,
      instrumentId: listing.instrumentId,
      // Um estorno fica dividendo, com o valor negativo: é perda, não um levantamento
      kind: 'dividend',
      date: isoDay(dividend.paidOn),
      quantity: dividend.quantity,
      amount: value,
      currencyId: target.currency.id,
      externalId: `dividend:${dividend.reference}`,
      externalType: `DIVIDEND_${dividend.type}`,
      externalAt: new Date(dividend.paidOn),
    });
  }

  const imported = await repository.createImportedTransactions(rows);
  // Só depois de gravar: uma volta que falhe antes deixa o cursor como estava
  await repository.saveSkippedSince(connection.id, oldestSkipped);
  // Os fechos das ações desta ligação, até hoje
  if (listings.size) await stocks.syncPrices([...listings.values()].map((listing) => listing.instrumentId));

  const now = new Date();
  for (const portfolioId of await portfolioIds()) await repository.markPortfolioSynced(portfolioId, now);
  // A pausa vê-se agora, não no início: uma posta enquanto isto corria fica
  const current = await repository.findConnection(connection.id);
  await repository.updateConnection(connection.id, {
    syncedAt: now,
    cashSyncedUntil: firstSkippedAt && (!lastAt || firstSkippedAt < lastAt) ? firstSkippedAt : lastAt,
    // Em pausa continua em pausa (um sincronizar à mão não a tira)
    status: (current ?? connection).status === 'paused' ? 'paused' : 'active',
    lastError: skippedCurrencies.size
      ? `Moedas que não estão no catálogo: ${[...skippedCurrencies].join(', ')}`
      : null,
  });
  return { imported };
}
