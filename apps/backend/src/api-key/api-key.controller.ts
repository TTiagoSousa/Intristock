import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtUserAuthGuard } from 'src/auth-user/guards/jwt-user-auth.guard';
import { UserAdminGuard } from 'src/auth-user/guards/user-admin.guard';
import { ApiKeyService } from './api-key.service';
import { ApiKeyKindQueryDto, CreateApiKeyDto, ReorderApiKeysDto, UpdateApiKeyDto } from './dto/api-key.dto';

// As chaves das APIs com várias contas (Definições → APIs): só o admin
@Controller('setup/api-keys')
@UseGuards(JwtUserAuthGuard, UserAdminGuard)
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Get()
  list(@Query() query: ApiKeyKindQueryDto) {
    return this.apiKeyService.list(query.kind);
  }

  @Post()
  add(@Body() dto: CreateApiKeyDto) {
    return this.apiKeyService.add(dto);
  }

  @Post('refresh')
  refresh(@Query() query: ApiKeyKindQueryDto) {
    return this.apiKeyService.refresh(query.kind);
  }

  @Post('reorder')
  reorder(@Body() dto: ReorderApiKeysDto) {
    return this.apiKeyService.reorder(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateApiKeyDto) {
    return this.apiKeyService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.apiKeyService.remove(id);
  }
}
