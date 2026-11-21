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
import { MarketDataService } from './market-data.service';
import { FindInstrumentsDto } from './dto/find-instruments.dto';
import { CreateMarketDataDownloadDto } from './dto/create-market-data-download.dto';
import { FindCandlesDto } from './dto/find-candles.dto';
import { JwtUserAuthGuard } from 'src/auth-user/guards/jwt-user-auth.guard';
import { JwtUserPayload } from 'src/auth-user/jwt-payload.interface';
import { UserThrottle } from 'src/common/throttle/user-throttle.decorator';
import { CANDLES_LIMIT, DOWNLOADS_LIMIT } from 'src/common/throttle/throttle.constants';

@Controller('market')
@UseGuards(JwtUserAuthGuard)
export class MarketDataController {
  constructor(private readonly marketDataService: MarketDataService) {}

  @Get('instruments')
  findInstruments(@Query() query: FindInstrumentsDto) {
    return this.marketDataService.findInstruments(query);
  }

  @Get('instruments/facets')
  findInstrumentFacets() {
    return this.marketDataService.findInstrumentFacets();
  }

  // Um bloco de velas para o gráfico ([tempo, abertura, máxima, mínima, fecho,
  // volume]), as mais recentes antes de `to`
  @Get('candles')
  @UserThrottle(CANDLES_LIMIT)
  findCandles(@Query() query: FindCandlesDto) {
    return this.marketDataService.findCandles(query);
  }

  @Post('downloads')
  @UserThrottle(DOWNLOADS_LIMIT)
  createDownload(
    @Req() req: Request & { user: JwtUserPayload },
    @Body() dto: CreateMarketDataDownloadDto,
  ) {
    return this.marketDataService.createDownload(req.user.id, dto);
  }

  @Get('downloads/:id')
  findDownload(
    @Req() req: Request & { user: JwtUserPayload },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.marketDataService.findDownload(req.user.id, id);
  }
}
