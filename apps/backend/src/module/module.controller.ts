import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ModuleService } from './module.service';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';
import { UserAdminGuard } from 'src/auth-user/guards/user-admin.guard';
import { JwtUserAuthGuard } from 'src/auth-user/guards/jwt-user-auth.guard';

@Controller('module')
export class ModuleController {
  constructor(private readonly moduleService: ModuleService) {}

  @Post()
  @UseGuards(JwtUserAuthGuard, UserAdminGuard)
  create(@Body() dto: CreateModuleDto) {
    return this.moduleService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtUserAuthGuard, UserAdminGuard)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateModuleDto) {
    return this.moduleService.update(id, dto);
  }

  // Catálogo visto pelo Admin — inclui os desativados, para os poder reativar
  @Get('all')
  @UseGuards(JwtUserAuthGuard, UserAdminGuard)
  findAllForAdmin() {
    return this.moduleService.findAll(true);
  }

  // Catálogo visto pelas empresas — só os módulos disponíveis
  @Get()
  @UseGuards(JwtUserAuthGuard)
  findAll() {
    return this.moduleService.findAll(false);
  }
}
