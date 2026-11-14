import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { CompanyItemService } from './company-item.service';
import { CreateCompanyItemDto } from './dto/create-company-item.dto';
import { UpdateCompanyItemDto } from './dto/update-company-item.dto';
import { CreateItemsFromPlansDto } from './dto/item-catalog.dto';
import { JwtUserAuthGuard } from 'src/auth-user/guards/jwt-user-auth.guard';
import { JwtUserPayload } from 'src/auth-user/jwt-payload.interface';
import { PaginationQueryDto, resolvePagination } from 'src/common/pagination';

@Controller('company/:companyId/items')
@UseGuards(JwtUserAuthGuard)
export class CompanyItemController {
  constructor(private readonly companyItemService: CompanyItemService) {}

  @Post()
  create(
    @Req() req: Request & { user: JwtUserPayload },
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateCompanyItemDto,
  ) {
    return this.companyItemService.create(req.user.id, companyId, dto);
  }

  // Planos de uma plataforma do catálogo (os desafios de uma prop firm) como itens
  @Post('from-plans')
  createFromPlans(
    @Req() req: Request & { user: JwtUserPayload },
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateItemsFromPlansDto,
  ) {
    return this.companyItemService.createFromPlans(
      req.user.id,
      companyId,
      dto.platformId,
      dto.planIds,
    );
  }

  // Antes do ':slug', senão "catalog" era lido como o slug de um item
  @Get('catalog/:platformId/plans')
  findCatalogPlans(
    @Req() req: Request & { user: JwtUserPayload },
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('platformId', ParseUUIDPipe) platformId: string,
  ) {
    return this.companyItemService.findCatalogPlans(
      req.user.id,
      companyId,
      platformId,
    );
  }

  @Patch(':id')
  update(
    @Req() req: Request & { user: JwtUserPayload },
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateCompanyItemDto,
  ) {
    return this.companyItemService.update(req.user.id, companyId, itemId, dto);
  }

  @Delete(':id')
  delete(
    @Req() req: Request & { user: JwtUserPayload },
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) itemId: string,
  ) {
    return this.companyItemService.delete(req.user.id, companyId, itemId);
  }

  // A página do item (…/itens/filamento-pla) chega pelo slug
  @Get(':slug')
  findBySlug(
    @Req() req: Request & { user: JwtUserPayload },
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('slug') slug: string,
  ) {
    return this.companyItemService.findBySlug(req.user.id, companyId, slug);
  }

  @Get()
  findAll(
    @Req() req: Request & { user: JwtUserPayload },
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.companyItemService.findAll(
      req.user.id,
      companyId,
      resolvePagination(query),
    );
  }
}
