import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
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
import { PersonalDebtService } from './personal-debt.service';
import {
  CreateDebtMovementDto,
  CreatePersonalDebtDto,
  UpdateDebtMovementDto,
  UpdatePersonalDebtDto,
} from './dto/personal-debt.dto';
import {
  DebtMovementsQueryDto,
  DebtSummaryQueryDto,
  DebtsDueQueryDto,
} from './dto/debt-query.dto';

type AuthRequest = Request & { user: JwtUserPayload };

@Controller('personal-debt')
@UseGuards(JwtUserAuthGuard)
export class PersonalDebtController {
  constructor(private readonly debtService: PersonalDebtService) {}

  // O dashboard: os saldos mês a mês, os cartões, por tipo, cada dívida e as próximas
  @Get('summary')
  summarize(@Req() req: AuthRequest, @Query() query: DebtSummaryQueryDto) {
    return this.debtService.summarize(req.user.id, query);
  }

  @Get('debts')
  findDebts(@Req() req: AuthRequest) {
    return this.debtService.findDebts(req.user.id);
  }

  @Post('debts')
  createDebt(@Req() req: AuthRequest, @Body() dto: CreatePersonalDebtDto) {
    return this.debtService.saveDebt(req.user.id, null, dto);
  }

  @Patch('debts/:debtId')
  updateDebt(
    @Req() req: AuthRequest,
    @Param('debtId', ParseUUIDPipe) debtId: string,
    @Body() dto: UpdatePersonalDebtDto,
  ) {
    return this.debtService.saveDebt(req.user.id, debtId, dto);
  }

  @Delete('debts/:debtId')
  @HttpCode(204)
  deleteDebt(
    @Req() req: AuthRequest,
    @Param('debtId', ParseUUIDPipe) debtId: string,
  ) {
    return this.debtService.deleteDebt(req.user.id, debtId);
  }

  // As prestações por pagar, das em atraso às dos próximos meses
  @Get('due')
  findDue(@Req() req: AuthRequest, @Query() query: DebtsDueQueryDto) {
    return this.debtService.findDue(req.user.id, query);
  }

  @Get('movements')
  findMovements(
    @Req() req: AuthRequest,
    @Query() query: DebtMovementsQueryDto,
  ) {
    return this.debtService.findMovements(req.user.id, query);
  }

  @Post('movements')
  createMovement(@Req() req: AuthRequest, @Body() dto: CreateDebtMovementDto) {
    return this.debtService.saveMovement(req.user.id, null, dto);
  }

  @Patch('movements/:movementId')
  updateMovement(
    @Req() req: AuthRequest,
    @Param('movementId', ParseUUIDPipe) movementId: string,
    @Body() dto: UpdateDebtMovementDto,
  ) {
    return this.debtService.saveMovement(req.user.id, movementId, dto);
  }

  @Delete('movements/:movementId')
  @HttpCode(204)
  deleteMovement(
    @Req() req: AuthRequest,
    @Param('movementId', ParseUUIDPipe) movementId: string,
  ) {
    return this.debtService.deleteMovement(req.user.id, movementId);
  }
}
