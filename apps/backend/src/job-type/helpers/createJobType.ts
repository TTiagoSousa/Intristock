import { ConflictException } from '@nestjs/common';
import { PrismaJobTypeRepository } from '../repositories/prisma/prisma-job-type-repository';
import { CreateJobTypeDto } from '../dto/create-job-type.dto';

export async function createJobType(
  dto: CreateJobTypeDto,
  jobTypeRepository: PrismaJobTypeRepository,
) {
  const exists = await jobTypeRepository.findByName(dto.name);
  if (exists) throw new ConflictException('Tipo de trabalho já existe');

  return jobTypeRepository.create(dto.name);
}
