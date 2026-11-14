import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { CalculatorService } from './calculator.service';
import { CreateCalculatorDto } from './dto/create-calculator.dto';
import { UserAdminGuard } from 'src/auth-user/guards/user-admin.guard';
import { JwtUserAuthGuard } from 'src/auth-user/guards/jwt-user-auth.guard';
import { JwtUserPayload } from 'src/auth-user/jwt-payload.interface';

@Controller('calculator')
export class CalculatorController {
  constructor(private readonly calculatorService: CalculatorService) {}

  @Post()
  @UseGuards(JwtUserAuthGuard, UserAdminGuard)
  create(@Body() dto: CreateCalculatorDto) {
    return this.calculatorService.create(dto);
  }

  @Get()
  @UseGuards(JwtUserAuthGuard)
  findAll(@Req() req: Request & { user: JwtUserPayload }) {
    return this.calculatorService.findAll(req.user.id);
  }

  @Get(':id')
  @UseGuards(JwtUserAuthGuard)
  findOne(@Param('id') id: string) {
    return this.calculatorService.findOne(id);
  }
}
