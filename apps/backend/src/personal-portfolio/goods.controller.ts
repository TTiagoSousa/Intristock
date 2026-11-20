import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtUserAuthGuard } from 'src/auth-user/guards/jwt-user-auth.guard';
import { JwtUserPayload } from 'src/auth-user/jwt-payload.interface';
import { GoodsService } from './goods.service';
import {
  AddGoodsValuationDto,
  CreateGoodsDto,
  GoodsLocationsQueryDto,
  GoodsPricesDto,
  SellGoodsDto,
  UpdateGoodsDto,
} from './dto/goods.dto';

type AuthRequest = Request & { user: JwtUserPayload };

// Os bens dos portefólios (as motas). Fica registado antes do controller dos portefólios:
// `goods/...` não pode cair no `:portfolioId/...` dele
@Controller('personal-portfolio/goods')
@UseGuards(JwtUserAuthGuard)
export class GoodsController {
  constructor(private readonly goodsService: GoodsService) {}

  @Post()
  create(@Req() req: AuthRequest, @Body() dto: CreateGoodsDto) {
    return this.goodsService.create(req.user.id, dto);
  }

  // A pesquisa de preços (2 pesquisas da SerpApi); não grava nada
  @Post('prices')
  prices(@Body() dto: GoodsPricesDto) {
    return this.goodsService.prices(dto);
  }

  @Get('prices/available')
  pricesAvailable() {
    return this.goodsService.pricesAvailable();
  }

  // As localidades para a pesquisa (não gasta pesquisas)
  @Get('locations')
  locations(@Query() query: GoodsLocationsQueryDto) {
    return this.goodsService.locations(query.q);
  }

  @Get(':assetId')
  find(@Req() req: AuthRequest, @Param('assetId', ParseUUIDPipe) assetId: string) {
    return this.goodsService.find(req.user.id, assetId);
  }

  @Patch(':assetId')
  update(@Req() req: AuthRequest, @Param('assetId', ParseUUIDPipe) assetId: string, @Body() dto: UpdateGoodsDto) {
    return this.goodsService.update(req.user.id, assetId, dto);
  }

  @Post(':assetId/valuations')
  addValuation(
    @Req() req: AuthRequest,
    @Param('assetId', ParseUUIDPipe) assetId: string,
    @Body() dto: AddGoodsValuationDto,
  ) {
    return this.goodsService.addValuation(req.user.id, assetId, dto);
  }

  @Post(':assetId/sell')
  sell(@Req() req: AuthRequest, @Param('assetId', ParseUUIDPipe) assetId: string, @Body() dto: SellGoodsDto) {
    return this.goodsService.sell(req.user.id, assetId, dto);
  }
}
