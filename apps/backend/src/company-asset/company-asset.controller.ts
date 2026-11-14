import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { CompanyAssetService } from './company-asset.service';
import { CreateCompanyAssetDto } from './dto/create-company-asset.dto';
import { UpdateCompanyAssetDto } from './dto/update-company-asset.dto';
import { JwtUserAuthGuard } from 'src/auth-user/guards/jwt-user-auth.guard';
import { JwtUserPayload } from 'src/auth-user/jwt-payload.interface';
import { PaginationQueryDto, resolvePagination } from 'src/common/pagination';

@Controller('company/:companyId/assets')
@UseGuards(JwtUserAuthGuard)
export class CompanyAssetController {
  constructor(private readonly companyAssetService: CompanyAssetService) {}

  @Post()
  create(
    @Req() req: Request & { user: JwtUserPayload },
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateCompanyAssetDto,
  ) {
    return this.companyAssetService.create(req.user.id, companyId, dto);
  }

  @Patch(':id')
  update(
    @Req() req: Request & { user: JwtUserPayload },
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) assetId: string,
    @Body() dto: UpdateCompanyAssetDto,
  ) {
    return this.companyAssetService.update(req.user.id, companyId, assetId, dto);
  }

  @Delete(':id')
  delete(
    @Req() req: Request & { user: JwtUserPayload },
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) assetId: string,
  ) {
    return this.companyAssetService.delete(req.user.id, companyId, assetId);
  }

  @Get()
  findAll(
    @Req() req: Request & { user: JwtUserPayload },
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.companyAssetService.findAll(req.user.id, companyId, resolvePagination(query));
  }
}
