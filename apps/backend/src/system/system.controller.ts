import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { JwtUserAuthGuard } from 'src/auth-user/guards/jwt-user-auth.guard';
import { UserAdminGuard } from 'src/auth-user/guards/user-admin.guard';
import { SystemService } from './system.service';
import { RequestUpdateDto } from './dto/request-update.dto';

// Versão instalada, releases e atualizações — só para o administrador.
@Controller('system')
@UseGuards(JwtUserAuthGuard, UserAdminGuard)
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  @Get('version')
  // lang: pt ou en — a língua das notas (qualquer outro valor dá inglês)
  version(@Query('lang') lang?: string) {
    return this.systemService.version(lang);
  }

  @Get('releases')
  releases(@Query('refresh') refresh?: string, @Query('lang') lang?: string) {
    return this.systemService.releases(refresh === '1', lang);
  }

  @Post('update')
  @HttpCode(202)
  update(@Body() dto: RequestUpdateDto) {
    return this.systemService.update(dto.version);
  }

  @Get('update/status')
  updateStatus() {
    return this.systemService.updateStatus();
  }
}
