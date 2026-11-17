import { Injectable, NotFoundException } from '@nestjs/common';
import { CurrencyService } from 'src/currency/currency.service';
import { PrismaPersonalPortfolioRepository } from './repositories/prisma/prisma-personal-portfolio-repository';
import {
  ConnectBrokerDto,
  CreateCashTransactionDto,
  CreatePositionTransactionDto,
  MarketPriceQueryDto,
  MarketSearchQueryDto,
  PortfolioTransactionsQueryDto,
  UpdateBrokerConnectionDto,
} from './dto/personal-portfolio.dto';
import { BrokerSyncService } from './broker-sync.service';
import { connectBroker } from './helpers/connectBroker';
import { updateBrokerConnection } from './helpers/updateBrokerConnection';
import { findPortfolios } from './helpers/findPortfolios';
import { createPortfolio } from './helpers/createPortfolio';
import { findPortfolioTransactions } from './helpers/findPortfolioTransactions';
import { findAllTransactions } from './helpers/findAllTransactions';
import { findPortfolioPositions } from './helpers/findPortfolioPositions';
import { createCashTransaction } from './helpers/createCashTransaction';
import { createPositionTransaction } from './helpers/createPositionTransaction';
import { findMarketPrice, searchMarkets } from './helpers/searchMarkets';
import { summarizePortfolios, type SummaryRange } from './helpers/summarizePortfolios';
import { StockPriceService } from 'src/market-data/stock-price.service';
import { findPortfolioAllocation } from './helpers/findPortfolioAllocation';

// Quanto tempo um resumo serve sem nada mudar (hora a hora, menos: o preço da hora mexe)
const SUMMARY_TTL_MS = 15 * 60 * 1000;
const HOURLY_SUMMARY_TTL_MS = 5 * 60 * 1000;
const MAX_CACHED_SUMMARIES = 200;

/**
 * Os portefólios de cada pessoa (finanças pessoais) e as transações deles. Cada
 * transação tem um ativo; para já só há o dinheiro passivo. Cada um só vê os seus.
 */
@Injectable()
export class PersonalPortfolioService {
  // Os resumos já feitos, por pessoa + moeda + período
  private readonly summaries = new Map<
    string,
    { version: string; at: number; value: ReturnType<typeof summarizePortfolios> }
  >();

  constructor(
    private readonly repository: PrismaPersonalPortfolioRepository,
    private readonly currencyService: CurrencyService,
    private readonly brokerSync: BrokerSyncService,
    private readonly stocks: StockPriceService,
  ) {}

  /**
   * O resumo vem da cache enquanto nada mudou: as transações, os portefólios, as ligações,
   * a hora das cotações e os fechos das ações (a versão), e o dia (ou, hora a hora, a hora)
   * em que se está. Mesmo assim, ao fim de uns minutos volta a fazer-se (o câmbio de hoje,
   * o preço de hora a hora). Dois pedidos iguais ao mesmo tempo fazem-no uma vez só.
   */
  async summarize(userId: string, currencyId?: string, range: SummaryRange = 'all') {
    const hourly = range === '7d' || range === '24h';
    const now = Date.now();
    const version = [
      await this.repository.findSummaryVersion(userId),
      this.stocks.pricesVersion,
      new Date(now).toISOString().slice(0, hourly ? 13 : 10),
    ].join('|');
    const key = `${userId}|${currencyId ?? ''}|${range}`;
    const cached = this.summaries.get(key);
    if (cached && cached.version === version && now - cached.at < (hourly ? HOURLY_SUMMARY_TTL_MS : SUMMARY_TTL_MS))
      return cached.value;

    const value = summarizePortfolios(
      userId,
      currencyId,
      range,
      this.repository,
      this.currencyService,
      (markets) => this.stocks.hourlyCloses(markets),
    );
    this.summaries.delete(key);
    this.summaries.set(key, { version, at: now, value });
    // As mais antigas saem primeiro (o Map guarda a ordem em que entraram)
    while (this.summaries.size > MAX_CACHED_SUMMARIES) this.summaries.delete(this.summaries.keys().next().value!);
    value.catch(() => {
      if (this.summaries.get(key)?.value === value) this.summaries.delete(key);
    });
    return value;
  }

