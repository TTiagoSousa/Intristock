import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { JwtUserAuthGuard } from 'src/auth-user/guards/jwt-user-auth.guard';
import { UserAdminGuard } from 'src/auth-user/guards/user-admin.guard';
import { AppSettingService } from './app-setting.service';
import { SaveApiSettingsDto } from './dto/save-api-settings.dto';

// Configuração da instalação. O estado vê-o qualquer user (é por ele que o
// frontend sabe se mostra o assistente de primeiro arranque); mexer, só o admin.
@Controller('setup')
@UseGuards(JwtUserAuthGuard)
export class AppSettingController {
  constructor(private readonly appSettingService: AppSettingService) {}

  @Get('status')
  status() {
    return this.appSettingService.status();
  }

  @Get('apis')
  @UseGuards(UserAdminGuard)
  apiSettings() {
    return this.appSettingService.apiSettings();
  }

  // Testa as duas APIs com as chaves guardadas (um pedido pequeno a cada uma)
  @Get('apis/health')
  @UseGuards(UserAdminGuard)
  apisHealth() {
    return this.appSettingService.apisHealth();
  }

  @Put('apis')
  @UseGuards(UserAdminGuard)
  saveApiSettings(@Body() dto: SaveApiSettingsDto) {
    return this.appSettingService.saveApiSettings(dto);
  }
}
