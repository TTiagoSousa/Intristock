import { Injectable } from '@nestjs/common';
import { PrismaCompanySupplierGroupRepository } from './repositories/prisma/prisma-company-supplier-group-repository';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { createCompanySupplierGroup } from './helpers/createCompanySupplierGroup';
import { findCompanySupplierGroups } from './helpers/findCompanySupplierGroups';
import { updateCompanySupplierGroup } from './helpers/updateCompanySupplierGroup';
import { deleteCompanySupplierGroup } from './helpers/deleteCompanySupplierGroup';
import { setCompanySupplierGroupSuppliers } from './helpers/setCompanySupplierGroupSuppliers';
import { CreateCompanySupplierGroupDto } from './dto/create-company-supplier-group.dto';
import { UpdateCompanySupplierGroupDto } from './dto/update-company-supplier-group.dto';
import { SetCompanySupplierGroupSuppliersDto } from './dto/set-company-supplier-group-suppliers.dto';

@Injectable()
export class CompanySupplierGroupService {
  constructor(
    private readonly companySupplierGroupRepository: PrismaCompanySupplierGroupRepository,
    private readonly companyRepository: PrismaCompanyRepository,
  ) {}

  async create(userId: string, companyId: string, dto: CreateCompanySupplierGroupDto) {
    return createCompanySupplierGroup(
      userId,
      companyId,
      dto,
      this.companySupplierGroupRepository,
      this.companyRepository,
    );
  }

  async findAll(
    userId: string,
    companyId: string,
    pagination: { skip: number; take: number },
  ) {
    return findCompanySupplierGroups(
      userId,
      companyId,
      this.companySupplierGroupRepository,
      this.companyRepository,
      pagination,
    );
  }

  async update(
    userId: string,
    companyId: string,
    groupId: string,
    dto: UpdateCompanySupplierGroupDto,
  ) {
    return updateCompanySupplierGroup(
      userId,
      companyId,
      groupId,
      dto,
      this.companySupplierGroupRepository,
      this.companyRepository,
    );
  }

  async remove(userId: string, companyId: string, groupId: string) {
    return deleteCompanySupplierGroup(
      userId,
      companyId,
      groupId,
      this.companySupplierGroupRepository,
      this.companyRepository,
    );
  }

  async setSuppliers(
    userId: string,
    companyId: string,
    groupId: string,
    dto: SetCompanySupplierGroupSuppliersDto,
  ) {
    return setCompanySupplierGroupSuppliers(
      userId,
      companyId,
      groupId,
      dto,
      this.companySupplierGroupRepository,
      this.companyRepository,
    );
  }
}