  findPortfolios(userId: string) {
    return findPortfolios(userId, this.repository);
  }

  // Uma compra ou venda à mão (ações do Yahoo, cripto da Binance ou da Coinbase)
  createPositionTransaction(userId: string, portfolioId: string, dto: CreatePositionTransactionDto) {
    return createPositionTransaction(userId, portfolioId, dto, this.repository, this.stocks);
  }

  // Os mercados para uma compra à mão: as ações no Yahoo, os pares numa corretora de cripto
  searchMarkets(query: MarketSearchQueryDto) {
    return searchMarkets(query, this.stocks);
  }

  // O fecho de um mercado num dia (para propor o preço no formulário)
  marketPrice(query: MarketPriceQueryDto) {
    return findMarketPrice(query, this.stocks);
  }

  // O que se tem hoje, por categoria geral e por ativo
  allocation(userId: string, currencyId?: string) {
    return findPortfolioAllocation(userId, currencyId, this.repository, this.currencyService);
  }

  // Um portefólio, como na lista
  async findPortfolio(userId: string, portfolioId: string) {
    const portfolio = await this.repository.findPortfolioView(userId, portfolioId);
    if (!portfolio) throw new NotFoundException('Portefólio não encontrado');
    const { _count, ...rest } = portfolio;
    return { ...rest, transactionCount: _count.transactions };
  }

  createPortfolio(userId: string, name: string) {
    return createPortfolio(userId, name, this.repository);
  }

  findAllTransactions(userId: string, query: PortfolioTransactionsQueryDto) {
    return findAllTransactions(userId, query, this.repository, this.currencyService);
  }

  findPositions(userId: string, portfolioId: string) {
    return findPortfolioPositions(userId, portfolioId, this.repository);
  }

  findTransactions(userId: string, portfolioId: string) {
    return findPortfolioTransactions(userId, portfolioId, this.repository);
  }

  createCashTransaction(
    userId: string,
    portfolioId: string,
    dto: CreateCashTransactionDto,
  ) {
    return createCashTransaction(userId, portfolioId, dto, this.repository);
  }

  // As ligações às corretoras (sem a chave), com se estão a sincronizar agora
  async findConnections(userId: string) {
    const connections = await this.repository.findConnections(userId);
    return connections.map((connection) => ({
      ...connection,
      syncing: this.brokerSync.isSyncing(connection.id),
    }));
  }

  // Liga e começa logo a primeira sincronização (o histórico todo), em fundo
  async connectBroker(userId: string, dto: ConnectBrokerDto) {
    const connection = await connectBroker(userId, dto, this.repository);
    void this.brokerSync.sync(connection.id);
    return { ...connection, syncing: true };
  }

  async updateConnection(userId: string, connectionId: string, dto: UpdateBrokerConnectionDto) {
    const connection = await updateBrokerConnection(userId, connectionId, dto, this.repository);
    return { ...connection, syncing: this.brokerSync.isSyncing(connection.id) };
  }

  // Sincroniza agora e espera (a primeira pode demorar cerca de um minuto)
  async syncConnection(userId: string, connectionId: string) {
    if (!(await this.repository.findConnectionView(userId, connectionId)))
      throw new NotFoundException('Ligação não encontrada');
    const result = await this.brokerSync.sync(connectionId);
    const connection = (await this.repository.findConnectionView(userId, connectionId))!;
    return { ...connection, syncing: false, imported: result.imported };
  }

  // Apaga a ligação e a chave; o portefólio e o que foi importado ficam (só de leitura)
  async deleteConnection(userId: string, connectionId: string) {
    if (!(await this.repository.findConnectionView(userId, connectionId)))
      throw new NotFoundException('Ligação não encontrada');
    await this.repository.deleteConnection(connectionId);
    return { deleted: true };
  }
}
