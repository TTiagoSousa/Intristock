import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { TaxService } from './tax.service';
import { CreateTaxDto } from './dto/create-tax.dto';
import { JwtUserAuthGuard } from 'src/auth-user/guards/jwt-user-auth.guard';
import { UserAdminGuard } from 'src/auth-user/guards/user-admin.guard';

@Controller('tax')
export class TaxController {
  constructor(private readonly taxService: TaxService) {}

  @Post()
  @UseGuards(JwtUserAuthGuard, UserAdminGuard)
  create(@Body() dto: CreateTaxDto) {
    return this.taxService.create(dto);
  }

  // Com sessão: o ecrã de login não precisa do catálogo
  @Get()
  @UseGuards(JwtUserAuthGuard)
  findAll(@Query('countryId') countryId?: string) {
    return this.taxService.findAll(countryId);
  }
}
