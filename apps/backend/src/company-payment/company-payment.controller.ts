import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { CompanyPaymentService } from './company-payment.service';
import { CreateCompanyPaymentDto } from './dto/create-company-payment.dto';
import { FindCompanyPaymentsQueryDto } from './dto/find-company-payments-query.dto';
import { MonthlyPaymentsQueryDto } from './dto/monthly-payments-query.dto';
import { UpdateCompanyPaymentDto } from './dto/update-company-payment.dto';
import { JwtUserAuthGuard } from 'src/auth-user/guards/jwt-user-auth.guard';
import { JwtUserPayload } from 'src/auth-user/jwt-payload.interface';

@Controller('company/:companyId/payments')
@UseGuards(JwtUserAuthGuard)
export class CompanyPaymentController {
  constructor(private readonly companyPaymentService: CompanyPaymentService) {}

  @Post()
  create(
    @Req() req: Request & { user: JwtUserPayload },
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateCompanyPaymentDto,
  ) {
    return this.companyPaymentService.create(req.user.id, companyId, dto);
  }

  // Paginado: sem `skip`/`take` vêm os primeiros 50. A resposta traz sempre o
  // total da empresa, para o frontend saber quantas páginas existem.
  @Get()
  findAll(
    @Req() req: Request & { user: JwtUserPayload },
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: FindCompanyPaymentsQueryDto,
  ) {
    return this.companyPaymentService.findAll(req.user.id, companyId, query);
  }

  // Pagos e recebidos de cada mês na moeda da empresa (o gráfico do resumo dos pagamentos)
  @Get('monthly')
  monthly(
    @Req() req: Request & { user: JwtUserPayload },
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: MonthlyPaymentsQueryDto,
  ) {
    return this.companyPaymentService.monthly(req.user.id, companyId, query);
  }

  // Corrige o que se engana a escrever, e trata da passagem de rascunho a
  // concluído — que é quando a compra passa a mexer no stock. O valor e as
  // linhas não se editam: para isso apaga-se e volta a criar-se.
  @Patch(':paymentId')
  update(
    @Req() req: Request & { user: JwtUserPayload },
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Body() dto: UpdateCompanyPaymentDto,
  ) {
    return this.companyPaymentService.update(req.user.id, companyId, paymentId, dto);
  }

  @Delete(':paymentId')
  remove(
    @Req() req: Request & { user: JwtUserPayload },
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
  ) {
    return this.companyPaymentService.remove(req.user.id, companyId, paymentId);
  }
}
