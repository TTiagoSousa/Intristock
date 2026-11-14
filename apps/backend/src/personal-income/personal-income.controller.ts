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
import { PersonalIncomeService } from './personal-income.service';
import {
  CreateIncomeSourceDto,
  UpdateIncomeSourceDto,
} from './dto/income-source.dto';
import {
  CreatePersonalIncomeDto,
  UpdatePersonalIncomeDto,
} from './dto/personal-income.dto';
import {
  ExpectedIncomesQueryDto,
  IncomeSummaryQueryDto,
  IncomesQueryDto,
} from './dto/income-query.dto';

type AuthRequest = Request & { user: JwtUserPayload };

@Controller('personal-income')
@UseGuards(JwtUserAuthGuard)
export class PersonalIncomeController {
  constructor(private readonly incomeService: PersonalIncomeService) {}

  // O dashboard: os meses, os cartões, por tipo, por fonte e os próximos
  @Get('summary')
  summarize(@Req() req: AuthRequest, @Query() query: IncomeSummaryQueryDto) {
    return this.incomeService.summarize(req.user.id, query);
  }

  @Get('sources')
  findSources(@Req() req: AuthRequest) {
    return this.incomeService.findSources(req.user.id);
  }

  @Post('sources')
  createSource(@Req() req: AuthRequest, @Body() dto: CreateIncomeSourceDto) {
    return this.incomeService.saveSource(req.user.id, null, dto);
  }

  @Patch('sources/:sourceId')
  updateSource(
    @Req() req: AuthRequest,
    @Param('sourceId', ParseUUIDPipe) sourceId: string,
    @Body() dto: UpdateIncomeSourceDto,
  ) {
    return this.incomeService.saveSource(req.user.id, sourceId, dto);
  }

  @Delete('sources/:sourceId')
  @HttpCode(204)
  deleteSource(
    @Req() req: AuthRequest,
    @Param('sourceId', ParseUUIDPipe) sourceId: string,
  ) {
    return this.incomeService.deleteSource(req.user.id, sourceId);
  }

  @Get('companies')
  findCompanies(@Req() req: AuthRequest) {
    return this.incomeService.findCompanies(req.user.id);
  }

  // Os salários por receber que ainda não estão registados
  @Get('expected')
  findExpected(
    @Req() req: AuthRequest,
    @Query() query: ExpectedIncomesQueryDto,
  ) {
    return this.incomeService.findExpected(req.user.id, query);
  }

  @Get('incomes')
  findIncomes(@Req() req: AuthRequest, @Query() query: IncomesQueryDto) {
    return this.incomeService.findIncomes(req.user.id, query);
  }

  @Post('incomes')
  createIncome(@Req() req: AuthRequest, @Body() dto: CreatePersonalIncomeDto) {
    return this.incomeService.saveIncome(req.user.id, null, dto);
  }

  @Patch('incomes/:incomeId')
  updateIncome(
    @Req() req: AuthRequest,
    @Param('incomeId', ParseUUIDPipe) incomeId: string,
    @Body() dto: UpdatePersonalIncomeDto,
  ) {
    return this.incomeService.saveIncome(req.user.id, incomeId, dto);
  }

  @Delete('incomes/:incomeId')
  @HttpCode(204)
  deleteIncome(
    @Req() req: AuthRequest,
    @Param('incomeId', ParseUUIDPipe) incomeId: string,
  ) {
    return this.incomeService.deleteIncome(req.user.id, incomeId);
  }
}
