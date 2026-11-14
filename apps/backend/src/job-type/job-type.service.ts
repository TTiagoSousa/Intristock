import { Injectable } from '@nestjs/common';
import { PrismaJobTypeRepository } from './repositories/prisma/prisma-job-type-repository';
import { createJobType } from './helpers/createJobType';
import { findAllJobTypes } from './helpers/findAllJobTypes';
import { CreateJobTypeDto } from './dto/create-job-type.dto';

@Injectable()
export class JobTypeService {
  constructor(private readonly jobTypeRepository: PrismaJobTypeRepository) {}

  async create(dto: CreateJobTypeDto) {
    return createJobType(dto, this.jobTypeRepository);
  }

  async findAll() {
    return findAllJobTypes(this.jobTypeRepository);
  }
}
