import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { CompanyService } from './company.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { UpdateCompanyStatusDto } from './dto/update-company-status.dto';
import { JwtUserAuthGuard } from 'src/auth-user/guards/jwt-user-auth.guard';
import { JwtUserPayload } from 'src/auth-user/jwt-payload.interface';

@Controller('company')
@UseGuards(JwtUserAuthGuard)
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Post()
  create(
    @Req() req: Request & { user: JwtUserPayload },
    @Body() dto: CreateCompanyDto,
  ) {
    return this.companyService.create(req.user.id, dto);
  }

  @Get()
  findAll(@Req() req: Request & { user: JwtUserPayload }) {
    return this.companyService.findAll(req.user.id);
  }

  // Mudar o nome gera slug novo — a resposta traz o slug para o frontend
  // saber para onde redirecionar
  @Patch(':id')
  update(
    @Req() req: Request & { user: JwtUserPayload },
    @Param('id', ParseUUIDPipe) companyId: string,
    @Body() dto: UpdateCompanyDto,
  ) {
    return this.companyService.update(req.user.id, companyId, dto);
  }

  // Parar e voltar a pôr a trabalhar. Separado do PATCH de cima de propósito:
  // é uma ação, não a edição de um campo.
  @Patch(':id/status')
  updateStatus(
    @Req() req: Request & { user: JwtUserPayload },
    @Param('id', ParseUUIDPipe) companyId: string,
    @Body() dto: UpdateCompanyStatusDto,
  ) {
    return this.companyService.updateStatus(req.user.id, companyId, dto);
  }

  // Não apaga nada: a empresa sai da vista e fica na base de dados. Volta só
  // por pedido ao suporte.
  @Delete(':id')
  remove(
    @Req() req: Request & { user: JwtUserPayload },
    @Param('id', ParseUUIDPipe) companyId: string,
  ) {
    return this.companyService.remove(req.user.id, companyId);
  }
}
