import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtUserAuthGuard } from 'src/auth-user/guards/jwt-user-auth.guard';
import { JwtUserPayload } from 'src/auth-user/jwt-payload.interface';
import { CompanyAccessService } from './company-access.service';
import { CreateCompanyRoleDto, UpdateCompanyRoleDto } from './dto/company-role.dto';
import { AddCompanyMemberDto, UpdateCompanyMemberDto } from './dto/company-member.dto';

type AuthRequest = Request & { user: JwtUserPayload };

/** A lista das permissões que um cargo pode dar, para a grelha dos cargos. */
@Controller('company-permissions')
@UseGuards(JwtUserAuthGuard)
export class CompanyPermissionsController {
  constructor(private readonly accessService: CompanyAccessService) {}

  @Get()
  catalog() {
    return this.accessService.permissionCatalog();
  }
}

@Controller('company/:companyId')
@UseGuards(JwtUserAuthGuard)
export class CompanyAccessController {
  constructor(private readonly accessService: CompanyAccessService) {}

  // O que eu posso fazer nesta empresa
  @Get('access')
  myAccess(@Req() req: AuthRequest, @Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.accessService.myAccess(req.user.id, companyId);
  }

  @Get('roles')
  findRoles(@Req() req: AuthRequest, @Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.accessService.findRoles(req.user.id, companyId);
  }

  @Post('roles')
  createRole(
    @Req() req: AuthRequest,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateCompanyRoleDto,
  ) {
    return this.accessService.createRole(req.user.id, companyId, dto);
  }

  @Patch('roles/:roleId')
  updateRole(
    @Req() req: AuthRequest,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Body() dto: UpdateCompanyRoleDto,
  ) {
    return this.accessService.updateRole(req.user.id, companyId, roleId, dto);
  }

  @Delete('roles/:roleId')
  @HttpCode(204)
  deleteRole(
    @Req() req: AuthRequest,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
  ) {
    return this.accessService.deleteRole(req.user.id, companyId, roleId);
  }

  @Get('members')
  findMembers(@Req() req: AuthRequest, @Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.accessService.findMembers(req.user.id, companyId);
  }

  @Get('members/:memberId')
  findMember(
    @Req() req: AuthRequest,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ) {
    return this.accessService.findMember(req.user.id, companyId, memberId);
  }

  @Post('members')
  addMember(
    @Req() req: AuthRequest,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: AddCompanyMemberDto,
  ) {
    return this.accessService.addMember(req.user.id, companyId, dto);
  }

  @Patch('members/:memberId')
  updateMember(
    @Req() req: AuthRequest,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: UpdateCompanyMemberDto,
  ) {
    return this.accessService.updateMember(req.user.id, companyId, memberId, dto);
  }

  @Delete('members/:memberId')
  @HttpCode(204)
  removeMember(
    @Req() req: AuthRequest,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ) {
    return this.accessService.removeMember(req.user.id, companyId, memberId);
  }
}
