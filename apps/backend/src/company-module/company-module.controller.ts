import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { CompanyModuleService } from './company-module.service';
import { ActivateCompanyModuleDto } from './dto/activate-company-module.dto';
import { ToggleCompanyModuleDto } from './dto/toggle-company-module.dto';
import { JwtUserAuthGuard } from 'src/auth-user/guards/jwt-user-auth.guard';
import { JwtUserPayload } from 'src/auth-user/jwt-payload.interface';

@Controller('company/:companyId/modules')
@UseGuards(JwtUserAuthGuard)
export class CompanyModuleController {
  constructor(private readonly companyModuleService: CompanyModuleService) {}

  @Post()
  activate(
    @Req() req: Request & { user: JwtUserPayload },
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: ActivateCompanyModuleDto,
  ) {
    return this.companyModuleService.activate(req.user.id, companyId, dto);
  }

  // O :moduleId é o id do módulo do catálogo, não o do CompanyModule —
  // é o que o frontend tem à mão quando desenha o toggle
  @Patch(':moduleId')
  toggle(
    @Req() req: Request & { user: JwtUserPayload },
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
    @Body() dto: ToggleCompanyModuleDto,
  ) {
    return this.companyModuleService.toggle(req.user.id, companyId, moduleId, dto);
  }

  @Get()
  findAll(
    @Req() req: Request & { user: JwtUserPayload },
    @Param('companyId', ParseUUIDPipe) companyId: string,
  ) {
    return this.companyModuleService.findAll(req.user.id, companyId);
  }
}
