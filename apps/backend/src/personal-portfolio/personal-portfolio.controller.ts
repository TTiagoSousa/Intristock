import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
  CreateCashTransactionDto,
  CreatePortfolioDto,
  PortfolioSummaryQueryDto,
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
    return this.portfolioService.summarize(req.user.id, query.currencyId);
  }

  @Post()
  createPortfolio(@Req() req: AuthRequest, @Body() dto: CreatePortfolioDto) {
    return this.portfolioService.createPortfolio(req.user.id, dto.name);
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
