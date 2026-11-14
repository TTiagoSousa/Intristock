import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { JobTypeRepository } from '../job-type-repository';
import { JobType } from 'src/generated/prisma/client/client';

@Injectable()
export class PrismaJobTypeRepository implements JobTypeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(name: string): Promise<JobType> {
    return this.prisma.jobType.create({ data: { name } });
  }

  async findAll(): Promise<JobType[]> {
    return this.prisma.jobType.findMany({ orderBy: { name: 'asc' } });
  }

  async findByName(name: string): Promise<JobType | null> {
    return this.prisma.jobType.findUnique({ where: { name } });
  }

  async findById(id: string): Promise<JobType | null> {
    return this.prisma.jobType.findUnique({ where: { id } });
  }
}
