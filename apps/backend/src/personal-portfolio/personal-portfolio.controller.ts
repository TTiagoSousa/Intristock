import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtUserAuthGuard } from 'src/auth-user/guards/jwt-user-auth.guard';
import { JwtUserPayload } from 'src/auth-user/jwt-payload.interface';
import { PersonalPortfolioService } from './personal-portfolio.service';
import {
  ConnectBrokerDto,
  CreateCashTransactionDto,
  CreatePortfolioDto,
  PortfolioAllocationQueryDto,
  PortfolioSummaryQueryDto,
  PortfolioTransactionsQueryDto,
  UpdateBrokerConnectionDto,
} from './dto/personal-portfolio.dto';

type AuthRequest = Request & { user: JwtUserPayload };

@Controller('personal-portfolio')
@UseGuards(JwtUserAuthGuard)
export class PersonalPortfolioController {
  constructor(private readonly portfolioService: PersonalPortfolioService) {}

  @Get()
  findPortfolios(@Req() req: AuthRequest) {
    return this.portfolioService.findPortfolios(req.user.id);
  }

  // O valor de cada portefólio ao longo do tempo, na moeda pedida
  @Get('summary')
  summarize(@Req() req: AuthRequest, @Query() query: PortfolioSummaryQueryDto) {
    return this.portfolioService.summarize(req.user.id, query.currencyId, query.range);
  }

  // O que se tem hoje, por categoria geral (dinheiro, títulos, cripto…) e por ativo, na moeda pedida
  @Get('allocation')
  allocation(@Req() req: AuthRequest, @Query() query: PortfolioAllocationQueryDto) {
    return this.portfolioService.allocation(req.user.id, query.currencyId);
  }

  // Todas as transações da pessoa, com os filtros
  @Get('transactions')
  findAllTransactions(@Req() req: AuthRequest, @Query() query: PortfolioTransactionsQueryDto) {
    return this.portfolioService.findAllTransactions(req.user.id, query);
  }

  // As ligações às corretoras (Trading 212): o dinheiro, sincronizado de hora a hora
  @Get('connections')
  findConnections(@Req() req: AuthRequest) {
    return this.portfolioService.findConnections(req.user.id);
  }

  @Post('connections')
  connectBroker(@Req() req: AuthRequest, @Body() dto: ConnectBrokerDto) {
    return this.portfolioService.connectBroker(req.user.id, dto);
  }

  @Patch('connections/:connectionId')
  updateConnection(
    @Req() req: AuthRequest,
    @Param('connectionId', ParseUUIDPipe) connectionId: string,
    @Body() dto: UpdateBrokerConnectionDto,
  ) {
    return this.portfolioService.updateConnection(req.user.id, connectionId, dto);
  }

  @Post('connections/:connectionId/sync')
  syncConnection(
    @Req() req: AuthRequest,
    @Param('connectionId', ParseUUIDPipe) connectionId: string,
  ) {
    return this.portfolioService.syncConnection(req.user.id, connectionId);
  }

  @Delete('connections/:connectionId')
  deleteConnection(
    @Req() req: AuthRequest,
    @Param('connectionId', ParseUUIDPipe) connectionId: string,
  ) {
    return this.portfolioService.deleteConnection(req.user.id, connectionId);
  }

  @Post()
  createPortfolio(@Req() req: AuthRequest, @Body() dto: CreatePortfolioDto) {
    return this.portfolioService.createPortfolio(req.user.id, dto.name);
  }

  // Um portefólio (a plataforma, a ligação, quantas transações)
  @Get(':portfolioId')
  findPortfolio(
    @Req() req: AuthRequest,
    @Param('portfolioId', ParseUUIDPipe) portfolioId: string,
  ) {
    return this.portfolioService.findPortfolio(req.user.id, portfolioId);
  }

  // As ações do portefólio: quantidade, custo médio, último fecho e valor
  @Get(':portfolioId/positions')
  findPositions(
    @Req() req: AuthRequest,
    @Param('portfolioId', ParseUUIDPipe) portfolioId: string,
  ) {
    return this.portfolioService.findPositions(req.user.id, portfolioId);
  }

  @Get(':portfolioId/transactions')
  findTransactions(
    @Req() req: AuthRequest,
    @Param('portfolioId', ParseUUIDPipe) portfolioId: string,
  ) {
    return this.portfolioService.findTransactions(req.user.id, portfolioId);
  }

  // Dinheiro passivo (uma conta poupança): depósito, levantamento, juros, comissão, imposto
  @Post(':portfolioId/transactions/cash')
  createCashTransaction(
    @Req() req: AuthRequest,
    @Param('portfolioId', ParseUUIDPipe) portfolioId: string,
    @Body() dto: CreateCashTransactionDto,
  ) {
    return this.portfolioService.createCashTransaction(
      req.user.id,
      portfolioId,
      dto,
    );
  }
}
