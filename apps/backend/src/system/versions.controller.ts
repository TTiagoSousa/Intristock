import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtUserAuthGuard } from 'src/auth-user/guards/jwt-user-auth.guard';
import { SystemService } from './system.service';

// As versões e as novidades de cada uma — para todos os utilizadores (só ler;
// atualizar é do /system, só do admin)
@Controller('versions')
@UseGuards(JwtUserAuthGuard)
export class VersionsController {
  constructor(private readonly systemService: SystemService) {}

  @Get()
  // lang: pt ou en — a língua das notas (qualquer outro valor dá inglês)
  findAll(@Query('lang') lang?: string) {
    return this.systemService.publicReleases(lang);
  }
}
