import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { BankAccount, CompanyMember, CompanyRole } from 'src/generated/prisma/client/client';
import {
  CompanyAccessRepository,
  CompanyMemberDetail,
  CompanyMemberHistory,
  CompanyMemberProfile,
  CompanyMemberUpdate,
  CompanyRoleData,
  CompanyRoleWithCount,
} from '../company-access-repository';

@Injectable()
export class PrismaCompanyAccessRepository implements CompanyAccessRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findRoles(companyId: string): Promise<CompanyRoleWithCount[]> {
    return this.prisma.companyRole.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { members: true } } },
    });
  }

  async findRole(companyId: string, roleId: string): Promise<CompanyRole | null> {
    return this.prisma.companyRole.findFirst({ where: { id: roleId, companyId } });
  }

  async findRoleByName(companyId: string, name: string): Promise<CompanyRole | null> {
    return this.prisma.companyRole.findFirst({
      where: { companyId, name: { equals: name, mode: 'insensitive' } },
    });
  }

  async createRole(companyId: string, data: CompanyRoleData): Promise<CompanyRole> {
    return this.prisma.companyRole.create({ data: { companyId, ...data } });
  }

  async updateRole(roleId: string, data: Partial<CompanyRoleData>): Promise<CompanyRole> {
    return this.prisma.companyRole.update({ where: { id: roleId }, data });
  }

  async deleteRole(roleId: string): Promise<void> {
    await this.prisma.companyRole.delete({ where: { id: roleId } });
  }

  async countRoleMembers(roleId: string): Promise<number> {
    return this.prisma.companyMember.count({ where: { roleId } });
  }

  async findMemberById(companyId: string, memberId: string): Promise<CompanyMember | null> {
    return this.prisma.companyMember.findFirst({ where: { id: memberId, companyId } });
  }

  async findMemberDetail(companyId: string, memberId: string): Promise<CompanyMemberDetail | null> {
    return this.prisma.companyMember.findFirst({
      where: { id: memberId, companyId },
      include: {
        user: { select: { id: true, email: true, fullName: true } },
        role: { select: { id: true, name: true } },
        country: { select: { id: true, name: true } },
        currency: { select: { id: true, shortCode: true, symbol: true } },
        bankAccount: { select: { id: true, name: true } },
      },
    });
  }

  async createRecordMember(companyId: string, data: CompanyMemberProfile): Promise<CompanyMember> {
    return this.prisma.companyMember.create({ data: { companyId, ...data } });
  }

  async updateMember(memberId: string, data: CompanyMemberUpdate): Promise<CompanyMember> {
    return this.prisma.companyMember.update({ where: { id: memberId }, data });
  }

  async countMemberHistory(memberId: string): Promise<CompanyMemberHistory> {
    const [pays, contracts, documents, payments] = await Promise.all([
      this.prisma.companyMemberPay.count({ where: { memberId } }),
      this.prisma.companyMemberContract.count({ where: { memberId } }),
      this.prisma.companyMemberDocument.count({ where: { memberId } }),
      this.prisma.companyPayment.count({ where: { memberId } }),
    ]);
    return { pays, contracts, documents, payments };
  }

  async findCompanyBankAccount(companyId: string, bankAccountId: string): Promise<BankAccount | null> {
    return this.prisma.bankAccount.findFirst({ where: { id: bankAccountId, companyId } });
  }

  async deleteMember(memberId: string): Promise<void> {
    await this.prisma.companyMember.delete({ where: { id: memberId } });
  }
}
