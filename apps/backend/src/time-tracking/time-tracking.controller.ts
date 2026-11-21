import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtUserAuthGuard } from 'src/auth-user/guards/jwt-user-auth.guard';
import { JwtUserPayload } from 'src/auth-user/jwt-payload.interface';
import { TimeTrackingService } from './time-tracking.service';
import {
  CheckTimeTrackingDto,
  CreateTimeTrackingConnectionDto,
  CreateTimeTrackingSettlementDto,
  CreateTimeTrackingPayoutDto,
  PayoutsQueryDto,
  SettlementsQueryDto,
  EntriesQueryDto,
  HoursQueryDto,
  TimeTrackingSummaryQueryDto,
  UpdateTimeTrackingClientDto,
  UpdateTimeTrackingConnectionDto,
  UpdateTimeTrackingPersonDto,
} from './dto/time-tracking.dto';

type Req = Request & { user: JwtUserPayload };

/** O banco de horas de uma empresa: as ligações à app de horas, os clientes, as pessoas e as horas. */
@Controller('company/:companyId/time-tracking')
@UseGuards(JwtUserAuthGuard)
export class TimeTrackingController {
  constructor(private readonly service: TimeTrackingService) {}

  @Get('connections')
  connections(@Req() req: Req, @Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.service.connections(req.user.id, companyId);
  }

  // O primeiro passo: o endereço e a chave → as organizações
  @Post('connections/check')
  check(@Req() req: Req, @Param('companyId', ParseUUIDPipe) companyId: string, @Body() dto: CheckTimeTrackingDto) {
    return this.service.check(req.user.id, companyId, dto);
  }

  @Post('connections')
  connect(
    @Req() req: Req,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateTimeTrackingConnectionDto,
  ) {
    return this.service.connect(req.user.id, companyId, dto);
  }

  @Patch('connections/:id')
  updateConnection(
    @Req() req: Req,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTimeTrackingConnectionDto,
  ) {
    return this.service.updateConnection(req.user.id, companyId, id, dto);
  }

  @Delete('connections/:id')
  deleteConnection(
    @Req() req: Req,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.deleteConnection(req.user.id, companyId, id);
  }

  @Post('connections/:id/sync')
  syncNow(
    @Req() req: Req,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.syncNow(req.user.id, companyId, id);
  }

  @Get('clients')
  clients(@Req() req: Req, @Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.service.clients(req.user.id, companyId);
  }

  @Patch('clients/:id')
  updateClient(
    @Req() req: Req,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTimeTrackingClientDto,
  ) {
    return this.service.updateClient(req.user.id, companyId, id, dto);
  }

  @Get('people')
  people(@Req() req: Req, @Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.service.people(req.user.id, companyId);
  }

  @Patch('people/:id')
  updatePerson(
    @Req() req: Req,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTimeTrackingPersonDto,
  ) {
    return this.service.updatePerson(req.user.id, companyId, id, dto);
  }

  @Get('hours')
  hours(@Req() req: Req, @Param('companyId', ParseUUIDPipe) companyId: string, @Query() query: HoursQueryDto) {
    return this.service.hours(req.user.id, companyId, query);
  }

  @Get('entries')
  entries(@Req() req: Req, @Param('companyId', ParseUUIDPipe) companyId: string, @Query() query: EntriesQueryDto) {
    return this.service.entries(req.user.id, companyId, query);
  }

  @Get('settlements')
  settlements(@Req() req: Req, @Param('companyId', ParseUUIDPipe) companyId: string, @Query() query: SettlementsQueryDto) {
    return this.service.settlements(req.user.id, companyId, query);
  }

  // Marcar como pago: por datas (`range`) ou por horas (`hours`, «50 € por 5 h»)
  @Post('settlements')
  createSettlement(
    @Req() req: Req,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateTimeTrackingSettlementDto,
  ) {
    return this.service.createSettlement(req.user.id, companyId, dto);
  }

  // Desfazer: as horas voltam a estar por pagar
  @Delete('settlements/:id')
  deleteSettlement(
    @Req() req: Req,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.deleteSettlement(req.user.id, companyId, id);
  }

  @Get('payouts')
  payouts(@Req() req: Req, @Param('companyId', ParseUUIDPipe) companyId: string, @Query() query: PayoutsQueryDto) {
    return this.service.payouts(req.user.id, companyId, query);
  }

  // A empresa paga a quem fez as horas: os registos escolhidos ou as horas de uma pessoa entre datas
  @Post('payouts')
  createPayout(
    @Req() req: Req,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateTimeTrackingPayoutDto,
  ) {
    return this.service.createPayout(req.user.id, companyId, dto);
  }

  @Delete('payouts/:id')
  deletePayout(
    @Req() req: Req,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.deletePayout(req.user.id, companyId, id);
  }

  @Get('summary')
  summary(
    @Req() req: Req,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: TimeTrackingSummaryQueryDto,
  ) {
    return this.service.summary(req.user.id, companyId, query);
  }
}
