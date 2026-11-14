import { BadRequestException } from '@nestjs/common';
import { PrismaCompanyAccessRepository } from '../repositories/prisma/prisma-company-access-repository';
import { CompanyMemberProfile } from '../repositories/company-access-repository';
import { CompanyMemberProfileDto } from '../dto/company-member.dto';

const TEXT_FIELDS = [
  'name',
  'email',
  'phone',
  'jobTitle',
  'taxNumber',
  'socialSecurityNumber',
  'idDocumentNumber',
  'addressLine',
  'postalCode',
  'city',
  'iban',
  'notes',
] as const;

const ID_FIELDS = ['countryId', 'currencyId', 'bankAccountId'] as const;

/**
 * Os dados da pessoa como se gravam: só os campos que vieram, aparados, e o
 * vazio passa a null. A conta de onde se paga tem de ser desta empresa.
 */
export async function buildMemberProfile(
  companyId: string,
  dto: CompanyMemberProfileDto,
  accessRepository: PrismaCompanyAccessRepository,
): Promise<CompanyMemberProfile> {
  const profile: CompanyMemberProfile = {};

  for (const field of TEXT_FIELDS) {
    const value = dto[field];
    if (value === undefined) continue;
    profile[field] = value?.trim() || null;
  }
  for (const field of ID_FIELDS) {
    const value = dto[field];
    if (value === undefined) continue;
    profile[field] = value || null;
  }
  if (dto.birthDate !== undefined) {
    profile.birthDate = dto.birthDate ? new Date(dto.birthDate) : null;
  }

  if (
    profile.bankAccountId &&
    !(await accessRepository.findCompanyBankAccount(
      companyId,
      profile.bankAccountId,
    ))
  ) {
    throw new BadRequestException('A conta bancária não é desta empresa');
  }

  return profile;
}
