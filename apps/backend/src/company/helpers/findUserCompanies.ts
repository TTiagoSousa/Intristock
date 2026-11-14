import { PrismaCompanyRepository } from '../repositories/prisma/prisma-company-repository';

export async function findUserCompanies(userId: string, companyRepository: PrismaCompanyRepository) {
  return companyRepository.findAllAccessibleByUserId(userId);
}
