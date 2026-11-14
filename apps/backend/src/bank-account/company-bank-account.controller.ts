import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Param,
  ParseUUIDPipe,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { BankAccountService } from './bank-account.service';
import { JwtUserAuthGuard } from 'src/auth-user/guards/jwt-user-auth.guard';
import { JwtUserPayload } from 'src/auth-user/jwt-payload.interface';
import { UpdateBankAccountDto } from './dto/update-bank-account.dto';
import { CreateCompanyBankAccountDto } from 'src/company/dto/create-company-bank-account.dto';

// Contas de uma empresa. Vive no módulo bank-account, mas com rota aninhada em
// /company/:companyId, como os fornecedores e os pagamentos.
@Controller('company/:companyId/bank-accounts')
@UseGuards(JwtUserAuthGuard)
export class CompanyBankAccountController {
  constructor(private readonly bankAccountService: BankAccountService) {}

  @Get()
  findAll(
    @Req() req: Request & { user: JwtUserPayload },
    @Param('companyId', ParseUUIDPipe) companyId: string,
  ) {
    return this.bankAccountService.findAllByCompany(req.user.id, companyId);
  }
  @Post()
  create(
    @Req() req: Request & { user: JwtUserPayload },
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateCompanyBankAccountDto,
  ) {
    return this.bankAccountService.createForCompany(req.user.id, companyId, dto);
  }

  @Patch(':id')
  update(
    @Req() req: Request & { user: JwtUserPayload },
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) bankAccountId: string,
    @Body() dto: UpdateBankAccountDto,
  ) {
    return this.bankAccountService.updateForCompany(
      req.user.id,
      companyId,
      bankAccountId,
      dto,
    );
  }

  // Só passa se ninguém depender dela. Uma conta com pagamentos fecha-se com
  // `status: inactive`, não se apaga.
  @Delete(':id')
  remove(
    @Req() req: Request & { user: JwtUserPayload },
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) bankAccountId: string,
  ) {
    return this.bankAccountService.removeForCompany(
      req.user.id,
      companyId,
      bankAccountId,
    );
  }
}
