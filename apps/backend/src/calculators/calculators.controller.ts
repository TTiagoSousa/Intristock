import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { CalculatorsService } from './calculators.service';
import { CreateCompoundInterestSimulationDto } from './dto/create-compound-interest-simulation.dto';
import { JwtUserAuthGuard } from 'src/auth-user/guards/jwt-user-auth.guard';
import { JwtUserPayload } from 'src/auth-user/jwt-payload.interface';

@Controller('calculators')
@UseGuards(JwtUserAuthGuard)
export class CalculatorsController {
  constructor(private readonly calculatorsService: CalculatorsService) {}

  // As simulações guardadas de todas as calculadoras, a mais recente primeiro
  @Get('saved')
  getSavedSimulations(@Req() req: Request & { user: JwtUserPayload }) {
    return this.calculatorsService.getSavedSimulations(req.user.id);
  }

  // Apagar não depende da calculadora: só da simulação ser do utilizador
  @Delete('saved/:id')
  deleteSimulation(@Req() req: Request & { user: JwtUserPayload }, @Param('id') id: string) {
    return this.calculatorsService.deleteSimulation(req.user.id, id);
  }

  @Post('compound-interest')
  simulateCompoundInterest(@Body() dto: CreateCompoundInterestSimulationDto) {
    return this.calculatorsService.simulateCompoundInterest(dto);
  }

  @Post('compound-interest/save')
  saveCompoundInterestSimulation(
    @Req() req: Request & { user: JwtUserPayload },
    @Body() dto: CreateCompoundInterestSimulationDto,
  ) {
    return this.calculatorsService.saveCompoundInterestSimulation(req.user.id, dto);
  }

  @Get('compound-interest/saved')
  getSavedCompoundInterestSimulations(@Req() req: Request & { user: JwtUserPayload }) {
    return this.calculatorsService.getSavedCompoundInterestSimulations(req.user.id);
  }

  @Delete('compound-interest/saved/:id')
  deleteCompoundInterestSimulation(
    @Req() req: Request & { user: JwtUserPayload },
    @Param('id') id: string,
  ) {
    return this.calculatorsService.deleteCompoundInterestSimulation(req.user.id, id);
  }
}
