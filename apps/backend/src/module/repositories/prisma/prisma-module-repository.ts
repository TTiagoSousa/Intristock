import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ModuleRepository } from '../module-repository';
import { Module as SystemModule } from 'src/generated/prisma/client/client';

@Injectable()
export class PrismaModuleRepository implements ModuleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    name: string;
    label: string;
    description?: string;
    icon?: string;
    isActive?: boolean;
  }): Promise<SystemModule> {
    return this.prisma.module.create({ data });
  }

  async update(
    id: string,
    data: {
      name?: string;
      label?: string;
      description?: string;
      icon?: string;
      isActive?: boolean;
    },
  ): Promise<SystemModule> {
    return this.prisma.module.update({ where: { id }, data });
  }

  async findById(id: string): Promise<SystemModule | null> {
    return this.prisma.module.findUnique({ where: { id } });
  }

  async findByName(name: string): Promise<SystemModule | null> {
    return this.prisma.module.findUnique({ where: { name } });
  }

  async findAll(): Promise<SystemModule[]> {
    return this.prisma.module.findMany({ orderBy: { label: 'asc' } });
  }

  async findAllActive(): Promise<SystemModule[]> {
    return this.prisma.module.findMany({
      where: { isActive: true },
      orderBy: { label: 'asc' },
    });
  }
}
