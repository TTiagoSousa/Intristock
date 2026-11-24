import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtUserAuthGuard } from 'src/auth-user/guards/jwt-user-auth.guard';
import { JwtUserPayload } from 'src/auth-user/jwt-payload.interface';
import { CompanyDataConnectionService } from './company-data-connection.service';
import { CheckDataConnectionDto, CreateDataConnectionDto, UpdateDataConnectionDto } from './dto/company-data-connection.dto';

type Req = Request & { user: JwtUserPayload };

/** As ligações dos Dados a uma API (Shopify): enchem uma tabela pela coluna chave, no intervalo de cada uma. */
@Controller('company/:companyId/data/connections')
@UseGuards(JwtUserAuthGuard)
export class CompanyDataConnectionController {
  constructor(private readonly service: CompanyDataConnectionService) {}

  @Get()
  list(@Req() req: Req, @Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.service.list(req.user.id, companyId);
  }

  // Os campos de cada API (para ligar às colunas)
  @Get('fields')
  fields() {
    return this.service.fields();
  }

  @Post('check')
  check(@Req() req: Req, @Param('companyId', ParseUUIDPipe) companyId: string, @Body() dto: CheckDataConnectionDto) {
    return this.service.check(req.user.id, companyId, dto);
  }

  @Post()
  create(@Req() req: Req, @Param('companyId', ParseUUIDPipe) companyId: string, @Body() dto: CreateDataConnectionDto) {
    return this.service.create(req.user.id, companyId, dto);
  }

  @Patch(':id')
  update(
    @Req() req: Req,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDataConnectionDto,
  ) {
    return this.service.update(req.user.id, companyId, id, dto);
  }

  @Delete(':id')
  remove(@Req() req: Req, @Param('companyId', ParseUUIDPipe) companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(req.user.id, companyId, id);
  }

  @Post(':id/sync')
  sync(@Req() req: Req, @Param('companyId', ParseUUIDPipe) companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.syncNow(req.user.id, companyId, id);
  }
}
