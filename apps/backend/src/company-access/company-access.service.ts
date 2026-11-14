import { Injectable } from '@nestjs/common';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { PrismaUserRepository } from 'src/user/repositories/prisma/prisma-user-repository';
import { COMPANY_PERMISSION_AREAS } from 'src/company/permissions/companyPermissions';
import { PrismaCompanyAccessRepository } from './repositories/prisma/prisma-company-access-repository';
import { CreateCompanyRoleDto, UpdateCompanyRoleDto } from './dto/company-role.dto';
import { AddCompanyMemberDto, UpdateCompanyMemberDto } from './dto/company-member.dto';
import { getMyCompanyAccess } from './helpers/getMyCompanyAccess';
import { findCompanyRoles } from './helpers/findCompanyRoles';
import { createCompanyRole } from './helpers/createCompanyRole';
import { updateCompanyRole } from './helpers/updateCompanyRole';
import { deleteCompanyRole } from './helpers/deleteCompanyRole';
import { findCompanyMembers } from './helpers/findCompanyMembers';
import { findCompanyMember } from './helpers/findCompanyMember';
import { addCompanyMember } from './helpers/addCompanyMember';
import { updateCompanyMember } from './helpers/updateCompanyMember';
import { removeCompanyMember } from './helpers/removeCompanyMember';

/** Os cargos de cada empresa, os membros e o que cada um pode fazer. */
@Injectable()
export class CompanyAccessService {
  constructor(
    private readonly companyRepository: PrismaCompanyRepository,
    private readonly userRepository: PrismaUserRepository,
    private readonly accessRepository: PrismaCompanyAccessRepository,
  ) {}

  permissionCatalog() {
    return Object.entries(COMPANY_PERMISSION_AREAS).map(([area, actions]) => ({ area, actions }));
  }

  myAccess(userId: string, companyId: string) {
    return getMyCompanyAccess(userId, companyId, this.companyRepository);
  }

  findRoles(userId: string, companyId: string) {
    return findCompanyRoles(userId, companyId, this.companyRepository, this.accessRepository);
  }

  createRole(userId: string, companyId: string, dto: CreateCompanyRoleDto) {
    return createCompanyRole(userId, companyId, dto, this.companyRepository, this.accessRepository);
  }

  updateRole(userId: string, companyId: string, roleId: string, dto: UpdateCompanyRoleDto) {
    return updateCompanyRole(userId, companyId, roleId, dto, this.companyRepository, this.accessRepository);
  }

  deleteRole(userId: string, companyId: string, roleId: string) {
    return deleteCompanyRole(userId, companyId, roleId, this.companyRepository, this.accessRepository);
  }

  findMembers(userId: string, companyId: string) {
    return findCompanyMembers(userId, companyId, this.companyRepository, this.userRepository);
  }

  findMember(userId: string, companyId: string, memberId: string) {
    return findCompanyMember(userId, companyId, memberId, this.companyRepository, this.accessRepository);
  }

  addMember(userId: string, companyId: string, dto: AddCompanyMemberDto) {
    return addCompanyMember(
      userId,
      companyId,
      dto,
      this.companyRepository,
      this.userRepository,
      this.accessRepository,
    );
  }

  updateMember(userId: string, companyId: string, memberId: string, dto: UpdateCompanyMemberDto) {
    return updateCompanyMember(userId, companyId, memberId, dto, this.companyRepository, this.accessRepository);
  }

  removeMember(userId: string, companyId: string, memberId: string) {
    return removeCompanyMember(userId, companyId, memberId, this.companyRepository, this.accessRepository);
  }
}
