import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { BankAccountService } from './bank-account.service';
import { CreateBankAccountDto } from './dto/create-bank-account.dto';
import { JwtUserAuthGuard } from 'src/auth-user/guards/jwt-user-auth.guard';
import { JwtUserPayload } from 'src/auth-user/jwt-payload.interface';

@Controller('bank-account')
@UseGuards(JwtUserAuthGuard)
export class BankAccountController {
  constructor(private readonly bankAccountService: BankAccountService) {}

  @Post()
  create(@Req() req: Request & { user: JwtUserPayload }, @Body() dto: CreateBankAccountDto) {
    return this.bankAccountService.create(req.user.id, dto);
  }

  @Get()
  findAll(@Req() req: Request & { user: JwtUserPayload }) {
    return this.bankAccountService.findAll(req.user.id);
  }
}
