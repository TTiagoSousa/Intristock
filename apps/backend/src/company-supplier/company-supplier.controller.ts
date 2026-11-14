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
import { CompanySupplierService } from './company-supplier.service';
import { CreateCompanySupplierDto } from './dto/create-company-supplier.dto';
import { UpdateCompanySupplierDto } from './dto/update-company-supplier.dto';
import {
  CreateSupplierFromPlatformDto,
  SupplierCatalogQueryDto,
} from './dto/supplier-catalog.dto';
import { JwtUserAuthGuard } from 'src/auth-user/guards/jwt-user-auth.guard';
import { JwtUserPayload } from 'src/auth-user/jwt-payload.interface';
import { PaginationQueryDto, resolvePagination } from 'src/common/pagination';

@Controller('company/:companyId/suppliers')
@UseGuards(JwtUserAuthGuard)
export class CompanySupplierController {
  constructor(
    private readonly companySupplierService: CompanySupplierService,
  ) {}

  @Post()
  create(
    @Req() req: Request & { user: JwtUserPayload },
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateCompanySupplierDto,
  ) {
    return this.companySupplierService.create(req.user.id, companyId, dto);
  }

  // Um fornecedor tirado do catálogo (uma prop firm…)
  @Post('from-platform')
  createFromPlatform(
    @Req() req: Request & { user: JwtUserPayload },
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateSupplierFromPlatformDto,
  ) {
    return this.companySupplierService.createFromPlatform(
      req.user.id,
      companyId,
      dto.platformId,
    );
  }

  // Antes do ':slug', senão "catalog" era lido como o slug de um fornecedor
  @Get('catalog')
  findCatalog(
    @Req() req: Request & { user: JwtUserPayload },
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: SupplierCatalogQueryDto,
  ) {
    return this.companySupplierService.findCatalog(
      req.user.id,
      companyId,
      query.type,
    );
  }

  @Patch(':id')
  update(
    @Req() req: Request & { user: JwtUserPayload },
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) supplierId: string,
    @Body() dto: UpdateCompanySupplierDto,
  ) {
    return this.companySupplierService.update(
      req.user.id,
      companyId,
      supplierId,
      dto,
    );
  }

  // Só passa se ninguém depender dele. Um fornecedor com pagamentos ou itens
  // desativa-se com `isActive: false`, não se apaga.
  @Delete(':id')
  remove(
    @Req() req: Request & { user: JwtUserPayload },
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) supplierId: string,
  ) {
    return this.companySupplierService.remove(
      req.user.id,
      companyId,
      supplierId,
    );
  }

  // A página do fornecedor (…/fornecedores/iq-capital) chega pelo slug
  @Get(':slug')
  findBySlug(
    @Req() req: Request & { user: JwtUserPayload },
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('slug') slug: string,
  ) {
    return this.companySupplierService.findBySlug(req.user.id, companyId, slug);
  }

  @Get()
  findAll(
    @Req() req: Request & { user: JwtUserPayload },
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.companySupplierService.findAll(
      req.user.id,
      companyId,
      resolvePagination(query),
    );
  }
}
