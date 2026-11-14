import { PrismaJobTypeRepository } from '../repositories/prisma/prisma-job-type-repository';

export async function findAllJobTypes(jobTypeRepository: PrismaJobTypeRepository) {
  return jobTypeRepository.findAll();
}
