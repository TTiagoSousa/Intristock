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
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { CompanySupplierGroupService } from './company-supplier-group.service';
import { CreateCompanySupplierGroupDto } from './dto/create-company-supplier-group.dto';
import { UpdateCompanySupplierGroupDto } from './dto/update-company-supplier-group.dto';
import { SetCompanySupplierGroupSuppliersDto } from './dto/set-company-supplier-group-suppliers.dto';
import { JwtUserAuthGuard } from 'src/auth-user/guards/jwt-user-auth.guard';
import { JwtUserPayload } from 'src/auth-user/jwt-payload.interface';
import { PaginationQueryDto, resolvePagination } from 'src/common/pagination';

@Controller('company/:companyId/supplier-groups')
@UseGuards(JwtUserAuthGuard)
export class CompanySupplierGroupController {
  constructor(private readonly companySupplierGroupService: CompanySupplierGroupService) {}

  @Post()
  create(
    @Req() req: Request & { user: JwtUserPayload },
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateCompanySupplierGroupDto,
  ) {
    return this.companySupplierGroupService.create(req.user.id, companyId, dto);
  }

  @Get()
  findAll(
    @Req() req: Request & { user: JwtUserPayload },
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.companySupplierGroupService.findAll(req.user.id, companyId, resolvePagination(query));
  }

  @Patch(':id')
  update(
    @Req() req: Request & { user: JwtUserPayload },
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) groupId: string,
    @Body() dto: UpdateCompanySupplierGroupDto,
  ) {
    return this.companySupplierGroupService.update(req.user.id, companyId, groupId, dto);
  }

  @Delete(':id')
  remove(
    @Req() req: Request & { user: JwtUserPayload },
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) groupId: string,
  ) {
    return this.companySupplierGroupService.remove(req.user.id, companyId, groupId);
  }

  @Put(':id/suppliers')
  setSuppliers(
    @Req() req: Request & { user: JwtUserPayload },
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) groupId: string,
    @Body() dto: SetCompanySupplierGroupSuppliersDto,
  ) {
    return this.companySupplierGroupService.setSuppliers(req.user.id, companyId, groupId, dto);
  }
}
