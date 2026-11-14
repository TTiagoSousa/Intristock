import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
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
import { SimulationService } from './simulation.service';
import { CreateSimulationDto } from './dto/create-simulation.dto';
import { FindTradesQueryDto } from './dto/find-trades-query.dto';
import { FindReportQueryDto } from './dto/find-report-query.dto';
import { CreateMarketRunsDto } from './dto/create-market-runs.dto';
import { DeleteSimulationsDto } from './dto/delete-simulations.dto';
import { PaginationQueryDto } from 'src/common/pagination';

@Controller('simulations')
@UseGuards(JwtUserAuthGuard)
export class SimulationController {
  constructor(private readonly simulationService: SimulationService) {}

  @Post()
  create(
    @Req() req: Request & { user: JwtUserPayload },
    @Body() dto: CreateSimulationDto,
  ) {
    return this.simulationService.create(req.user.id, dto);
  }

  // Várias de uma vez (as escolhidas na lista)
  @Post('delete')
  @HttpCode(200)
  deleteMany(
    @Req() req: Request & { user: JwtUserPayload },
    @Body() dto: DeleteSimulationsDto,
  ) {
    return this.simulationService.delete(req.user.id, dto.ids);
  }

  @Get()
  findAll(
    @Req() req: Request & { user: JwtUserPayload },
    @Query() query: PaginationQueryDto,
  ) {
    return this.simulationService.findAll(req.user.id, query);
  }

  @Get(':id')
  findOne(
    @Req() req: Request & { user: JwtUserPayload },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.simulationService.findOne(req.user.id, id);
  }

  @Get(':id/trades')
  findTrades(
    @Req() req: Request & { user: JwtUserPayload },
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: FindTradesQueryDto,
  ) {
    return this.simulationService.findTrades(req.user.id, id, query);
  }

  // O gráfico: todos os trades (as velas vêm de /market/candles, aos blocos)
  @Get(':id/chart')
  findChart(
    @Req() req: Request & { user: JwtUserPayload },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.simulationService.findChart(req.user.id, id);
  }

  // O relatório: só os blocos pedidos (?blocks=summaryMetrics), já calculados
  @Get(':id/report')
  findReport(
    @Req() req: Request & { user: JwtUserPayload },
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: FindReportQueryDto,
  ) {
    return this.simulationService.findReport(req.user.id, id, query);
  }

  // 3.7: a mesma estratégia noutros mercados (a original e as corridas a partir dela)
  @Get(':id/markets')
  findMarkets(
    @Req() req: Request & { user: JwtUserPayload },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.simulationService.findMarkets(req.user.id, id);
  }

  @Post(':id/markets')
  createMarkets(
    @Req() req: Request & { user: JwtUserPayload },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateMarketRunsDto,
  ) {
    return this.simulationService.createMarkets(req.user.id, id, dto);
  }

  // Na fila cancela-se logo; a correr fica a cancelar até o simulador a parar
  @Post(':id/cancel')
  @HttpCode(200)
  cancel(
    @Req() req: Request & { user: JwtUserPayload },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.simulationService.cancel(req.user.id, id);
  }

  @Delete(':id')
  delete(
    @Req() req: Request & { user: JwtUserPayload },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.simulationService.delete(req.user.id, [id]);
  }
}
