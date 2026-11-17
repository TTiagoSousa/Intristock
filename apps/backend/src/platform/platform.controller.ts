import { Body, Controller, Get, HttpCode, NotFoundException, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { PlatformService } from './platform.service';
import { PropFirmSyncService } from './prop-firm-sync.service';
import { ExchangeSyncService } from './exchange-sync.service';
import { CreatePlatformDto } from './dto/create-platform.dto';
import { JwtUserAuthGuard } from 'src/auth-user/guards/jwt-user-auth.guard';
import { UserAdminGuard } from 'src/auth-user/guards/user-admin.guard';

@Controller('platform')
export class PlatformController {
  constructor(
    private readonly platformService: PlatformService,
    private readonly propFirmSync: PropFirmSyncService,
    private readonly exchangeSync: ExchangeSyncService,
  ) {}

  @Post()
  @UseGuards(JwtUserAuthGuard, UserAdminGuard)
  create(@Body() dto: CreatePlatformDto) {
    return this.platformService.create(dto);
  }

  @Get()
  findAll() {
    return this.platformService.findAll();
  }

  // As prop firms da PropFirmMap (página APIs): o estado do atualizar, arrancá-lo
  // (corre em fundo, ~5 min) e a base contra a API
  @Get('prop-firms/status')
  @UseGuards(JwtUserAuthGuard, UserAdminGuard)
  propFirmStatus() {
    return this.propFirmSync.status();
  }

  @Post('prop-firms/sync')
  @HttpCode(202)
  @UseGuards(JwtUserAuthGuard, UserAdminGuard)
  syncPropFirms() {
    return this.propFirmSync.start();
  }

  // Só a base: todas as prop firms guardadas, sem pedir nada à API
  @Get('prop-firms')
  @UseGuards(JwtUserAuthGuard, UserAdminGuard)
  propFirmsFromDatabase() {
    return this.propFirmSync.fromDatabase();
  }

  @Get('prop-firms/compare')
  @UseGuards(JwtUserAuthGuard, UserAdminGuard)
  comparePropFirms() {
    return this.propFirmSync.compare();
  }

  // As exchanges de cripto da CoinGecko (página APIs e primeiro arranque); uns segundos
  @Get('exchanges')
  @UseGuards(JwtUserAuthGuard, UserAdminGuard)
  exchanges() {
    return this.exchangeSync.list();
  }

  @Post('exchanges/sync')
  @UseGuards(JwtUserAuthGuard, UserAdminGuard)
  syncExchanges() {
    return this.exchangeSync.sync();
  }

  // Uma plataforma com os detalhes (numa prop firm: as regras, os payouts e os planos)
  @Get(':id')
  @UseGuards(JwtUserAuthGuard)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const platform = await this.propFirmSync.details(id);
    if (!platform) throw new NotFoundException('Plataforma não encontrada');
    return platform;
  }
}
