import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserOwnedData, UserRepository, UserUpdate } from '../user-repository';
import { ACTIVE_STATUSES } from 'src/live-test/helpers/liveTestStatus';
import { User } from 'src/generated/prisma/client/client';

// O que sai para fora de um user — nunca o hash da password
const PUBLIC_FIELDS = {
  id: true,
  firstName: true,
  lastName: true,
  fullName: true,
  email: true,
  active: true,
  role: true,
  blockedUntil: true,
  blockedReason: true,
  countryId: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findPasswordHash(id: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { hashedPassword: true },
    });
    return user?.hashedPassword ?? null;
  }

  async create(data: {
    firstName: string;
    lastName: string;
    fullName: string;
    email: string;
    hashedPassword: string;
    role: string;
    active: boolean;
  }): Promise<User> {
    return this.prisma.user.create({ data });
  }

  async findById(id: string): Promise<Omit<User, 'hashedPassword' | 'passwordChangedAt'> | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: PUBLIC_FIELDS,
    });
  }

  async findAll(): Promise<Omit<User, 'hashedPassword' | 'passwordChangedAt'>[]> {
    return this.prisma.user.findMany({
      select: PUBLIC_FIELDS,
      orderBy: { createdAt: 'asc' },
    });
  }

  async updatePassword(id: string, hashedPassword: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      // As sessões abertas antes disto deixam de valer (a estratégia JWT compara o iat)
      data: { hashedPassword, passwordChangedAt: new Date() },
    });
  }

  async update(id: string, data: UserUpdate): Promise<Omit<User, 'hashedPassword' | 'passwordChangedAt'>> {
    return this.prisma.user.update({ where: { id }, data, select: PUBLIC_FIELDS });
  }

  // As tabelas sem cascata vão à mão; o resto (simulações, testes ao vivo, avisos…)
  // vai com a conta
  async delete(id: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.passwordResetRequest.deleteMany({ where: { userId: id } }),
      this.prisma.calculatorSimulation.deleteMany({ where: { userId: id } }),
      this.prisma.companyMember.deleteMany({ where: { userId: id } }),
      this.prisma.user.delete({ where: { id } }),
    ]);
  }

  // Os outros admins que conseguem entrar: ativos e sem bloqueio
  async countUsableAdmins(exceptId: string): Promise<number> {
    return this.prisma.user.count({
      where: {
        id: { not: exceptId },
        role: 'ADMIN',
        active: true,
        OR: [{ blockedUntil: null }, { blockedUntil: { lte: new Date() } }],
      },
    });
  }

  async countOwnedData(id: string): Promise<UserOwnedData> {
    const [companies, bankAccounts, simulations, liveTests] = await Promise.all([
      this.prisma.company.count({ where: { createdById: id } }),
      this.prisma.bankAccount.count({ where: { userId: id } }),
      this.prisma.simulationRun.count({ where: { userId: id, status: 'running' } }),
      this.prisma.liveTest.count({ where: { userId: id, status: { in: [...ACTIVE_STATUSES] } } }),
    ]);
    return { companies, bankAccounts, running: simulations + liveTests };
  }
}
