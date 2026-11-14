import { BadRequestException, ConflictException } from '@nestjs/common';
import { assertCompanyAccess } from 'src/company/helpers/assertCompanyAccess';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { PrismaCompanySupplierRepository } from '../repositories/prisma/prisma-company-supplier-repository';
import { SUPPLIER_CATALOG_TYPES } from '../dto/supplier-catalog.dto';
import { generateSupplierSlug } from './generateSupplierSlug';

/**
 * Cria um fornecedor a partir de uma plataforma do catálogo: o nome, o site e o
 * país vêm dela, é uma empresa e paga-se direto (no site, com cartão). O resto
 * (moeda, grupo, NIF) edita-se depois. Uma plataforma entra uma vez por empresa.
 */
export async function createSupplierFromPlatform(
  userId: string,
  companyId: string,
  platformId: string,
  companySupplierRepository: PrismaCompanySupplierRepository,
  companyRepository: PrismaCompanyRepository,
) {
  await assertCompanyAccess(userId, companyId, companyRepository, {
    notYours: 'Não podes criar fornecedores numa empresa que não é tua',
    permission: 'suppliers.create',
  });

  const platform = await companySupplierRepository.findPlatform(platformId);
  if (
    !platform ||
    !platform.isActive ||
    !(SUPPLIER_CATALOG_TYPES as readonly string[]).includes(platform.type)
  )
    throw new BadRequestException('Fornecedor do catálogo inválido');

  if (await companySupplierRepository.findByPlatform(companyId, platformId))
    throw new ConflictException('Este fornecedor já está na empresa');

  const slug = await generateSupplierSlug(
    companyId,
    platform.name,
    companySupplierRepository,
  );

  return companySupplierRepository.create({
    companyId,
    slug,
    name: platform.name,
    type: 'company',
    paymentMethod: 'direct',
    website: platform.website ?? undefined,
    countryId: platform.countryId ?? undefined,
    platformId: platform.id,
  });
}
